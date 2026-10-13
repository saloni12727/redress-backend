import { randomUUID } from "node:crypto";

import { buildProductUploadKey } from "../../services/s3.service.js";
import {
  deleteStoredMedia,
  getMediaUrl,
  uploadProcessedImage,
} from "../../services/media/media-storage.service.js";
import {
  MediaValidationError,
  processImage,
} from "../../services/media/image-processor.service.js";

import {
  VendorProductError,
  productNotFound,
} from "./vendor-products.error.js";
import * as repository from "./vendor-products.repository.js";

const EDITABLE_APPROVALS = new Set(["draft", "rejected", "approved"]);
const RETURN_WINDOW_DAYS = 14;
const ACTIVE_VENDOR = (vendor) =>
  vendor?.status === "active" && vendor?.approvalStatus === "approved";
const hasOwn = (object, property) =>
  Object.prototype.hasOwnProperty.call(object, property);
const plain = (value) =>
  typeof value?.get === "function" ? value.get({ plain: true }) : value;
const id = (value) =>
  value === null || value === undefined ? null : String(value);
const bool = (value) => value === true || value === 1 || value === "1";
const date = (value) => (value ? new Date(value).toISOString() : null);
const number = (value) =>
  value === null || value === undefined ? null : String(value);

function error(message, options = {}) {
  return new VendorProductError(message, options);
}

export async function resolveVendorContext({
  accountId,
  vendorId,
  requireApproved = true,
}) {
  const memberships = await repository.findMembership(
    accountId,
    vendorId ? Number(vendorId) : undefined,
  );
  if (!memberships.length)
    throw error("You do not have access to a vendor workspace.", {
      statusCode: 403,
      code: "VENDOR_ACCESS_DENIED",
    });
  if (!vendorId && memberships.length > 1)
    throw error("Select a vendor workspace before continuing.", {
      statusCode: 409,
      code: "VENDOR_CONTEXT_REQUIRED",
    });
  const membership = memberships[0];
  const vendor = plain(membership.vendor);
  if (!vendor || vendor.status === "suspended")
    throw error("This vendor workspace is not available.", {
      statusCode: 403,
      code: "VENDOR_UNAVAILABLE",
    });
  if (requireApproved && !ACTIVE_VENDOR(vendor))
    throw error(
      "This vendor must be approved and active before products can be managed.",
      { statusCode: 403, code: "VENDOR_NOT_APPROVED" },
    );
  return { membership: plain(membership), vendor };
}

function productDto(details) {
  const product = plain(details.product);
  if (!product) return null;
  return {
    id: id(product.id),
    vendorId: id(product.vendorId),
    code: product.code,
    slug: product.slug,
    status: product.status,
    approvalStatus: product.approvalStatus,
    visibility: product.visibility,
    currencyCode: product.currencyCode,
    isReturnable: bool(product.isReturnable),

    returnWindowDays: bool(product.isReturnable) ? RETURN_WINDOW_DAYS : null,
    rejectionReason: product.rejectionReason ?? null,
    publishedAt: date(product.publishedAt),
    approvedAt: date(product.approvedAt),
    brand: product.brand
      ? {
          id: id(product.brand.id),
          code: product.brand.code,
          name: product.brand.name,
          slug: product.brand.slug,
        }
      : null,
    fitProfile: product.fitProfile
      ? {
          id: id(product.fitProfile.id),
          code: product.fitProfile.code,
          name: product.fitProfile.name,
        }
      : null,
    translations: details.translations.map((item) => {
      const value = plain(item);
      return {
        languageCode: value.languageCode,
        name: value.name,
        shortDescription: value.shortDescription ?? null,
        description: value.description ?? null,
        careInstructions: value.careInstructions ?? null,
        sizeAndFitNotes: value.sizeAndFitNotes ?? null,
        seoTitle: value.seoTitle ?? null,
        seoDescription: value.seoDescription ?? null,
      };
    }),
    categories: details.categories.map((item) => {
      const value = plain(item);
      return {
        id: id(value.categoryId),
        code: value.category?.code ?? null,
        slug: value.category?.slug ?? null,
        isPrimary: bool(value.isPrimary),
        sortOrder: Number(value.sortOrder ?? 0),
      };
    }),
    variants: details.variants.map((item) => {
      const value = plain(item);
      return {
        id: id(value.id),
        sku: value.sku,
        barcode: value.barcode ?? null,
        size: value.size
          ? {
              id: id(value.size.id),
              code: value.size.code,
              label: value.size.label,
            }
          : null,
        color: value.color
          ? {
              id: id(value.color.id),
              code: value.color.code,
              name: value.color.name,
              hexCode: value.color.hexCode ?? null,
            }
          : null,
        regularPrice: number(value.regularPrice),
        salePrice: number(value.salePrice),
        costPrice: number(value.costPrice),
        saleStartAt: date(value.saleStartAt),
        saleEndAt: date(value.saleEndAt),
        weightValue: number(value.weightValue),
        weightUnit: value.weightUnit ?? null,
        isDefault: bool(value.isDefault),
        isActive: bool(value.isActive),
        sortOrder: Number(value.sortOrder ?? 0),
        inventory: value.inventory
          ? {
              quantityOnHand: Number(value.inventory.quantityOnHand),
              quantityReserved: Number(value.inventory.quantityReserved),
              reorderPoint: Number(value.inventory.reorderPoint),
              safetyStock: Number(value.inventory.safetyStock),
              allowBackorder: bool(value.inventory.allowBackorder),
              stockVersion: Number(value.inventory.stockVersion),
            }
          : null,
      };
    }),
    media: details.media.map((item) => {
      const value = plain(item);
      return {
        id: id(value.id),
        variantId: id(value.variantId),
        url: getMediaUrl(value.storageKey),
        mimeType: value.mimeType ?? null,
        altText: value.altText ?? null,
        width: value.width ?? null,
        height: value.height ?? null,
        sortOrder: Number(value.sortOrder ?? 0),
        isPrimary: bool(value.isPrimary),
        moderationStatus: value.moderationStatus,
      };
    }),
    createdAt: date(product.createdAt),
    updatedAt: date(product.updatedAt),
  };
}

