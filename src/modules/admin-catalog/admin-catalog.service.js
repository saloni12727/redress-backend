import { AdminCatalogError, catalogNotFound } from "./admin-catalog.error.js";
import * as repository from "./admin-catalog.repository.js";

function toPlain(value) {
  return typeof value?.get === "function" ? value.get({ plain: true }) : value;
}

function id(value) {
  return value === null || value === undefined ? null : String(value);
}

function boolean(value) {
  return value === true || value === 1 || value === "1";
}

function isoDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hasOwn(object, field) {
  return Object.prototype.hasOwnProperty.call(object, field);
}

function fields(payload, allowed) {
  return Object.fromEntries(
    allowed
      .filter((field) => hasOwn(payload, field))
      .map((field) => [field, payload[field]]),
  );
}

function page(result, filters, mapper) {
  return {
    items: result.rows.map(mapper),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / filters.limit),
    },
  };
}

function conflict(message, code) {
  return new AdminCatalogError(message, { statusCode: 409, code });
}

function invalid(message, code) {
  return new AdminCatalogError(message, { statusCode: 422, code });
}

function dependencyError(resource) {
  return conflict(
    `This ${resource} cannot be deleted while it is used by related records.`,
    `${resource.toUpperCase().replaceAll(" ", "_")}_HAS_DEPENDENCIES`,
  );
}

function hasDependencies(dependencies) {
  return Object.values(dependencies).some((value) => Number(value) > 0);
}

async function requireRecord(finder, resource, idValue) {
  const record = await finder(idValue);

  if (!record) {
    throw catalogNotFound(resource);
  }

  return record;
}

async function assertCodeAvailable(finder, code, currentId, resource) {
  if (code === undefined) {
    return;
  }

  const existing = await finder(code);

  if (existing && String(existing.id) !== String(currentId)) {
    throw conflict(
      `The ${resource} code is already in use.`,
      `${resource.toUpperCase().replaceAll(" ", "_")}_CODE_EXISTS`,
    );
  }
}

function modelDto(input, additional = {}) {
  const value = toPlain(input);

  return {
    id: id(value.id),
    ...additional(value),
    createdAt: isoDate(value.createdAt),
    updatedAt: isoDate(value.updatedAt),
  };
}

export const colorDto = (input) =>
  modelDto(input, (value) => ({
    code: value.code,
    name: value.name,
    hexCode: value.hexCode ?? null,
    sortOrder: Number(value.sortOrder ?? 0),
    isActive: boolean(value.isActive),
  }));

export const sizeSystemDto = (input) =>
  modelDto(input, (value) => ({
    code: value.code,
    name: value.name,
    isActive: boolean(value.isActive),
  }));

export const sizeDto = (input) =>
  modelDto(input, (value) => ({
    sizeSystemId: id(value.sizeSystemId),
    code: value.code,
    label: value.label,
    sortOrder: Number(value.sortOrder ?? 0),
    isActive: boolean(value.isActive),
  }));

export const fitProfileDto = (input) =>
  modelDto(input, (value) => ({
    code: value.code,
    name: value.name,
    sortOrder: Number(value.sortOrder ?? 0),
    isActive: boolean(value.isActive),
  }));

export const attributeDto = (input) =>
  modelDto(input, (value) => ({
    code: value.code,
    nameEn: value.nameEn,
    nameIt: value.nameIt,
    dataType: value.dataType,
    inputType: value.inputType,
    unitCode: value.unitCode ?? null,
    allowsMultiple: boolean(value.allowsMultiple),
    isFilterable: boolean(value.isFilterable),
    isSearchable: boolean(value.isSearchable),
    sortOrder: Number(value.sortOrder ?? 0),
    isActive: boolean(value.isActive),
  }));

export const attributeValueDto = (input) =>
  modelDto(input, (value) => ({
    attributeId: id(value.attributeId),
    code: value.code,
    labelEn: value.labelEn,
    labelIt: value.labelIt,
    sortOrder: Number(value.sortOrder ?? 0),
    isActive: boolean(value.isActive),
  }));

