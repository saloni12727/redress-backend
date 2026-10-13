import { Op } from "sequelize";

import Attribute from "../../models/attribute.model.js";
import AttributeValue from "../../models/attribute-value.model.js";
import Category from "../../models/category.model.js";
import CategoryAttribute from "../../models/category-attribute.model.js";
import Color from "../../models/color.model.js";
import FitProfile from "../../models/fit-profile.model.js";
import Product from "../../models/product.model.js";
import ProductAttributeValue from "../../models/product-attribute-value.model.js";
import ProductVariant from "../../models/product-variant.model.js";
import Size from "../../models/size.model.js";
import SizeSystem from "../../models/size-system.model.js";

function listWhere({ q, isActive }, searchableFields) {
  const where = {};

  if (q && searchableFields.length > 0) {
    where[Op.or] = searchableFields.map((field) => ({
      [field]: { [Op.like]: `%${q}%` },
    }));
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  return where;
}

async function findPaged(Model, filters, searchableFields, options = {}) {
  const result = await Model.findAndCountAll({
    where: {
      ...listWhere(filters, searchableFields),
      ...(options.where ?? {}),
    },
    order: options.order ?? [
      ["sortOrder", "ASC"],
      ["name", "ASC"],
      ["id", "ASC"],
    ],
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
  });

  return { rows: result.rows, total: result.count };
}

export const findColors = (filters) =>
  findPaged(Color, filters, ["code", "name"]);
export const findColorById = (id) => Color.findByPk(id);
export const findColorByCode = (code) => Color.findOne({ where: { code } });
export const createColor = (values) => Color.create(values);

export const findSizeSystems = (filters) =>
  findPaged(SizeSystem, filters, ["code", "name"], {
    order: [
      ["name", "ASC"],
      ["id", "ASC"],
    ],
  });
export const findSizeSystemById = (id) => SizeSystem.findByPk(id);
export const findSizeSystemByCode = (code) =>
  SizeSystem.findOne({ where: { code } });
export const createSizeSystem = (values) => SizeSystem.create(values);

export const findSizes = (filters) =>
  findPaged(Size, filters, ["code", "label"], {
    where:
      filters.sizeSystemId === undefined
        ? {}
        : { sizeSystemId: filters.sizeSystemId },
    order: [
      ["sizeSystemId", "ASC"],
      ["sortOrder", "ASC"],
      ["id", "ASC"],
    ],
  });
export const findSizeById = (id) => Size.findByPk(id);
export const findSizeBySystemAndCode = (sizeSystemId, code) =>
  Size.findOne({ where: { sizeSystemId, code } });
export const createSize = (values) => Size.create(values);

export const findFitProfiles = (filters) =>
  findPaged(FitProfile, filters, ["code", "name"]);
export const findFitProfileById = (id) => FitProfile.findByPk(id);
export const findFitProfileByCode = (code) =>
  FitProfile.findOne({ where: { code } });
export const createFitProfile = (values) => FitProfile.create(values);

export const findAttributes = (filters) =>
  findPaged(Attribute, filters, ["code", "nameEn", "nameIt"], {
    where: filters.dataType === undefined ? {} : { dataType: filters.dataType },
    order: [
      ["sortOrder", "ASC"],
      ["nameEn", "ASC"],
      ["id", "ASC"],
    ],
  });
export const findAttributeById = (id) => Attribute.findByPk(id);
export const findAttributeByCode = (code) =>
  Attribute.findOne({ where: { code } });
export const createAttribute = (values) => Attribute.create(values);

export const findAttributeValues = (filters) =>
  findPaged(AttributeValue, filters, ["code", "labelEn", "labelIt"], {
    where:
      filters.attributeId === undefined
        ? {}
        : { attributeId: filters.attributeId },
    order: [
      ["attributeId", "ASC"],
      ["sortOrder", "ASC"],
      ["labelEn", "ASC"],
      ["id", "ASC"],
    ],
  });
export const findAttributeValueById = (id) => AttributeValue.findByPk(id);
export const findAttributeValueByAttributeAndCode = (attributeId, code) =>
  AttributeValue.findOne({ where: { attributeId, code } });
export const createAttributeValue = (values) => AttributeValue.create(values);

export const findCategoryAttributes = (filters) =>
  findPaged(CategoryAttribute, filters, [], {
    where: {
      ...(filters.categoryId === undefined
        ? {}
        : { categoryId: filters.categoryId }),
      ...(filters.attributeId === undefined
        ? {}
        : { attributeId: filters.attributeId }),
    },
    order: [
      ["categoryId", "ASC"],
      ["sortOrder", "ASC"],
      ["id", "ASC"],
    ],
  });
export const findCategoryAttributeById = (id) => CategoryAttribute.findByPk(id);
export const findCategoryAttributeByPair = (categoryId, attributeId) =>
  CategoryAttribute.findOne({ where: { categoryId, attributeId } });
export const createCategoryAttribute = (values) => CategoryAttribute.create(values);

export async function updateRecord(record, values) {
  await record.update(values);
  return record;
}

export const destroyRecord = (record) => record.destroy();
export const findCategoryById = (id) => Category.findByPk(id);

export async function findDependencies(resource, id) {
  if (resource === "color") {
    return { productVariantCount: await ProductVariant.count({ where: { colorId: id }, paranoid: false }) };
  }

  if (resource === "size system") {
    return { sizeCount: await Size.count({ where: { sizeSystemId: id } }) };
  }

  if (resource === "size") {
    return { productVariantCount: await ProductVariant.count({ where: { sizeId: id }, paranoid: false }) };
  }

  if (resource === "fit profile") {
    return { productCount: await Product.count({ where: { fitProfileId: id }, paranoid: false }) };
  }

  if (resource === "attribute") {
    const [attributeValueCount, categoryAttributeCount, productAttributeValueCount] =
      await Promise.all([
        AttributeValue.count({ where: { attributeId: id } }),
        CategoryAttribute.count({ where: { attributeId: id } }),
        ProductAttributeValue.count({ where: { attributeId: id } }),
      ]);
    return { attributeValueCount, categoryAttributeCount, productAttributeValueCount };
  }

  if (resource === "attribute value") {
    return { productAttributeValueCount: await ProductAttributeValue.count({ where: { attributeValueId: id } }) };
  }

  return {};
}

export const countAttributeValues = (attributeId) =>
  AttributeValue.count({ where: { attributeId } });