async function ownedProduct(productId, vendorId, transaction) {
  const product = await repository.findProductByIdForVendor(
    productId,
    vendorId,
    { transaction, lock: transaction?.LOCK?.UPDATE },
  );
  if (!product) throw productNotFound();
  return product;
}

function assertEditable(product) {
  if (
    product.status !== "draft" ||
    !EDITABLE_APPROVALS.has(product.approvalStatus)
  )
    throw error(
      "Only a draft product that is not awaiting approval can be changed.",
      { statusCode: 409, code: "PRODUCT_NOT_EDITABLE" },
    );
}

async function resetApprovalIfApproved(product, transaction) {
  if (product.approvalStatus !== "approved") return;
  await repository.updateProduct(
    product,
    { approvalStatus: "draft", approvedAt: null, approvedByAccountId: null },
    { transaction },
  );
}

async function assertUniqueProduct(payload, excludeId, transaction) {
  for (const [field, finder] of [
    ["code", repository.findProductByCode],
    ["slug", repository.findProductBySlug],
  ]) {
    if (payload[field] !== undefined) {
      const existing = await finder(payload[field], { transaction });
      if (existing && String(existing.id) !== String(excludeId))
        throw error(`The product ${field} is already in use.`, {
          statusCode: 409,
          code: `PRODUCT_${field.toUpperCase()}_EXISTS`,
        });
    }
  }
}

async function assertProductMasters(payload, transaction) {
  if (
    payload.brandId !== undefined &&
    payload.brandId !== null &&
    !(await repository.findActiveBrand(payload.brandId, { transaction }))
  )
    throw error("The selected brand is not active.", {
      code: "PRODUCT_BRAND_INVALID",
    });
  if (
    payload.fitProfileId !== undefined &&
    payload.fitProfileId !== null &&
    !(await repository.findActiveFitProfile(payload.fitProfileId, {
      transaction,
    }))
  )
    throw error("The selected fit profile is not active.", {
      code: "PRODUCT_FIT_INVALID",
    });
}

function productValues(payload) {
  const values = {};

  for (const field of [
    "code",
    "slug",
    "brandId",
    "fitProfileId",
    "currencyCode",
    "isReturnable",
  ]) {
    if (hasOwn(payload, field)) {
      values[field] = payload[field];
    }
  }

  return values;
}

async function ensureCategories(productId, categories, transaction) {
  const categoryIds = categories.map((item) => item.categoryId);
  const records = await repository.findActiveCategories(categoryIds, {
    transaction,
  });
  if (records.length !== categoryIds.length)
    throw error("One or more selected categories are not active.", {
      code: "PRODUCT_CATEGORY_INVALID",
    });
  const normalized = categories.map((item, index) => ({
    categoryId: item.categoryId,
    isPrimary: item.isPrimary ?? index === 0,
    sortOrder: item.sortOrder ?? index,
  }));
  if (!normalized.some((item) => item.isPrimary))
    normalized[0].isPrimary = true;
  await repository.replaceProductCategories(productId, normalized, {
    transaction,
  });
}

export async function listVendorProducts({ accountId, vendorId, filters }) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  const result = await repository.findProductsForVendor(vendor.id, filters);
  return {
    items: await Promise.all(
      result.rows.map(async (item) =>
        productDto(await repository.findProductDetails(item.id)),
      ),
    ),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: result.total ? Math.ceil(result.total / filters.limit) : 0,
    },
  };
}

export async function getVendorProduct({ accountId, vendorId, productId }) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await ownedProduct(productId, vendor.id);
  return productDto(await repository.findProductDetails(productId));
}