export const categoryAttributeDto = (input) =>
  modelDto(input, (value) => ({
    categoryId: id(value.categoryId),
    attributeId: id(value.attributeId),
    isRequired: boolean(value.isRequired),
    isFilterable: boolean(value.isFilterable),
    isVariantAttribute: boolean(value.isVariantAttribute),
    sortOrder: Number(value.sortOrder ?? 0),
    isActive: boolean(value.isActive),
  }));

export async function listAdminColors(filters) {
  return page(await repository.findColors(filters), filters, colorDto);
}

export async function getAdminColor(idValue) {
  return colorDto(await requireRecord(repository.findColorById, "color", idValue));
}

export async function createAdminColor(payload) {
  await assertCodeAvailable(repository.findColorByCode, payload.code, null, "color");

  try {
    return colorDto(
      await repository.createColor({
        ...fields(payload, ["code", "name", "hexCode", "sortOrder", "isActive"]),
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      }),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict("The color code is already in use.", "COLOR_CODE_EXISTS");
    }
    throw error;
  }
}

export async function updateAdminColor(idValue, payload) {
  const color = await requireRecord(repository.findColorById, "color", idValue);
  await assertCodeAvailable(repository.findColorByCode, payload.code, color.id, "color");

  try {
    return colorDto(
      await repository.updateRecord(
        color,
        fields(payload, ["code", "name", "hexCode", "sortOrder", "isActive"]),
      ),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict("The color code is already in use.", "COLOR_CODE_EXISTS");
    }
    throw error;
  }
}

export async function deleteAdminColor(idValue) {
  const color = await requireRecord(repository.findColorById, "color", idValue);
  if (hasDependencies(await repository.findDependencies("color", idValue))) {
    throw dependencyError("color");
  }
  await repository.destroyRecord(color);
}

export async function listAdminSizeSystems(filters) {
  return page(await repository.findSizeSystems(filters), filters, sizeSystemDto);
}

export async function getAdminSizeSystem(idValue) {
  return sizeSystemDto(
    await requireRecord(repository.findSizeSystemById, "size system", idValue),
  );
}

export async function createAdminSizeSystem(payload) {
  await assertCodeAvailable(
    repository.findSizeSystemByCode,
    payload.code,
    null,
    "size system",
  );
  try {
    return sizeSystemDto(
      await repository.createSizeSystem({
        ...fields(payload, ["code", "name", "isActive"]),
        isActive: payload.isActive ?? true,
      }),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict("The size system code is already in use.", "SIZE_SYSTEM_CODE_EXISTS");
    }
    throw error;
  }
}

export async function updateAdminSizeSystem(idValue, payload) {
  const system = await requireRecord(
    repository.findSizeSystemById,
    "size system",
    idValue,
  );
  await assertCodeAvailable(
    repository.findSizeSystemByCode,
    payload.code,
    system.id,
    "size system",
  );
  try {
    return sizeSystemDto(
      await repository.updateRecord(system, fields(payload, ["code", "name", "isActive"])),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict("The size system code is already in use.", "SIZE_SYSTEM_CODE_EXISTS");
    }
    throw error;
  }
}

export async function deleteAdminSizeSystem(idValue) {
  const system = await requireRecord(
    repository.findSizeSystemById,
    "size system",
    idValue,
  );
  if (hasDependencies(await repository.findDependencies("size system", idValue))) {
    throw dependencyError("size system");
  }
  await repository.destroyRecord(system);
}

async function assertActiveSizeSystem(sizeSystemId, isActive) {
  const system = await requireRecord(
    repository.findSizeSystemById,
    "size system",
    sizeSystemId,
  );

  if (isActive && !boolean(system.isActive)) {
    throw invalid("An active size must belong to an active size system.", "SIZE_SYSTEM_INACTIVE");
  }

  return system;
}

export async function listAdminSizes(filters) {
  return page(await repository.findSizes(filters), filters, sizeDto);
}

export async function getAdminSize(idValue) {
  return sizeDto(await requireRecord(repository.findSizeById, "size", idValue));
}

export async function createAdminSize(payload) {
  await assertActiveSizeSystem(payload.sizeSystemId, payload.isActive ?? true);
  await assertCodeAvailable(
    (code) => repository.findSizeBySystemAndCode(payload.sizeSystemId, code),
    payload.code,
    null,
    "size",
  );

  try {
    return sizeDto(
      await repository.createSize({
        ...fields(payload, ["sizeSystemId", "code", "label", "sortOrder", "isActive"]),
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      }),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict("This size code already exists in the selected size system.", "SIZE_CODE_EXISTS");
    }
    throw error;
  }
}

