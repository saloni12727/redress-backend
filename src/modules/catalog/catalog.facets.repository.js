import { QueryTypes } from "sequelize";

import { sequelize } from "../../config/database.js";

function activePriceSql(alias) {
  return `
    CASE
      WHEN ${alias}.sale_price IS NOT NULL
        AND (${alias}.sale_start_at IS NULL OR ${alias}.sale_start_at <= UTC_TIMESTAMP())
        AND (${alias}.sale_end_at IS NULL OR ${alias}.sale_end_at >= UTC_TIMESTAMP())
      THEN LEAST(${alias}.sale_price, ${alias}.regular_price)
      ELSE ${alias}.regular_price
    END
  `;
}

const PUBLIC_PRODUCT_FROM_SQL = `
  FROM products product

  INNER JOIN vendors vendor
    ON vendor.id = product.vendor_id
    AND vendor.status = 'active'
    AND vendor.approval_status = 'approved'
    AND vendor.deleted_at IS NULL

  LEFT JOIN brands brand
    ON brand.id = product.brand_id

  LEFT JOIN fit_profiles fit_profile
    ON fit_profile.id = product.fit_profile_id
    AND fit_profile.is_active = 1

  LEFT JOIN product_translations translation
    ON translation.product_id = product.id
    AND translation.language_code = :locale

  LEFT JOIN product_translations fallback_translation
    ON fallback_translation.product_id = product.id
    AND fallback_translation.language_code = :fallbackLocale
`;

function escapedLike(value) {
  return `%${String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")}%`;
}

function buildProductContext(filters, omitted = []) {
  const omit = new Set(omitted);

  const replacements = {
    locale: filters.locale,
    fallbackLocale: filters.fallbackLocale,
  };

  const commonTableExpressions = [];

  const conditions = [
    "product.status = 'published'",
    "product.approval_status = 'approved'",
    "product.visibility = 'public'",
    "product.published_at IS NOT NULL",
    "product.deleted_at IS NULL",
    "(product.brand_id IS NULL OR (brand.is_active = 1 AND brand.deleted_at IS NULL))",
  ];

  if (filters.category && !omit.has("category")) {
    replacements.category = filters.category;

    commonTableExpressions.push(`
      selected_categories AS (
        SELECT id

        FROM categories

        WHERE slug = :category
          AND is_active = 1
          AND deleted_at IS NULL

        UNION ALL

        SELECT child.id

        FROM categories child

        INNER JOIN selected_categories parent
          ON parent.id = child.parent_id

        WHERE child.is_active = 1
          AND child.deleted_at IS NULL
      )
    `);

    conditions.push(`
      EXISTS (
        SELECT 1

        FROM product_categories product_category

        WHERE product_category.product_id =
          product.id

          AND product_category.category_id IN (
            SELECT id
            FROM selected_categories
          )
      )
    `);
  }

  if (filters.audience && !omit.has("audience")) {
    replacements.audience = filters.audience;

    commonTableExpressions.push(`
      audience_categories AS (
        SELECT id

        FROM categories

        WHERE slug = :audience
          AND parent_id IS NULL
          AND is_active = 1
          AND deleted_at IS NULL

        UNION ALL

        SELECT child.id

        FROM categories child

        INNER JOIN audience_categories parent
          ON parent.id = child.parent_id

        WHERE child.is_active = 1
          AND child.deleted_at IS NULL
      )
    `);

    conditions.push(`
      EXISTS (
        SELECT 1

        FROM product_categories audience_product_category

        WHERE audience_product_category.product_id =
          product.id

          AND audience_product_category.category_id IN (
            SELECT id
            FROM audience_categories
          )
      )
    `);
  }

  if (filters.brand?.length > 0 && !omit.has("brand")) {
    replacements.brandSlugs = filters.brand;

    conditions.push("brand.slug IN (:brandSlugs)");
  }

  if (filters.fit?.length > 0 && !omit.has("fit")) {
    replacements.fitCodes = filters.fit;

    conditions.push(
      "fit_profile.is_active = 1 AND fit_profile.code IN (:fitCodes)",
    );
  }

  if (filters.featured !== undefined && !omit.has("featured")) {
    replacements.featured = filters.featured ? 1 : 0;

    conditions.push("product.is_featured = :featured");
  }

  if (filters.tryOn === true && !omit.has("tryOn")) {
    conditions.push("product.try_on_ready = 1");
  }

  if (filters.q && !omit.has("q")) {
    replacements.search = escapedLike(filters.q);

    conditions.push(`
      (
        COALESCE(
          translation.name,
          fallback_translation.name,
          product.code
        ) LIKE :search ESCAPE '\\\\'

        OR brand.name
          LIKE :search ESCAPE '\\\\'

        OR product.code
          LIKE :search ESCAPE '\\\\'
      )
    `);
  }

  return {
    cte:
      commonTableExpressions.length > 0
        ? `WITH RECURSIVE ${commonTableExpressions.join(",\n")}`
        : "",

    conditions,

    replacements,
  };
}