export async function createVendorProduct({ accountId, vendorId, payload }) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  const product = await repository.withTransaction(async (transaction) => {
    await assertUniqueProduct(payload, null, transaction);
    await assertProductMasters(payload, transaction);
    const created = await repository.createProduct(
      {
        ...productValues(payload),

        vendorId: vendor.id,

        status: "draft",

        approvalStatus: "draft",

        visibility: "hidden",

        isReturnable: payload.isReturnable ?? true,

        returnWindowDays:
          payload.isReturnable === false ? null : RETURN_WINDOW_DAYS,

        createdByAccountId: accountId,
      },
      {
        transaction,
      },
    );
    if (payload.translations)
      await repository.upsertTranslations(created.id, payload.translations, {
        transaction,
      });
    return created;
  });
  return productDto(await repository.findProductDetails(product.id));
}

export async function updateVendorProduct({
  accountId,
  vendorId,
  productId,
  payload,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    await assertUniqueProduct(payload, productId, transaction);
    await assertProductMasters(payload, transaction);
    const values = productValues(payload);
    if (hasOwn(payload, "isReturnable")) {
      values.returnWindowDays = payload.isReturnable
        ? RETURN_WINDOW_DAYS
        : null;
    }
    if (product.approvalStatus === "approved") {
      values.approvalStatus = "draft";
      values.approvedAt = null;
      values.approvedByAccountId = null;
    }
    if (Object.keys(values).length)
      await repository.updateProduct(product, values, { transaction });
    if (payload.translations)
      await repository.upsertTranslations(productId, payload.translations, {
        transaction,
      });
  });
  return productDto(await repository.findProductDetails(productId));
}

export async function replaceVendorProductCategories({
  accountId,
  vendorId,
  productId,
  categories,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    await ensureCategories(productId, categories, transaction);
    await resetApprovalIfApproved(product, transaction);
  });
  return productDto(await repository.findProductDetails(productId));
}

async function assertVariantReferences(payload, transaction) {
  if (
    payload.sizeId !== undefined &&
    payload.sizeId !== null &&
    !(await repository.findActiveSize(payload.sizeId, { transaction }))
  )
    throw error("The selected size is not active.", {
      code: "VARIANT_SIZE_INVALID",
    });
  if (
    payload.colorId !== undefined &&
    payload.colorId !== null &&
    !(await repository.findActiveColor(payload.colorId, { transaction }))
  )
    throw error("The selected color is not active.", {
      code: "VARIANT_COLOR_INVALID",
    });
}

function mappingByAttribute(mappings, isVariantAttribute) {
  const result = new Map();
  for (const mappingRecord of mappings) {
    const mapping = plain(mappingRecord);
    if (bool(mapping.isVariantAttribute) !== isVariantAttribute) continue;
    const existing = result.get(String(mapping.attributeId));
    result.set(String(mapping.attributeId), {
      ...mapping,
      isRequired: bool(mapping.isRequired) || bool(existing?.isRequired),
      attribute: mapping.attribute ?? existing?.attribute ?? null,
    });
  }
  return result;
}

function measurementRequirementByType(requirements) {
  const result = new Map();
  for (const requirementRecord of requirements) {
    const requirement = plain(requirementRecord);
    const existing = result.get(String(requirement.measurementTypeId));
    result.set(String(requirement.measurementTypeId), {
      ...requirement,
      isRequired: bool(requirement.isRequired) || bool(existing?.isRequired),
      measurementType:
        requirement.measurementType ?? existing?.measurementType ?? null,
    });
  }
  return result;
}

function attributeValueDto(record) {
  const value = plain(record);
  const attribute = value.attribute ? plain(value.attribute) : null;
  const optionValue = value.optionValue ? plain(value.optionValue) : null;
  return {
    attributeId: id(value.attributeId),
    attribute: attribute
      ? {
          code: attribute.code,
          nameEn: attribute.nameEn,
          nameIt: attribute.nameIt,
          dataType: attribute.dataType,
          inputType: attribute.inputType,
          unitCode: attribute.unitCode ?? null,
          allowsMultiple: bool(attribute.allowsMultiple),
        }
      : null,
    optionValue: optionValue
      ? {
          id: id(optionValue.id),
          code: optionValue.code,
          labelEn: optionValue.labelEn,
          labelIt: optionValue.labelIt,
        }
      : null,
    valueText: value.valueText ?? null,
    valueDecimal: number(value.valueDecimal),
    valueBoolean:
      value.valueBoolean === null || value.valueBoolean === undefined
        ? null
        : bool(value.valueBoolean),
    unitCode: value.unitCode ?? null,
  };
}

function measurementDto(record) {
  const value = plain(record);
  const type = value.measurementType ? plain(value.measurementType) : null;
  return {
    measurementTypeId: id(value.measurementTypeId),
    measurementType: type
      ? {
          code: type.code,
          nameEn: type.nameEn,
          nameIt: type.nameIt,
          bodyRegion: type.bodyRegion ?? null,
          measurementKind: type.measurementKind,
          unitCode: type.unitCode,
        }
      : null,
    valueCm: number(value.valueCm),
    tolerancePlusCm: number(value.tolerancePlusCm),
    toleranceMinusCm: number(value.toleranceMinusCm),
    isEstimated: bool(value.isEstimated),
    notes: value.notes ?? null,
  };
}