export async function updateAdminSize(idValue, payload) {
  const size = await requireRecord(repository.findSizeById, "size", idValue);
  const nextSystemId = payload.sizeSystemId ?? size.sizeSystemId;
  const nextIsActive = payload.isActive ?? boolean(size.isActive);

  await assertActiveSizeSystem(nextSystemId, nextIsActive);
  await assertCodeAvailable(
    (code) => repository.findSizeBySystemAndCode(nextSystemId, code),
    payload.code ?? size.code,
    size.id,
    "size",
  );

  try {
    return sizeDto(
      await repository.updateRecord(
        size,
        fields(payload, ["sizeSystemId", "code", "label", "sortOrder", "isActive"]),
      ),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict("This size code already exists in the selected size system.", "SIZE_CODE_EXISTS");
    }
    throw error;
  }
}

export async function deleteAdminSize(idValue) {
  const size = await requireRecord(repository.findSizeById, "size", idValue);
  if (hasDependencies(await repository.findDependencies("size", idValue))) {
    throw dependencyError("size");
  }
  await repository.destroyRecord(size);
}

export async function listAdminFitProfiles(filters) {
  return page(await repository.findFitProfiles(filters), filters, fitProfileDto);
}

export async function getAdminFitProfile(idValue) {
  return fitProfileDto(
    await requireRecord(repository.findFitProfileById, "fit profile", idValue),
  );
}

export async function createAdminFitProfile(payload) {
  await assertCodeAvailable(repository.findFitProfileByCode, payload.code, null, "fit profile");
  try {
    return fitProfileDto(
      await repository.createFitProfile({
        ...fields(payload, ["code", "name", "sortOrder", "isActive"]),
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      }),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict("The fit profile code is already in use.", "FIT_PROFILE_CODE_EXISTS");
    }
    throw error;
  }
}

export async function updateAdminFitProfile(idValue, payload) {
  const profile = await requireRecord(
    repository.findFitProfileById,
    "fit profile",
    idValue,
  );
  await assertCodeAvailable(repository.findFitProfileByCode, payload.code, profile.id, "fit profile");
  try {
    return fitProfileDto(
      await repository.updateRecord(
        profile,
        fields(payload, ["code", "name", "sortOrder", "isActive"]),
      ),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict("The fit profile code is already in use.", "FIT_PROFILE_CODE_EXISTS");
    }
    throw error;
  }
}

export async function deleteAdminFitProfile(idValue) {
  const profile = await requireRecord(
    repository.findFitProfileById,
    "fit profile",
    idValue,
  );
  if (hasDependencies(await repository.findDependencies("fit profile", idValue))) {
    throw dependencyError("fit profile");
  }
  await repository.destroyRecord(profile);
}

function attributeConfiguration(payload, current = {}) {
  const configuration = {
    dataType: payload.dataType ?? current.dataType,
    inputType: payload.inputType ?? current.inputType,
    allowsMultiple: payload.allowsMultiple ?? boolean(current.allowsMultiple),
    unitCode: hasOwn(payload, "unitCode") ? payload.unitCode : (current.unitCode ?? null),
  };
  const inputTypes = {
    option: new Set(["select", "multiselect"]),
    text: new Set(["text"]),
    decimal: new Set(["number"]),
    boolean: new Set(["toggle"]),
  };

  if (!inputTypes[configuration.dataType]?.has(configuration.inputType)) {
    throw invalid(
      "The input type is not compatible with the selected attribute data type.",
      "ATTRIBUTE_INPUT_TYPE_INVALID",
    );
  }

  if (
    configuration.allowsMultiple !==
    (configuration.dataType === "option" && configuration.inputType === "multiselect")
  ) {
    throw invalid(
      "Multiple values are allowed only for option attributes using a multiselect input.",
      "ATTRIBUTE_MULTIPLE_VALUES_INVALID",
    );
  }

  if (configuration.dataType !== "decimal" && configuration.unitCode) {
    throw invalid(
      "A unit code is allowed only for decimal attributes.",
      "ATTRIBUTE_UNIT_INVALID",
    );
  }

  return configuration;
}