function appendVariantConditions({
  filters,
  alias,
  replacements,
  omitted = [],
}) {
  const omit = new Set(omitted);

  const conditions = [`${alias}.is_active = 1`, `${alias}.deleted_at IS NULL`];

  if (filters.color?.length > 0 && !omit.has("color")) {
    replacements.colorCodes = filters.color;

    conditions.push(`
      EXISTS (
        SELECT 1

        FROM colors selected_color

        WHERE selected_color.id =
          ${alias}.color_id

          AND selected_color.code IN (
            :colorCodes
          )

          AND selected_color.is_active = 1
      )
    `);
  }

  if (filters.size?.length > 0 && !omit.has("size")) {
    replacements.sizeCodes = filters.size;

    conditions.push(`
      EXISTS (
        SELECT 1

        FROM sizes selected_size

        WHERE selected_size.id =
          ${alias}.size_id

          AND selected_size.code IN (
            :sizeCodes
          )

          AND selected_size.is_active = 1
      )
    `);
  }

  if (filters.inStock === true && !omit.has("inStock")) {
    conditions.push(`
      EXISTS (
        SELECT 1

        FROM inventory selected_inventory

        WHERE selected_inventory.variant_id =
          ${alias}.id

          AND (
            selected_inventory.allow_backorder = 1

            OR GREATEST(
              COALESCE(
                selected_inventory.quantity_on_hand,
                0
              )
              -
              COALESCE(
                selected_inventory.quantity_reserved,
                0
              ),
              0
            ) > 0
          )
      )
    `);
  }

  const currentPriceSql = activePriceSql(alias);

  if (filters.minPrice !== undefined && !omit.has("minPrice")) {
    replacements.minPrice = filters.minPrice;

    conditions.push(`
      ${currentPriceSql} >= :minPrice
    `);
  }

  if (filters.maxPrice !== undefined && !omit.has("maxPrice")) {
    replacements.maxPrice = filters.maxPrice;

    conditions.push(`
      ${currentPriceSql} <= :maxPrice
    `);
  }

  if (filters.minDiscount !== undefined && !omit.has("minDiscount")) {
    replacements.minDiscount = filters.minDiscount;

    conditions.push(`
      ${alias}.regular_price > 0

      AND ${currentPriceSql}
        < ${alias}.regular_price

      AND (
        (
          ${alias}.regular_price
          - ${currentPriceSql}
        )
        / ${alias}.regular_price
      ) * 100 >= :minDiscount
    `);
  }

  if (filters.onSale === true && !omit.has("onSale")) {
    conditions.push(`
      ${alias}.regular_price > 0

      AND ${currentPriceSql}
        < ${alias}.regular_price
    `);
  }

  return conditions;
}

function baseFacetParts(filters, { omitProduct = [], omitVariant = [] } = {}) {
  const context = buildProductContext(filters, omitProduct);

  const variantConditions = appendVariantConditions({
    filters,
    alias: "facet_variant",
    replacements: context.replacements,
    omitted: omitVariant,
  });

  return {
    ...context,
    variantConditions,
  };
}

async function findBrandFacets(filters) {
  const query = baseFacetParts(filters, {
    omitProduct: ["brand"],
  });

  return sequelize.query(
    `
      ${query.cte}

      SELECT
        brand.id,
        brand.code,
        brand.name,
        brand.slug,
        brand.logo_key AS logoKey,
        brand.website_url AS websiteUrl,

        COUNT(
          DISTINCT product.id
        ) AS count

      ${PUBLIC_PRODUCT_FROM_SQL}

      INNER JOIN product_variants facet_variant
        ON facet_variant.product_id =
          product.id

      WHERE ${query.conditions.join(" AND ")}

        AND ${query.variantConditions.join(" AND ")}

        AND brand.id IS NOT NULL
        AND brand.is_active = 1
        AND brand.deleted_at IS NULL

      GROUP BY
        brand.id,
        brand.code,
        brand.name,
        brand.slug,
        brand.logo_key,
        brand.website_url

      HAVING
        COUNT(
          DISTINCT product.id
        ) > 0

      ORDER BY
        brand.name ASC,
        brand.id ASC
    `,
    {
      replacements: query.replacements,

      type: QueryTypes.SELECT,
    },
  );
}