async function valuesForAttributes(payloadAttributes, mappings, transaction) {
  const mappingById = mappingByAttribute(mappings, false);
  const variantMappingById = mappingByAttribute(mappings, true);
  const allowed = new Map([...mappingById, ...variantMappingById]);
  const result = [];

  for (const input of payloadAttributes) {
    const mapping = allowed.get(String(input.attributeId));
    if (!mapping)
      throw error(
        "One or more selected attributes are not available for this product category.",
        { code: "ATTRIBUTE_NOT_ALLOWED" },
      );
    const attribute = plain(mapping.attribute);
    if (!attribute)
      throw error("One or more selected attributes are not available.", {
        code: "ATTRIBUTE_NOT_ALLOWED",
      });

    const optionIds = input.optionValueIds ?? [];
    if (attribute.dataType === "option") {
      if (
        !optionIds.length ||
        input.valueText !== undefined ||
        input.valueDecimal !== undefined ||
        input.valueBoolean !== undefined ||
        input.unitCode !== undefined
      )
        throw error("Option attributes must use active option values only.", {
          code: "ATTRIBUTE_VALUE_INVALID",
        });
      if (!bool(attribute.allowsMultiple) && optionIds.length !== 1)
        throw error("This attribute accepts exactly one option value.", {
          code: "ATTRIBUTE_VALUE_MULTIPLE_NOT_ALLOWED",
        });
      if (new Set(optionIds).size !== optionIds.length)
        throw error("Duplicate option values are not allowed.", {
          code: "ATTRIBUTE_VALUE_DUPLICATE",
        });
      const options = await repository.findActiveAttributeValues(optionIds, {
        transaction,
      });
      if (
        options.length !== optionIds.length ||
        options.some(
          (option) => String(option.attributeId) !== String(attribute.id),
        )
      )
        throw error("One or more selected option values are invalid.", {
          code: "ATTRIBUTE_OPTION_INVALID",
        });
      result.push(
        ...optionIds.map((attributeValueId) => ({
          attributeId: attribute.id,
          attributeValueId,
          valueText: null,
          valueDecimal: null,
          valueBoolean: null,
          unitCode: null,
        })),
      );
      continue;
    }

    if (optionIds.length)
      throw error("Option values are not supported for this attribute.", {
        code: "ATTRIBUTE_OPTION_NOT_SUPPORTED",
      });
    if (attribute.dataType === "text") {
      if (
        !input.valueText?.trim?.() ||
        input.valueDecimal !== undefined ||
        input.valueBoolean !== undefined ||
        input.unitCode !== undefined
      )
        throw error("A text value is required for this attribute.", {
          code: "ATTRIBUTE_VALUE_INVALID",
        });
      result.push({
        attributeId: attribute.id,
        attributeValueId: null,
        valueText: input.valueText,
        valueDecimal: null,
        valueBoolean: null,
        unitCode: null,
      });
      continue;
    }
    if (attribute.dataType === "decimal") {
      if (
        input.valueDecimal === undefined ||
        input.valueDecimal === null ||
        input.valueText !== undefined ||
        input.valueBoolean !== undefined
      )
        throw error("A decimal value is required for this attribute.", {
          code: "ATTRIBUTE_VALUE_INVALID",
        });
      const unitCode = input.unitCode ?? attribute.unitCode ?? null;
      if (attribute.unitCode && unitCode !== attribute.unitCode)
        throw error("The attribute unit must match the configured unit.", {
          code: "ATTRIBUTE_UNIT_INVALID",
        });
      result.push({
        attributeId: attribute.id,
        attributeValueId: null,
        valueText: null,
        valueDecimal: input.valueDecimal,
        valueBoolean: null,
        unitCode,
      });
      continue;
    }
    if (attribute.dataType === "boolean") {
      if (
        input.valueBoolean === undefined ||
        input.valueText !== undefined ||
        input.valueDecimal !== undefined ||
        input.unitCode !== undefined
      )
        throw error("A boolean value is required for this attribute.", {
          code: "ATTRIBUTE_VALUE_INVALID",
        });
      result.push({
        attributeId: attribute.id,
        attributeValueId: null,
        valueText: null,
        valueDecimal: null,
        valueBoolean: input.valueBoolean,
        unitCode: null,
      });
    }
  }
  return result;
}

