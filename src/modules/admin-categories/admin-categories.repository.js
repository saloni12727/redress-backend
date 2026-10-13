import { QueryTypes } from "sequelize";

import { sequelize } from "../../config/database.js";

import Category from "../../models/category.model.js";

import CategoryTranslation from "../../models/category-translation.model.js";

function escapeLike(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function listConditions(filters, replacements) {
  const conditions = ["category.deleted_at IS NULL"];

  if (filters.q) {
    replacements.search = `%${escapeLike(filters.q)}%`;

    conditions.push(`
      (
        category.code
          LIKE :search ESCAPE '\\\\'

        OR category.slug
          LIKE :search ESCAPE '\\\\'

        OR en_translation.name
          LIKE :search ESCAPE '\\\\'

        OR it_translation.name
          LIKE :search ESCAPE '\\\\'
      )
    `);
  }

  if (filters.isActive !== undefined) {
    replacements.isActive = filters.isActive ? 1 : 0;

    conditions.push("category.is_active = :isActive");
  }

  if (filters.parentId !== undefined) {
    if (filters.parentId === 0) {
      conditions.push("category.parent_id IS NULL");
    } else {
      replacements.parentId = filters.parentId;

      conditions.push("category.parent_id = :parentId");
    }
  }

  return conditions;
}

const CATEGORY_SELECT = `
  SELECT
    category.id,

    category.parent_id
      AS parentId,

    category.code,

    category.slug,

    category.sort_order
      AS sortOrder,

    category.is_active
      AS isActive,

    category.created_at
      AS createdAt,

    category.updated_at
      AS updatedAt,

    en_translation.name
      AS nameEn,

    en_translation.description
      AS descriptionEn,

    it_translation.name
      AS nameIt,

    it_translation.description
      AS descriptionIt,

    parent.id
      AS parentCategoryId,

    parent.code
      AS parentCode,

    parent.slug
      AS parentSlug,

    parent_en.name
      AS parentNameEn,

    parent_it.name
      AS parentNameIt,

    (
      SELECT COUNT(*)
      FROM categories child
      WHERE
        child.parent_id =
          category.id

        AND child.deleted_at
          IS NULL
    )
      AS childCount,

    (
      SELECT COUNT(*)

      FROM product_categories
        product_category

      INNER JOIN products
        product

        ON product.id =
          product_category.product_id

        AND product.deleted_at
          IS NULL

      WHERE
        product_category.category_id =
          category.id
    )
      AS productCount

  FROM categories category

  LEFT JOIN category_translations
    en_translation

    ON en_translation.category_id =
      category.id

    AND en_translation.language_code =
      'en'

  LEFT JOIN category_translations
    it_translation

    ON it_translation.category_id =
      category.id

    AND it_translation.language_code =
      'it'

  LEFT JOIN categories parent

    ON parent.id =
      category.parent_id

    AND parent.deleted_at
      IS NULL

  LEFT JOIN category_translations
    parent_en

    ON parent_en.category_id =
      parent.id

    AND parent_en.language_code =
      'en'

  LEFT JOIN category_translations
    parent_it

    ON parent_it.category_id =
      parent.id

    AND parent_it.language_code =
      'it'
`;

export async function findCategories(filters) {
  const replacements = {
    limit: filters.limit,

    offset: (filters.page - 1) * filters.limit,
  };

  const conditions = listConditions(filters, replacements);

  const whereSql = conditions.join(" AND ");

  const [rows, countRows] = await Promise.all([
    sequelize.query(
      `
        ${CATEGORY_SELECT}

        WHERE ${whereSql}

        ORDER BY

          category.sort_order
            ASC,

          COALESCE(
            en_translation.name,
            it_translation.name,
            category.code
          )
            ASC,

          category.id ASC

        LIMIT :limit
        OFFSET :offset
      `,
      {
        replacements,

        type: QueryTypes.SELECT,
      },
    ),

    sequelize.query(
      `
        SELECT
          COUNT(
            DISTINCT category.id
          ) AS total

        FROM categories category

        LEFT JOIN
          category_translations
          en_translation

          ON en_translation.category_id =
            category.id

          AND en_translation.language_code =
            'en'

        LEFT JOIN
          category_translations
          it_translation

          ON it_translation.category_id =
            category.id

          AND it_translation.language_code =
            'it'

        WHERE ${whereSql}
      `,
      {
        replacements,

        type: QueryTypes.SELECT,
      },
    ),
  ]);

  return {
    rows,

    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findCategoryById(id, { transaction } = {}) {
  const rows = await sequelize.query(
    `
        ${CATEGORY_SELECT}

        WHERE
          category.id = :id

          AND category.deleted_at
            IS NULL

        LIMIT 1
      `,
    {
      replacements: {
        id,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export function findCategoryRecordById(id, { transaction, lock = false } = {}) {
  return Category.findOne({
    where: {
      id,
    },

    transaction,

    ...(lock && transaction
      ? {
          lock: transaction.LOCK.UPDATE,
        }
      : {}),
  });
}

export async function findCategoryByCode(
  code,
  { excludeId, transaction } = {},
) {
  const replacements = {
    code,
  };

  const excludeSql = excludeId ? "AND id <> :excludeId" : "";

  if (excludeId) {
    replacements.excludeId = excludeId;
  }

  const rows = await sequelize.query(
    `
        SELECT
          id,
          code,
          slug,
          deleted_at AS deletedAt

        FROM categories

        WHERE
          code = :code

          ${excludeSql}

        LIMIT 1
      `,
    {
      replacements,

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function findCategoryBySlug(
  slug,
  { excludeId, transaction } = {},
) {
  const replacements = {
    slug,
  };

  const excludeSql = excludeId ? "AND id <> :excludeId" : "";

  if (excludeId) {
    replacements.excludeId = excludeId;
  }

  const rows = await sequelize.query(
    `
        SELECT
          id,
          code,
          slug,
          deleted_at AS deletedAt

        FROM categories

        WHERE
          slug = :slug

          ${excludeSql}

        LIMIT 1
      `,
    {
      replacements,

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function isCategoryDescendant(
  categoryId,
  candidateParentId,
  { transaction } = {},
) {
  const rows = await sequelize.query(
    `
        WITH RECURSIVE
          descendants AS (

            SELECT id

            FROM categories

            WHERE
              parent_id =
                :categoryId

              AND deleted_at
                IS NULL

            UNION ALL

            SELECT
              child.id

            FROM categories
              child

            INNER JOIN
              descendants
              parent

              ON child.parent_id =
                parent.id

            WHERE
              child.deleted_at
                IS NULL
          )

        SELECT id

        FROM descendants

        WHERE
          id =
            :candidateParentId

        LIMIT 1
      `,
    {
      replacements: {
        categoryId,
        candidateParentId,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows.length > 0;
}

export async function countActiveChildren(categoryId, { transaction } = {}) {
  const rows = await sequelize.query(
    `
        SELECT
          COUNT(*) AS total

        FROM categories

        WHERE
          parent_id =
            :categoryId

          AND is_active = 1

          AND deleted_at
            IS NULL
      `,
    {
      replacements: {
        categoryId,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return Number(rows[0]?.total ?? 0);
}

export async function findDeleteDependencies(categoryId, { transaction } = {}) {
  const rows = await sequelize.query(
    `
        SELECT

          (
            SELECT COUNT(*)

            FROM categories
              child

            WHERE
              child.parent_id =
                :categoryId

              AND child.deleted_at
                IS NULL
          )
            AS childCount,

          (
            SELECT COUNT(*)

            FROM product_categories
              product_category

            INNER JOIN products
              product

              ON product.id =
                product_category.product_id

              AND product.deleted_at
                IS NULL

            WHERE
              product_category.category_id =
                :categoryId
          )
            AS productCount,

          (
            SELECT COUNT(*)

            FROM home_placements
              placement

            WHERE
              placement.target_category_id =
                :categoryId

              AND placement.deleted_at
                IS NULL
          )
            AS homePlacementCount,

          (
            SELECT COUNT(*)

            FROM category_attributes
              category_attribute

            WHERE
              category_attribute.category_id =
                :categoryId
          )
            AS attributeCount,

          (
            SELECT COUNT(*)

            FROM
              category_measurement_requirements
              requirement

            WHERE
              requirement.category_id =
                :categoryId
          )
            AS measurementCount
      `,
    {
      replacements: {
        categoryId,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  const row = rows[0] ?? {};

  return {
    childCount: Number(row.childCount ?? 0),

    productCount: Number(row.productCount ?? 0),

    homePlacementCount: Number(row.homePlacementCount ?? 0),

    attributeCount: Number(row.attributeCount ?? 0),

    measurementCount: Number(row.measurementCount ?? 0),
  };
}

export function createCategory(values, { transaction } = {}) {
  return Category.create(values, {
    transaction,
  });
}

export async function updateCategory(category, values, { transaction } = {}) {
  await category.update(values, {
    transaction,
  });

  return category;
}

export async function upsertCategoryTranslations(
  categoryId,
  translations,
  { transaction } = {},
) {
  for (const [languageCode, values] of Object.entries(translations)) {
    const existing = await CategoryTranslation.findOne({
      where: {
        categoryId,
        languageCode,
      },

      transaction,

      ...(transaction
        ? {
            lock: transaction.LOCK.UPDATE,
          }
        : {}),
    });

    if (existing) {
      await existing.update(values, {
        transaction,
      });

      continue;
    }

    await CategoryTranslation.create(
      {
        categoryId,
        languageCode,
        ...values,
      },
      {
        transaction,
      },
    );
  }
}

export function deleteCategory(category, { transaction } = {}) {
  return category.destroy({
    transaction,
  });
}

export function withTransaction(work) {
  return sequelize.transaction(work);
}