async function findColorFacets(filters) {
  const query = baseFacetParts(filters, {
    omitVariant: ["color"],
  });

  return sequelize.query(
    `
      ${query.cte}

      SELECT
        facet_color.id,
        facet_color.code,
        facet_color.name,
        facet_color.hex_code AS hexCode,

        COUNT(
          DISTINCT product.id
        ) AS count

      ${PUBLIC_PRODUCT_FROM_SQL}

      INNER JOIN product_variants facet_variant
        ON facet_variant.product_id =
          product.id

      INNER JOIN colors facet_color
        ON facet_color.id =
          facet_variant.color_id
        AND facet_color.is_active = 1

      WHERE ${query.conditions.join(" AND ")}

        AND ${query.variantConditions.join(" AND ")}

      GROUP BY
        facet_color.id,
        facet_color.code,
        facet_color.name,
        facet_color.hex_code,
        facet_color.sort_order

      HAVING
        COUNT(
          DISTINCT product.id
        ) > 0

      ORDER BY
        facet_color.sort_order ASC,
        facet_color.name ASC,
        facet_color.id ASC
    `,
    {
      replacements: query.replacements,

      type: QueryTypes.SELECT,
    },
  );
}

async function findSizeFacets(filters) {
  const query = baseFacetParts(filters, {
    omitVariant: ["size"],
  });

  return sequelize.query(
    `
      ${query.cte}

      SELECT
        size_system.id AS systemId,
        size_system.code AS systemCode,
        size_system.name AS systemName,

        facet_size.id,
        facet_size.code,
        facet_size.label,

        COUNT(
          DISTINCT product.id
        ) AS count

      ${PUBLIC_PRODUCT_FROM_SQL}

      INNER JOIN product_variants facet_variant
        ON facet_variant.product_id =
          product.id

      INNER JOIN sizes facet_size
        ON facet_size.id =
          facet_variant.size_id
        AND facet_size.is_active = 1

      INNER JOIN size_systems size_system
        ON size_system.id =
          facet_size.size_system_id
        AND size_system.is_active = 1

      WHERE ${query.conditions.join(" AND ")}

        AND ${query.variantConditions.join(" AND ")}

      GROUP BY
        size_system.id,
        size_system.code,
        size_system.name,
        facet_size.id,
        facet_size.code,
        facet_size.label,
        facet_size.sort_order

      HAVING
        COUNT(
          DISTINCT product.id
        ) > 0

      ORDER BY
        size_system.id ASC,
        facet_size.sort_order ASC,
        facet_size.id ASC
    `,
    {
      replacements: query.replacements,

      type: QueryTypes.SELECT,
    },
  );
}

async function findPriceData(filters) {
  const query = baseFacetParts(filters, {
    omitVariant: ["minPrice", "maxPrice"],
  });

  const currentPriceSql = activePriceSql("facet_variant");

  const [row] = await sequelize.query(
    `
      ${query.cte}

      SELECT
        MIN(
          ${currentPriceSql}
        ) AS minPrice,

        MAX(
          ${currentPriceSql}
        ) AS maxPrice,

        MIN(
          product.currency_code
        ) AS currencyCode,

        COUNT(
          DISTINCT CASE
            WHEN ${currentPriceSql} <= 25
            THEN product.id
          END
        ) AS under25,

        COUNT(
          DISTINCT CASE
            WHEN ${currentPriceSql} >= 25
              AND ${currentPriceSql} <= 50
            THEN product.id
          END
        ) AS from25To50,

        COUNT(
          DISTINCT CASE
            WHEN ${currentPriceSql} >= 50
              AND ${currentPriceSql} <= 100
            THEN product.id
          END
        ) AS from50To100,

        COUNT(
          DISTINCT CASE
            WHEN ${currentPriceSql} >= 100
            THEN product.id
          END
        ) AS over100

      ${PUBLIC_PRODUCT_FROM_SQL}

      INNER JOIN product_variants facet_variant
        ON facet_variant.product_id =
          product.id

      WHERE ${query.conditions.join(" AND ")}

        AND ${query.variantConditions.join(" AND ")}
    `,
    {
      replacements: query.replacements,

      type: QueryTypes.SELECT,
    },
  );

  return row ?? null;
}