async function assertAttributeScope(
  productId,
  attributes,
  isVariantAttribute,
  transaction,
) {
  const mappings = await repository.findCategoryAttributeMappingsForProduct(
    productId,
    { transaction },
  );
  const scoped = mappingByAttribute(mappings, isVariantAttribute);
  for (const item of attributes) {
    if (!scoped.has(String(item.attributeId)))
      throw error(
        "One or more attributes are not available for this product scope.",
        { code: "ATTRIBUTE_SCOPE_INVALID" },
      );
  }
  return mappings;
}
async function assertVariantUnique(
  productId,
  payload,
  excludeId,
  transaction,
  current = {},
) {
  for (const [field, finder] of [
    ["sku", repository.findVariantBySku],
    ["barcode", repository.findVariantByBarcode],
  ]) {
    if (payload[field] !== undefined && payload[field] !== null) {
      const existing = await finder(payload[field], { transaction });
      if (existing && String(existing.id) !== String(excludeId))
        throw error(`The variant ${field} is already in use.`, {
          statusCode: 409,
          code: `VARIANT_${field.toUpperCase()}_EXISTS`,
        });
    }
  }
  const sizeId = payload.sizeId !== undefined ? payload.sizeId : current.sizeId;
  const colorId =
    payload.colorId !== undefined ? payload.colorId : current.colorId;
  const same = await repository.findVariantByCombination(
    productId,
    sizeId,
    colorId,
    { transaction },
  );
  if (same && String(same.id) !== String(excludeId))
    throw error("A variant with the same size and color already exists.", {
      statusCode: 409,
      code: "VARIANT_COMBINATION_EXISTS",
    });
}

export async function createVendorVariant({
  accountId,
  vendorId,
  productId,
  payload,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  let variant;
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    await assertVariantReferences(payload, transaction);
    await assertVariantUnique(productId, payload, null, transaction);
    const activeCount = await repository.countActiveVariants(productId, {
      transaction,
    });
    if (payload.isDefault)
      await repository.clearDefaultVariants(productId, null, { transaction });
    variant = await repository.createVariant(
      {
        ...payload,
        productId,
        isDefault: payload.isDefault ?? activeCount === 0,
        isActive: payload.isActive ?? true,
        sizeId: payload.sizeId ?? null,
        colorId: payload.colorId ?? null,
        barcode: payload.barcode ?? null,
        salePrice: payload.salePrice ?? null,
        costPrice: payload.costPrice ?? null,
        saleStartAt: payload.saleStartAt ?? null,
        saleEndAt: payload.saleEndAt ?? null,
        weightValue: payload.weightValue ?? null,
        weightUnit: payload.weightUnit ?? null,
        sortOrder: payload.sortOrder ?? 0,
      },
      { transaction },
    );
    await repository.createInventory(
      { variantId: variant.id },
      { transaction },
    );
    await resetApprovalIfApproved(product, transaction);
  });
  return productDto(await repository.findProductDetails(productId));
}

export async function updateVendorVariant({
  accountId,
  vendorId,
  productId,
  variantId,
  payload,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    const variant = await repository.findVariantById(productId, variantId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!variant)
      throw error("The requested variant could not be found.", {
        statusCode: 404,
        code: "VARIANT_NOT_FOUND",
      });
    const current = plain(variant);
    await assertVariantReferences(payload, transaction);
    await assertVariantUnique(
      productId,
      payload,
      variantId,
      transaction,
      current,
    );
    if (payload.isDefault)
      await repository.clearDefaultVariants(productId, variantId, {
        transaction,
      });
    await repository.updateVariant(variant, payload, { transaction });
    await resetApprovalIfApproved(product, transaction);
  });
  return productDto(await repository.findProductDetails(productId));
}

export async function deleteVendorVariant({
  accountId,
  vendorId,
  productId,
  variantId,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    const variant = await repository.findVariantById(productId, variantId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!variant)
      throw error("The requested variant could not be found.", {
        statusCode: 404,
        code: "VARIANT_NOT_FOUND",
      });
    await repository.destroyVariant(variant, { transaction });
    await resetApprovalIfApproved(product, transaction);
  });
}