export async function listAdminAttributes(filters) {
  return page(await repository.findAttributes(filters), filters, attributeDto);
}

export async function getAdminAttribute(idValue) {
  return attributeDto(
    await requireRecord(repository.findAttributeById, "attribute", idValue),
  );
}

export async function createAdminAttribute(payload) {
  attributeConfiguration(payload);
  await assertCodeAvailable(repository.findAttributeByCode, payload.code, null, "attribute");
  try {
    return attributeDto(
      await repository.createAttribute({
        ...fields(payload, [
          "code",
          "nameEn",
          "nameIt",
          "dataType",
          "inputType",
          "unitCode",
          "allowsMultiple",
          "isFilterable",
          "isSearchable",
          "sortOrder",
          "isActive",
        ]),
        unitCode: payload.unitCode ?? null,
        allowsMultiple: payload.allowsMultiple ?? false,
        isFilterable: payload.isFilterable ?? true,
        isSearchable: payload.isSearchable ?? false,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      }),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict("The attribute code is already in use.", "ATTRIBUTE_CODE_EXISTS");
    }
    throw error;
  }
}

export async function updateAdminAttribute(idValue, payload) {
  const attribute = await requireRecord(repository.findAttributeById, "attribute", idValue);
  const current = toPlain(attribute);
  const configuration = attributeConfiguration(payload, current);

  if (configuration.dataType !== "option" && current.dataType === "option") {
    const valueCount = await repository.countAttributeValues(idValue);
    if (valueCount > 0) {
      throw conflict(
        "An attribute with option values cannot be changed to another data type.",
        "ATTRIBUTE_VALUES_EXIST",
      );
    }
  }

  await assertCodeAvailable(repository.findAttributeByCode, payload.code, attribute.id, "attribute");
  try {
    return attributeDto(
      await repository.updateRecord(
        attribute,
        fields(payload, [
          "code",
          "nameEn",
          "nameIt",
          "dataType",
          "inputType",
          "unitCode",
          "allowsMultiple",
          "isFilterable",
          "isSearchable",
          "sortOrder",
          "isActive",
        ]),
      ),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict("The attribute code is already in use.", "ATTRIBUTE_CODE_EXISTS");
    }
    throw error;
  }
}

export async function deleteAdminAttribute(idValue) {
  const attribute = await requireRecord(repository.findAttributeById, "attribute", idValue);
  if (hasDependencies(await repository.findDependencies("attribute", idValue))) {
    throw dependencyError("attribute");
  }
  await repository.destroyRecord(attribute);
}

async function requireOptionAttribute(attributeId) {
  const attribute = await requireRecord(
    repository.findAttributeById,
    "attribute",
    attributeId,
  );

  if (attribute.dataType !== "option") {
    throw invalid(
      "Values can be managed only for option attributes.",
      "ATTRIBUTE_VALUES_NOT_SUPPORTED",
    );
  }

  return attribute;
}

export async function listAdminAttributeValues(filters) {
  return page(await repository.findAttributeValues(filters), filters, attributeValueDto);
}

export async function getAdminAttributeValue(idValue) {
  return attributeValueDto(
    await requireRecord(repository.findAttributeValueById, "attribute value", idValue),
  );
}

export async function createAdminAttributeValue(payload) {
  await requireOptionAttribute(payload.attributeId);
  await assertCodeAvailable(
    (code) => repository.findAttributeValueByAttributeAndCode(payload.attributeId, code),
    payload.code,
    null,
    "attribute value",
  );
  try {
    return attributeValueDto(
      await repository.createAttributeValue({
        ...fields(payload, ["attributeId", "code", "labelEn", "labelIt", "sortOrder", "isActive"]),
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      }),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict(
        "This value code already exists for the selected attribute.",
        "ATTRIBUTE_VALUE_CODE_EXISTS",
      );
    }
    throw error;
  }
}