async function findDiscountData(filters) {
  const query = baseFacetParts(filters, {
    omitVariant: ["minDiscount"],
  });

  const currentPriceSql = activePriceSql("facet_variant");

  const discountSql = `
    CASE
      WHEN facet_variant.regular_price > 0

        AND ${currentPriceSql}
          < facet_variant.regular_price

      THEN (
        (
          facet_variant.regular_price
          - ${currentPriceSql}
        )
        / facet_variant.regular_price
      ) * 100

      ELSE 0
    END
  `;

  const [row] = await sequelize.query(
    `
        ${query.cte}

        SELECT
          COUNT(
            DISTINCT CASE
              WHEN ${discountSql} >= 10
              THEN product.id
            END
          ) AS d10,

          COUNT(
            DISTINCT CASE
              WHEN ${discountSql} >= 30
              THEN product.id
            END
          ) AS d30,

          COUNT(
            DISTINCT CASE
              WHEN ${discountSql} >= 50
              THEN product.id
            END
          ) AS d50

        ${PUBLIC_PRODUCT_FROM_SQL}

        INNER JOIN product_variants facet_variant
          ON facet_variant.product_id =
            product.id

        WHERE ${query.conditions.join(" AND ")}

          AND ${query.variantConditions.join(" AND ")}
      `,
    {
      replacements: query.replacements,

      type: QueryTypes.SELECT,
    },
  );

  return row ?? null;
}

async function countOnSaleProducts(filters) {
  const query = baseFacetParts(filters, {
    omitVariant: ["onSale"],
  });

  const currentPriceSql = activePriceSql("facet_variant");

  const [row] = await sequelize.query(
    `
        ${query.cte}

        SELECT
          COUNT(
            DISTINCT product.id
          ) AS count

        ${PUBLIC_PRODUCT_FROM_SQL}

        INNER JOIN product_variants facet_variant
          ON facet_variant.product_id =
            product.id

        WHERE ${query.conditions.join(" AND ")}

          AND ${query.variantConditions.join(" AND ")}

          AND facet_variant.regular_price > 0

          AND ${currentPriceSql}
            < facet_variant.regular_price
      `,
    {
      replacements: query.replacements,

      type: QueryTypes.SELECT,
    },
  );

  return Number(row?.count ?? 0);
}

async function countInStockProducts(filters) {
  const query = baseFacetParts(filters, {
    omitVariant: ["inStock"],
  });

  const [row] = await sequelize.query(
    `
        ${query.cte}

        SELECT
          COUNT(
            DISTINCT product.id
          ) AS count

        ${PUBLIC_PRODUCT_FROM_SQL}

        INNER JOIN product_variants facet_variant
          ON facet_variant.product_id =
            product.id

        WHERE ${query.conditions.join(" AND ")}

          AND ${query.variantConditions.join(" AND ")}

          AND EXISTS (
            SELECT 1

            FROM inventory facet_inventory

            WHERE facet_inventory.variant_id =
              facet_variant.id

              AND (
                facet_inventory.allow_backorder = 1

                OR GREATEST(
                  COALESCE(
                    facet_inventory.quantity_on_hand,
                    0
                  )
                  -
                  COALESCE(
                    facet_inventory.quantity_reserved,
                    0
                  ),
                  0
                ) > 0
              )
          )
      `,
    {
      replacements: query.replacements,

      type: QueryTypes.SELECT,
    },
  );

  return Number(row?.count ?? 0);
}

async function countTryOnProducts(filters) {
  const query = baseFacetParts(filters, {
    omitProduct: ["tryOn"],
  });

  const [row] = await sequelize.query(
    `
        ${query.cte}

        SELECT
          COUNT(
            DISTINCT product.id
          ) AS count

        ${PUBLIC_PRODUCT_FROM_SQL}

        INNER JOIN product_variants facet_variant
          ON facet_variant.product_id =
            product.id

        WHERE ${query.conditions.join(" AND ")}

          AND ${query.variantConditions.join(" AND ")}

          AND product.try_on_ready = 1
      `,
    {
      replacements: query.replacements,

      type: QueryTypes.SELECT,
    },
  );

  return Number(row?.count ?? 0);
}

export async function findCatalogFacets(filters) {
  const [
    brands,
    colors,
    sizes,
    priceData,
    discountData,
    onSaleCount,
    inStockCount,
    tryOnCount,
  ] = await Promise.all([
    findBrandFacets(filters),
    findColorFacets(filters),
    findSizeFacets(filters),
    findPriceData(filters),
    findDiscountData(filters),
    countOnSaleProducts(filters),
    countInStockProducts(filters),
    countTryOnProducts(filters),
  ]);

  return {
    brands,
    colors,
    sizes,
    priceData,
    discountData,

    flags: {
      onSale: onSaleCount,
      inStock: inStockCount,
      tryOn: tryOnCount,
    },
  };
}