export async function updateVendorInventory({
  accountId,
  vendorId,
  productId,
  variantId,
  payload,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await repository.withTransaction(async (transaction) => {
    await ownedProduct(productId, vendor.id, transaction);
    const variant = await repository.findVariantById(productId, variantId, {
      transaction,
    });
    if (!variant)
      throw error("The requested variant could not be found.", {
        statusCode: 404,
        code: "VARIANT_NOT_FOUND",
      });
    let inventory = await repository.findInventory(variantId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!inventory)
      inventory = await repository.createInventory(
        { variantId },
        { transaction },
      );
    const nextOnHand =
      payload.quantityOnHand ?? Number(inventory.quantityOnHand);
    if (nextOnHand < Number(inventory.quantityReserved))
      throw error("Quantity on hand cannot be lower than reserved inventory.", {
        code: "INVENTORY_BELOW_RESERVED",
      });
    await repository.updateInventory(
      inventory,
      { ...payload, stockVersion: Number(inventory.stockVersion) + 1 },
      { transaction },
    );
  });
  return productDto(await repository.findProductDetails(productId));
}

export async function getVendorProductSizeChart({
  accountId,
  vendorId,
  productId,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await ownedProduct(productId, vendor.id);
  const [details, requirementRecords, measurementRecords] = await Promise.all([
    repository.findProductDetails(productId),
    repository.findMeasurementRequirementsForProduct(productId),
    repository.findVariantMeasurements(productId),
  ]);
  const requirements = requirementRecords.map((requirementRecord) => {
    const item = plain(requirementRecord);
    return {
      categoryId: id(item.categoryId),
      category: item.category
        ? { code: item.category.code, slug: item.category.slug }
        : null,
      measurementTypeId: id(item.measurementTypeId),
      isRequired: bool(item.isRequired),
      sortOrder: Number(item.sortOrder ?? 0),
      measurementType: item.measurementType
        ? {
            code: item.measurementType.code,
            nameEn: item.measurementType.nameEn,
            nameIt: item.measurementType.nameIt,
            bodyRegion: item.measurementType.bodyRegion ?? null,
            measurementKind: item.measurementType.measurementKind,
            unitCode: item.measurementType.unitCode,
          }
        : null,
    };
  });
  const measurementsByVariant = new Map();
  for (const measurement of measurementRecords) {
    const record = plain(measurement);
    const items = measurementsByVariant.get(String(record.variantId)) ?? [];
    items.push(measurementDto(record));
    measurementsByVariant.set(String(record.variantId), items);
  }
  return {
    productId: id(productId),
    requirements,
    variants: details.variants.map((item) => {
      const variant = plain(item);
      return {
        variantId: id(variant.id),
        sku: variant.sku,
        size: variant.size
          ? {
              id: id(variant.size.id),
              code: variant.size.code,
              label: variant.size.label,
            }
          : null,
        measurements: measurementsByVariant.get(String(variant.id)) ?? [],
      };
    }),
  };
}

export async function replaceVendorVariantSizeChart({
  accountId,
  vendorId,
  productId,
  variantId,
  measurements,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    const variant = await repository.findVariantById(productId, variantId, {
      transaction,
    });
    if (!variant)
      throw error("The requested variant could not be found.", {
        statusCode: 404,
        code: "VARIANT_NOT_FOUND",
      });
    const requirements = measurementRequirementByType(
      await repository.findMeasurementRequirementsForProduct(productId, {
        transaction,
      }),
    );
    if (!requirements.size)
      throw error(
        "The selected product category does not define a size chart.",
        { code: "SIZE_CHART_NOT_AVAILABLE" },
      );
    for (const measurement of measurements)
      if (!requirements.has(String(measurement.measurementTypeId)))
        throw error(
          "One or more measurement types are not available for this product category.",
          { code: "MEASUREMENT_TYPE_NOT_ALLOWED" },
        );
    await repository.replaceVariantMeasurements(
      variantId,
      measurements.map((item) => ({
        ...item,
        tolerancePlusCm: item.tolerancePlusCm ?? 0,
        toleranceMinusCm: item.toleranceMinusCm ?? 0,
        source: "vendor",
        isEstimated: item.isEstimated ?? false,
        notes: item.notes ?? null,
      })),
      { transaction },
    );
    await resetApprovalIfApproved(product, transaction);
  });
  return getVendorProductSizeChart({ accountId, vendorId, productId });
}

export async function getVendorProductAttributes({
  accountId,
  vendorId,
  productId,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await ownedProduct(productId, vendor.id);
  const [details, mappings, values] = await Promise.all([
    repository.findProductDetails(productId),
    repository.findCategoryAttributeMappingsForProduct(productId),
    repository.findAllProductAttributeValues(productId),
  ]);
  const productAttributes = values
    .filter(
      (item) =>
        plain(item).variantId === null || plain(item).variantId === undefined,
    )
    .map(attributeValueDto);
  const variantAttributes = new Map();
  for (const item of values) {
    const record = plain(item);
    if (record.variantId === null || record.variantId === undefined) continue;
    const collection = variantAttributes.get(String(record.variantId)) ?? [];
    collection.push(attributeValueDto(record));
    variantAttributes.set(String(record.variantId), collection);
  }
  const mapped = new Map();
  for (const mappingRecord of mappings) {
    const mapping = plain(mappingRecord);
    const key = `${mapping.attributeId}:${bool(mapping.isVariantAttribute)}`;
    const existing = mapped.get(key);
    mapped.set(key, {
      ...mapping,
      isRequired: bool(mapping.isRequired) || bool(existing?.isRequired),
      attribute: mapping.attribute ?? existing?.attribute ?? null,
    });
  }
  const optionValues = await repository.findActiveAttributeValuesByAttributeIds(
    [...new Set([...mapped.values()].map((mapping) => mapping.attributeId))],
  );
  const optionValuesByAttribute = new Map();
  for (const optionRecord of optionValues) {
    const option = plain(optionRecord);
    const collection =
      optionValuesByAttribute.get(String(option.attributeId)) ?? [];
    collection.push({
      id: id(option.id),
      code: option.code,
      labelEn: option.labelEn,
      labelIt: option.labelIt,
      sortOrder: Number(option.sortOrder ?? 0),
    });
    optionValuesByAttribute.set(String(option.attributeId), collection);
  }
  return {
    productId: id(productId),
    definitions: [...mapped.values()].map((mapping) => ({
      categoryId: id(mapping.categoryId),
      attributeId: id(mapping.attributeId),
      isRequired: bool(mapping.isRequired),
      isVariantAttribute: bool(mapping.isVariantAttribute),
      sortOrder: Number(mapping.sortOrder ?? 0),
      attribute: mapping.attribute
        ? {
            code: mapping.attribute.code,
            nameEn: mapping.attribute.nameEn,
            nameIt: mapping.attribute.nameIt,
            dataType: mapping.attribute.dataType,
            inputType: mapping.attribute.inputType,
            unitCode: mapping.attribute.unitCode ?? null,
            allowsMultiple: bool(mapping.attribute.allowsMultiple),
            optionValues:
              optionValuesByAttribute.get(String(mapping.attributeId)) ?? [],
          }
        : null,
    })),
    productAttributes,
    variants: details.variants.map((item) => {
      const variant = plain(item);
      return {
        variantId: id(variant.id),
        sku: variant.sku,
        attributes: variantAttributes.get(String(variant.id)) ?? [],
      };
    }),
  };
}

async function replaceVendorAttributes({
  accountId,
  vendorId,
  productId,
  variantId,
  attributes,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    if (variantId) {
      const variant = await repository.findVariantById(productId, variantId, {
        transaction,
      });
      if (!variant)
        throw error("The requested variant could not be found.", {
          statusCode: 404,
          code: "VARIANT_NOT_FOUND",
        });
    }
    const mappings = await assertAttributeScope(
      productId,
      attributes,
      Boolean(variantId),
      transaction,
    );
    const values = await valuesForAttributes(attributes, mappings, transaction);
    await repository.replaceProductAttributeValues({
      productId,
      variantId,
      values,
      transaction,
    });
    await resetApprovalIfApproved(product, transaction);
  });
  return getVendorProductAttributes({ accountId, vendorId, productId });
}

export function replaceVendorProductAttributes(input) {
  return replaceVendorAttributes({ ...input, variantId: null });
}
export function replaceVendorVariantAttributes(input) {
  return replaceVendorAttributes(input);
}

async function uploadImage(file, productId, accountId) {
  let processed;
  try {
    processed = await processImage({
      buffer: file.buffer,
      claimedMimeType: file.claimedMimeType,
      policy: "product",
    });
  } catch (caught) {
    if (caught instanceof MediaValidationError)
      throw error("One or more product images are invalid.", {
        code: "PRODUCT_MEDIA_INVALID",
      });
    throw caught;
  }
  return uploadProcessedImage({
    processedImage: processed,
    storageKey: buildProductUploadKey(productId, randomUUID()),
    cacheControl: "private, max-age=300",
    contentDisposition: "inline",
    serverSideEncryption: "AES256",
    metadata: {
      "asset-type": "product-image",
      "product-id": String(productId),
      "uploaded-by-account-id": String(accountId),
    },
  });
}

export async function uploadVendorProductMedia({
  accountId,
  vendorId,
  productId,
  files,
  payload,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  if (!files?.length)
    throw error("At least one product image is required.", {
      code: "PRODUCT_MEDIA_REQUIRED",
    });
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    if (payload.variantId) {
      const variant = await repository.findVariantById(
        productId,
        payload.variantId,
        { transaction },
      );
      if (!variant)
        throw error("The selected variant could not be found.", {
          code: "MEDIA_VARIANT_INVALID",
        });
    }
  });
  const uploaded = [];
  try {
    for (const file of files)
      uploaded.push(await uploadImage(file, productId, accountId));
    await repository.withTransaction(async (transaction) => {
      const product = await ownedProduct(productId, vendor.id, transaction);
      assertEditable(plain(product));
      const count = await repository.countMedia(productId, { transaction });
      if (payload.isPrimary)
        await repository.clearPrimaryMedia(productId, null, { transaction });
      for (const [index, item] of uploaded.entries())
        await repository.createMedia(
          {
            productId,
            variantId: payload.variantId ?? null,
            mediaType: "image",
            storageKey: item.storageKey,
            mimeType: item.contentType,
            width: item.width,
            height: item.height,
            altText: payload.altText ?? null,
            sortOrder: (payload.sortOrder ?? 0) + index,
            isPrimary: payload.isPrimary
              ? index === 0
              : count === 0 && index === 0,
            moderationStatus: "pending",
          },
          { transaction },
        );
      await resetApprovalIfApproved(product, transaction);
    });
  } catch (caught) {
    await Promise.allSettled(
      uploaded.map((item) => deleteStoredMedia(item.storageKey)),
    );
    throw caught;
  }
  return productDto(await repository.findProductDetails(productId));
}

