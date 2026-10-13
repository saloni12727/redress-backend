import { Op } from "sequelize";

import { sequelize } from "../../config/database.js";
import {
  Attribute, AttributeValue, Brand, Category, CategoryAttribute,
  CategoryMeasurementRequirement, Color, FitProfile, GarmentMeasurement,
  GarmentMeasurementType, Inventory, Product, ProductAttributeValue,
  ProductCategory, ProductMedia, ProductTranslation, ProductVariant, Size,
  Vendor, VendorUser,
} from "../../models/index.js";

export function withTransaction(callback) { return sequelize.transaction(callback); }

export function findMembership(accountId, vendorId, options = {}) {
  const where = { accountId, status: "active" };
  if (vendorId) where.vendorId = vendorId;
  return VendorUser.findAll({ where, include: [{ model: Vendor, as: "vendor" }], order: [["isOwner", "DESC"], ["vendorId", "ASC"]], ...options });
}

export function findProductByIdForVendor(id, vendorId, options = {}) { return Product.findOne({ where: { id, vendorId }, ...options }); }
export function findProductById(id, options = {}) { return Product.findByPk(id, options); }
export function findProductByCode(code, options = {}) { return Product.findOne({ where: { code }, paranoid: false, ...options }); }
export function findProductBySlug(slug, options = {}) { return Product.findOne({ where: { slug }, paranoid: false, ...options }); }
export function createProduct(values, options = {}) { return Product.create(values, options); }
export function updateProduct(product, values, options = {}) { return product.update(values, options); }
export function destroyProduct(product, options = {}) { return product.destroy(options); }

export async function findProductsForVendor(vendorId, filters) {
  const where = { vendorId };
  if (filters.status) where.status = filters.status;
  if (filters.approvalStatus) where.approvalStatus = filters.approvalStatus;
  if (filters.q) where[Op.or] = [{ code: { [Op.like]: `%${filters.q}%` } }, { slug: { [Op.like]: `%${filters.q}%` } }];
  const result = await Product.findAndCountAll({ where, order: [["updatedAt", "DESC"], ["id", "DESC"]], limit: filters.limit, offset: (filters.page - 1) * filters.limit });
  return { rows: result.rows, total: result.count };
}

export async function findSubmittedProducts(filters) {
  const where = { status: "draft", approvalStatus: "pending" };
  if (filters.q) where[Op.or] = [{ code: { [Op.like]: `%${filters.q}%` } }, { slug: { [Op.like]: `%${filters.q}%` } }];
  const result = await Product.findAndCountAll({
    where,
    include: [{ model: Vendor, as: "vendor" }, { model: Brand, as: "brand" }],
    order: [["updatedAt", "ASC"], ["id", "ASC"]],
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
  });
  return { rows: result.rows, total: result.count };
}

export async function findProductDetails(productId, options = {}) {
  const [product, translations, categories, variants, media] = await Promise.all([
    Product.findByPk(productId, { include: [{ model: Brand, as: "brand" }, { model: FitProfile, as: "fitProfile" }, { model: Vendor, as: "vendor" }], ...options }),
    ProductTranslation.findAll({ where: { productId }, order: [["languageCode", "ASC"]], ...options }),
    ProductCategory.findAll({ where: { productId }, include: [{ model: Category, as: "category" }], order: [["isPrimary", "DESC"], ["sortOrder", "ASC"], ["id", "ASC"]], ...options }),
    ProductVariant.findAll({ where: { productId }, include: [{ model: Size, as: "size" }, { model: Color, as: "color" }, { model: Inventory, as: "inventory" }], order: [["isDefault", "DESC"], ["sortOrder", "ASC"], ["id", "ASC"]], ...options }),
    ProductMedia.findAll({ where: { productId }, order: [["isPrimary", "DESC"], ["sortOrder", "ASC"], ["id", "ASC"]], ...options }),
  ]);
  return { product, translations, categories, variants, media };
}

export function findActiveBrand(id, options = {}) { return Brand.findOne({ where: { id, isActive: true }, ...options }); }
export function findActiveFitProfile(id, options = {}) { return FitProfile.findOne({ where: { id, isActive: true }, ...options }); }
export function findActiveCategories(ids, options = {}) { return Category.findAll({ where: { id: ids, isActive: true }, ...options }); }
export function replaceProductCategories(productId, categories, options = {}) { return ProductCategory.destroy({ where: { productId }, ...options }).then(() => ProductCategory.bulkCreate(categories.map((item) => ({ productId, ...item })), options)); }
export function upsertTranslations(productId, translations, options = {}) { return Promise.all(translations.map((item) => ProductTranslation.upsert({ productId, ...item }, options))); }

export function findVariantById(productId, id, options = {}) { return ProductVariant.findOne({ where: { id, productId }, ...options }); }
export function findVariantBySku(sku, options = {}) { return ProductVariant.findOne({ where: { sku }, paranoid: false, ...options }); }
export function findVariantByBarcode(barcode, options = {}) { return ProductVariant.findOne({ where: { barcode }, paranoid: false, ...options }); }
export function findVariantByCombination(productId, sizeId, colorId, options = {}) { return ProductVariant.findOne({ where: { productId, sizeId: sizeId ?? null, colorId: colorId ?? null }, paranoid: false, ...options }); }
export function createVariant(values, options = {}) { return ProductVariant.create(values, options); }
export function updateVariant(variant, values, options = {}) { return variant.update(values, options); }
export function destroyVariant(variant, options = {}) { return variant.destroy(options); }
export function clearDefaultVariants(productId, exceptId, options = {}) { return ProductVariant.update({ isDefault: false }, { where: { productId, ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}) }, ...options }); }
export function countActiveVariants(productId, options = {}) { return ProductVariant.count({ where: { productId, isActive: true }, ...options }); }
export function findActiveSize(id, options = {}) { return Size.findOne({ where: { id, isActive: true }, include: [{ association: "sizeSystem", where: { isActive: true } }], ...options }); }
export function findActiveColor(id, options = {}) { return Color.findOne({ where: { id, isActive: true }, ...options }); }
export function findInventory(variantId, options = {}) { return Inventory.findOne({ where: { variantId }, ...options }); }
export function createInventory(values, options = {}) { return Inventory.create(values, options); }
export function updateInventory(inventory, values, options = {}) { return inventory.update(values, options); }

