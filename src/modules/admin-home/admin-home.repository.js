import { Op, QueryTypes } from "sequelize";

import { sequelize } from "../../config/database.js";
import HomePlacement from "../../models/home-placement.model.js";

function addCurrentLiveWindow(where, now) {
  where.status = "live";
  where[Op.and] = [
    {
      [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }],
    },
    {
      [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }],
    },
  ];
}

function listWhere({ sectionKey, status, startsBefore, endsAfter }) {
  const where = { source: "admin" };
  const now = new Date();

  if (sectionKey) {
    where.sectionKey = sectionKey;
  }

  if (status === "live") {
    addCurrentLiveWindow(where, now);
  } else if (status === "scheduled") {
    where.status = "live";
    where.startsAt = { [Op.gt]: now };
  } else if (status === "expired") {
    where.status = "live";
    where.endsAt = { [Op.lte]: now };
  } else if (status) {
    where.status = status;
  }

  if (startsBefore) {
    where.startsAt = {
      ...(where.startsAt ?? {}),
      [Op.lte]: startsBefore,
    };
  }

  if (endsAfter) {
    where.endsAt = {
      ...(where.endsAt ?? {}),
      [Op.gte]: endsAfter,
    };
  }

  return where;
}

export async function findPlacements(filters) {
  const { page, limit } = filters;
  const result = await HomePlacement.findAndCountAll({
    where: listWhere(filters),
    order: [
      ["sectionKey", "ASC"],
      ["sortOrder", "ASC"],
      ["id", "DESC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    rows: result.rows,
    total: result.count,
  };
}

export function findPlacementById(id) {
  return HomePlacement.findOne({
    where: { id, source: "admin" },
  });
}

export function createPlacement(values) {
  return HomePlacement.create(values);
}

export async function updatePlacement(placement, values) {
  await placement.update(values);
  return placement;
}

export function destroyPlacement(placement) {
  return placement.destroy();
}

export async function findPublishableProduct(id) {
  const rows = await sequelize.query(
    `
      SELECT product.id
      FROM products product
      INNER JOIN vendors vendor
        ON vendor.id = product.vendor_id
        AND vendor.status = 'active'
        AND vendor.approval_status = 'approved'
        AND vendor.deleted_at IS NULL
      LEFT JOIN brands brand
        ON brand.id = product.brand_id
      WHERE product.id = :id
        AND product.deleted_at IS NULL
        AND product.status = 'published'
        AND product.approval_status = 'approved'
        AND product.visibility = 'public'
        AND product.published_at IS NOT NULL
        AND (product.brand_id IS NULL OR (
          brand.is_active = 1 AND brand.deleted_at IS NULL
        ))
      LIMIT 1
    `,
    {
      replacements: { id },
      type: QueryTypes.SELECT,
    },
  );

  return rows[0] ?? null;
}

export async function findActiveBrand(id) {
  const rows = await sequelize.query(
    `
      SELECT id
      FROM brands
      WHERE id = :id
        AND is_active = 1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    { replacements: { id }, type: QueryTypes.SELECT },
  );

  return rows[0] ?? null;
}

export async function findActiveCategory(id) {
  const rows = await sequelize.query(
    `
      SELECT id, slug
      FROM categories
      WHERE id = :id
        AND is_active = 1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    { replacements: { id }, type: QueryTypes.SELECT },
  );

  return rows[0] ?? null;
}

async function allValuesExist({
  table,
  field,
  values,
  activeColumn = "is_active",
}) {
  if (!values || values.length === 0) {
    return true;
  }

  const rows = await sequelize.query(
    `
      SELECT ${field} AS value
      FROM ${table}
      WHERE ${field} IN (:values)
        AND ${activeColumn} = 1
        ${table === "sizes" ? "" : "AND deleted_at IS NULL"}
    `,
    {
      replacements: { values },
      type: QueryTypes.SELECT,
    },
  );

  return rows.length === new Set(values.map(String)).size;
}

export async function catalogFilterReferencesAreValid(filters) {
  const checks = [];

  if (filters.category) {
    checks.push(
      sequelize
        .query(
          `
            SELECT id
            FROM categories
            WHERE slug = :slug
              AND is_active = 1
              AND deleted_at IS NULL
            LIMIT 1
          `,
          {
            replacements: { slug: filters.category },
            type: QueryTypes.SELECT,
          },
        )
        .then((rows) => rows.length === 1),
    );
  }

  checks.push(
    allValuesExist({
      table: "brands",
      field: "slug",
      values: filters.brand,
    }),
    allValuesExist({
      table: "colors",
      field: "code",
      values: filters.color,
    }),
    allValuesExist({
      table: "fit_profiles",
      field: "code",
      values: filters.fit,
    }),
    allValuesExist({
      table: "sizes",
      field: "id",
      values: filters.size,
    }),
  );

  const results = await Promise.all(checks);
  return results.every(Boolean);
}
