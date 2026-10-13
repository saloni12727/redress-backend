import { Op } from "sequelize";

import Brand from "../../models/brand.model.js";
import HomePlacement from "../../models/home-placement.model.js";
import Product from "../../models/product.model.js";

function listWhere({ q, isActive }) {
  const where = {};

  if (q) {
    where[Op.or] = [
      { code: { [Op.like]: `%${q}%` } },
      { slug: { [Op.like]: `%${q}%` } },
      { name: { [Op.like]: `%${q}%` } },
    ];
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  return where;
}

export async function findBrands(filters) {
  const result = await Brand.findAndCountAll({
    where: listWhere(filters),
    order: [
      ["name", "ASC"],
      ["id", "ASC"],
    ],
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
  });

  return {
    rows: result.rows,
    total: result.count,
  };
}

export function findBrandById(id, options = {}) {
  return Brand.findByPk(id, options);
}

export function findBrandByCode(code, options = {}) {
  return Brand.findOne({
    where: { code },
    paranoid: false,
    ...options,
  });
}

export function findBrandBySlug(slug, options = {}) {
  return Brand.findOne({
    where: { slug },
    paranoid: false,
    ...options,
  });
}

export function createBrand(values) {
  return Brand.create(values);
}

export async function updateBrand(brand, values) {
  await brand.update(values);
  return brand;
}

export function destroyBrand(brand, options = {}) {
  return brand.destroy(options);
}

export async function findBrandDependencies(brandId) {
  const [productCount, homePlacementCount] = await Promise.all([
    Product.count({ where: { brandId } }),
    HomePlacement.count({ where: { targetBrandId: brandId } }),
  ]);

  return {
    productCount,
    homePlacementCount,
  };
}