export async function updateAdminAttributeValue(idValue, payload) {
  const value = await requireRecord(
    repository.findAttributeValueById,
    "attribute value",
    idValue,
  );
  await requireOptionAttribute(value.attributeId);
  await assertCodeAvailable(
    (code) => repository.findAttributeValueByAttributeAndCode(value.attributeId, code),
    payload.code,
    value.id,
    "attribute value",
  );
  try {
    return attributeValueDto(
      await repository.updateRecord(
        value,
        fields(payload, ["code", "labelEn", "labelIt", "sortOrder", "isActive"]),
      ),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict(
        "This value code already exists for the selected attribute.",
        "ATTRIBUTE_VALUE_CODE_EXISTS",
      );
    }
    throw error;
  }
}

export async function deleteAdminAttributeValue(idValue) {
  const value = await requireRecord(
    repository.findAttributeValueById,
    "attribute value",
    idValue,
  );
  if (hasDependencies(await repository.findDependencies("attribute value", idValue))) {
    throw dependencyError("attribute value");
  }
  await repository.destroyRecord(value);
}

async function assertMappingEligibility(categoryId, attributeId, isActive, isVariantAttribute) {
  const [category, attribute] = await Promise.all([
    requireRecord(repository.findCategoryById, "category", categoryId),
    requireRecord(repository.findAttributeById, "attribute", attributeId),
  ]);

  if (isActive && (!boolean(category.isActive) || !boolean(attribute.isActive))) {
    throw invalid(
      "An active category attribute mapping requires active category and attribute records.",
      "CATEGORY_ATTRIBUTE_SOURCE_INACTIVE",
    );
  }

  if (
    isVariantAttribute &&
    (attribute.dataType !== "option" || boolean(attribute.allowsMultiple))
  ) {
    throw invalid(
      "A variant attribute must be a single-select option attribute.",
      "CATEGORY_ATTRIBUTE_VARIANT_INVALID",
    );
  }
}

export async function listAdminCategoryAttributes(filters) {
  return page(
    await repository.findCategoryAttributes(filters),
    filters,
    categoryAttributeDto,
  );
}

export async function getAdminCategoryAttribute(idValue) {
  return categoryAttributeDto(
    await requireRecord(
      repository.findCategoryAttributeById,
      "category attribute mapping",
      idValue,
    ),
  );
}

export async function createAdminCategoryAttribute(payload) {
  await assertMappingEligibility(
    payload.categoryId,
    payload.attributeId,
    payload.isActive ?? true,
    payload.isVariantAttribute ?? false,
  );

  const existing = await repository.findCategoryAttributeByPair(
    payload.categoryId,
    payload.attributeId,
  );
  if (existing) {
    throw conflict(
      "This attribute is already assigned to the selected category.",
      "CATEGORY_ATTRIBUTE_EXISTS",
    );
  }

  try {
    return categoryAttributeDto(
      await repository.createCategoryAttribute({
        ...fields(payload, [
          "categoryId",
          "attributeId",
          "isRequired",
          "isFilterable",
          "isVariantAttribute",
          "sortOrder",
          "isActive",
        ]),
        isRequired: payload.isRequired ?? false,
        isFilterable: payload.isFilterable ?? true,
        isVariantAttribute: payload.isVariantAttribute ?? false,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      }),
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      throw conflict(
        "This attribute is already assigned to the selected category.",
        "CATEGORY_ATTRIBUTE_EXISTS",
      );
    }
    throw error;
  }
}

export async function updateAdminCategoryAttribute(idValue, payload) {
  const mapping = await requireRecord(
    repository.findCategoryAttributeById,
    "category attribute mapping",
    idValue,
  );
  const current = toPlain(mapping);
  await assertMappingEligibility(
    current.categoryId,
    current.attributeId,
    payload.isActive ?? boolean(current.isActive),
    payload.isVariantAttribute ?? boolean(current.isVariantAttribute),
  );

  return categoryAttributeDto(
    await repository.updateRecord(
      mapping,
      fields(payload, [
        "isRequired",
        "isFilterable",
        "isVariantAttribute",
        "sortOrder",
        "isActive",
      ]),
    ),
  );
}

export async function deleteAdminCategoryAttribute(idValue) {
  const mapping = await requireRecord(
    repository.findCategoryAttributeById,
    "category attribute mapping",
    idValue,
  );
  await repository.destroyRecord(mapping);
}