export async function updateVendorProductMedia({
  accountId,
  vendorId,
  productId,
  mediaId,
  payload,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    const media = await repository.findMediaById(productId, mediaId, {
      transaction,
    });
    if (!media)
      throw error("The requested product image could not be found.", {
        statusCode: 404,
        code: "MEDIA_NOT_FOUND",
      });
    if (payload.isPrimary)
      await repository.clearPrimaryMedia(productId, mediaId, { transaction });
    await repository.updateMedia(media, payload, { transaction });
    await resetApprovalIfApproved(product, transaction);
  });
  return productDto(await repository.findProductDetails(productId));
}

export async function deleteVendorProductMedia({
  accountId,
  vendorId,
  productId,
  mediaId,
}) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  let storageKey;
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    const media = await repository.findMediaById(productId, mediaId, {
      transaction,
    });
    if (!media)
      throw error("The requested product image could not be found.", {
        statusCode: 404,
        code: "MEDIA_NOT_FOUND",
      });
    storageKey = media.storageKey;
    await repository.destroyMedia(media, { transaction });
    await resetApprovalIfApproved(product, transaction);
  });
  try {
    await deleteStoredMedia(storageKey);
  } catch {
    /* DB state safely no longer references this media. */
  }
}

async function assertSubmittable(productId, transaction) {
  const details = await repository.findProductDetails(productId, {
    transaction,
  });
  const product = plain(details.product);
  if (!details.categories.length)
    throw error(
      "Select at least one category before submitting this product.",
      { code: "PRODUCT_CATEGORY_REQUIRED" },
    );
  if (!details.translations.some((item) => plain(item).name?.trim()))
    throw error(
      "Add at least one product name before submitting this product.",
      { code: "PRODUCT_TRANSLATION_REQUIRED" },
    );
  if (!details.variants.some((item) => bool(plain(item).isActive)))
    throw error(
      "Add at least one active variant before submitting this product.",
      { code: "PRODUCT_VARIANT_REQUIRED" },
    );
  if (!details.media.length)
    throw error(
      "Upload at least one product image before submitting this product.",
      { code: "PRODUCT_MEDIA_REQUIRED" },
    );
  const [mappings, requirements, allValues, measurements] = await Promise.all([
    repository.findCategoryAttributeMappingsForProduct(productId, {
      transaction,
    }),
    repository.findMeasurementRequirementsForProduct(productId, {
      transaction,
    }),
    repository.findAllProductAttributeValues(productId, { transaction }),
    repository.findVariantMeasurements(productId, { transaction }),
  ]);
  const valueKeys = new Set(
    allValues.map((item) => {
      const value = plain(item);
      return `${value.variantId ?? "product"}:${value.attributeId}`;
    }),
  );
  for (const mappingRecord of mappings) {
    const mapping = plain(mappingRecord);
    if (!bool(mapping.isRequired)) continue;
    if (bool(mapping.isVariantAttribute)) {
      for (const variantRecord of details.variants) {
        const variant = plain(variantRecord);
        if (
          bool(variant.isActive) &&
          !valueKeys.has(`${variant.id}:${mapping.attributeId}`)
        )
          throw error(
            "Complete all required variant attributes before submitting this product.",
            { code: "VARIANT_ATTRIBUTE_REQUIRED" },
          );
      }
    } else if (!valueKeys.has(`product:${mapping.attributeId}`))
      throw error(
        "Complete all required product attributes before submitting this product.",
        { code: "PRODUCT_ATTRIBUTE_REQUIRED" },
      );
  }
  const requiredMeasurements = [
    ...measurementRequirementByType(requirements).values(),
  ].filter((item) => bool(item.isRequired));
  if (requiredMeasurements.length) {
    const measurementKeys = new Set(
      measurements.map((item) => {
        const value = plain(item);
        return `${value.variantId}:${value.measurementTypeId}`;
      }),
    );
    for (const variantRecord of details.variants) {
      const variant = plain(variantRecord);
      if (!bool(variant.isActive)) continue;
      for (const requirement of requiredMeasurements)
        if (
          !measurementKeys.has(`${variant.id}:${requirement.measurementTypeId}`)
        )
          throw error(
            "Complete all required size-chart measurements before submitting this product.",
            { code: "SIZE_CHART_REQUIRED" },
          );
    }
  }
  if (!product.brandId && !product.fitProfileId) {
    /* Both are optional catalog mappings. */
  }
}

export async function submitVendorProduct({ accountId, vendorId, productId }) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    await assertSubmittable(productId, transaction);
    await repository.updateProduct(
      product,
      { approvalStatus: "pending", rejectionReason: null },
      { transaction },
    );
  });
  return productDto(await repository.findProductDetails(productId));
}

export async function deleteVendorProduct({ accountId, vendorId, productId }) {
  const { vendor } = await resolveVendorContext({ accountId, vendorId });
  let storageKeys = [];
  await repository.withTransaction(async (transaction) => {
    const product = await ownedProduct(productId, vendor.id, transaction);
    assertEditable(plain(product));
    const details = await repository.findProductDetails(productId, {
      transaction,
    });
    storageKeys = details.media.map((item) => plain(item).storageKey);
    await repository.destroyProduct(product, { transaction });
  });
  await Promise.allSettled(storageKeys.map((key) => deleteStoredMedia(key)));
}

export { productDto, assertSubmittable };