export function findMediaById(productId, id, options = {}) { return ProductMedia.findOne({ where: { id, productId }, ...options }); }
export function createMedia(values, options = {}) { return ProductMedia.create(values, options); }
export function updateMedia(media, values, options = {}) { return media.update(values, options); }
export function destroyMedia(media, options = {}) { return media.destroy(options); }
export function countMedia(productId, options = {}) { return ProductMedia.count({ where: { productId }, ...options }); }
export function clearPrimaryMedia(productId, exceptId, options = {}) { return ProductMedia.update({ isPrimary: false }, { where: { productId, ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}) }, ...options }); }
export function approveProductMedia(productId, approvedAt, options = {}) { return ProductMedia.update({ moderationStatus: "approved", approvedAt }, { where: { productId, moderationStatus: "pending" }, ...options }); }

export async function findMeasurementRequirementsForProduct(productId, options = {}) {
  const categories = await ProductCategory.findAll({
    where: { productId },
    include: [{ model: Category, as: "category", where: { isActive: true } }],
    ...options,
  });
  const categoryIds = categories.map((item) => item.categoryId);
  if (!categoryIds.length) return [];
  return CategoryMeasurementRequirement.findAll({
    where: { categoryId: categoryIds, isActive: true },
    include: [
      { model: Category, as: "category" },
      { model: GarmentMeasurementType, as: "measurementType", where: { isActive: true } },
    ],
    order: [["sortOrder", "ASC"], ["id", "ASC"]],
    ...options,
  });
}

export function findVariantMeasurements(productId, options = {}) {
  return GarmentMeasurement.findAll({
    include: [
      { model: ProductVariant, as: "variant", where: { productId } },
      { model: GarmentMeasurementType, as: "measurementType" },
    ],
    order: [["variantId", "ASC"], ["measurementTypeId", "ASC"]],
    ...options,
  });
}

export function findVariantMeasurementsByVariant(variantId, options = {}) {
  return GarmentMeasurement.findAll({
    where: { variantId },
    include: [{ model: GarmentMeasurementType, as: "measurementType" }],
    order: [["measurementTypeId", "ASC"]],
    ...options,
  });
}

export async function replaceVariantMeasurements(variantId, measurements, options = {}) {
  await GarmentMeasurement.destroy({ where: { variantId }, ...options });
  return GarmentMeasurement.bulkCreate(
    measurements.map((item) => ({ variantId, ...item })),
    options,
  );
}

export async function findCategoryAttributeMappingsForProduct(productId, options = {}) {
  const categories = await ProductCategory.findAll({
    where: { productId },
    include: [{ model: Category, as: "category", where: { isActive: true } }],
    ...options,
  });
  const categoryIds = categories.map((item) => item.categoryId);
  if (!categoryIds.length) return [];
  return CategoryAttribute.findAll({
    where: { categoryId: categoryIds, isActive: true },
    include: [{ model: Attribute, as: "attribute", where: { isActive: true } }],
    order: [["sortOrder", "ASC"], ["id", "ASC"]],
    ...options,
  });
}

export function findProductAttributeValues(productId, variantId, options = {}) {
  return ProductAttributeValue.findAll({
    where: { productId, variantId: variantId ?? null },
    include: [
      { model: Attribute, as: "attribute" },
      { model: AttributeValue, as: "optionValue" },
    ],
    order: [["attributeId", "ASC"], ["id", "ASC"]],
    ...options,
  });
}

export function findAllProductAttributeValues(productId, options = {}) {
  return ProductAttributeValue.findAll({
    where: { productId },
    include: [
      { model: Attribute, as: "attribute" },
      { model: AttributeValue, as: "optionValue" },
      { model: ProductVariant, as: "variant" },
    ],
    order: [["variantId", "ASC"], ["attributeId", "ASC"], ["id", "ASC"]],
    ...options,
  });
}

export function findActiveAttributeValues(ids, options = {}) {
  return AttributeValue.findAll({ where: { id: ids, isActive: true }, ...options });
}

export function findActiveAttributeValuesByAttributeIds(attributeIds, options = {}) {
  if (!attributeIds.length) return Promise.resolve([]);
  return AttributeValue.findAll({
    where: { attributeId: attributeIds, isActive: true },
    order: [["attributeId", "ASC"], ["sortOrder", "ASC"], ["id", "ASC"]],
    ...options,
  });
}

export async function replaceProductAttributeValues({ productId, variantId, values, transaction }) {
  await ProductAttributeValue.destroy({ where: { productId, variantId: variantId ?? null }, transaction });
  if (values.length) await ProductAttributeValue.bulkCreate(values.map((item) => ({ productId, variantId: variantId ?? null, ...item })), { transaction });
}
