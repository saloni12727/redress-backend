import { QueryTypes } from "sequelize";

import { sequelize } from "../../config/database.js";

const ACTIVE_SALE_SQL = `
  CASE
    WHEN variant.sale_price IS NOT NULL
      AND (variant.sale_start_at IS NULL OR variant.sale_start_at <= UTC_TIMESTAMP())
      AND (variant.sale_end_at IS NULL OR variant.sale_end_at >= UTC_TIMESTAMP())
    THEN LEAST(variant.sale_price, variant.regular_price)
    ELSE variant.regular_price
  END
`;

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

  INNER JOIN (
    SELECT
      variant.product_id,

      MIN(variant.regular_price) AS min_regular_price,
      MAX(variant.regular_price) AS max_regular_price,

      MIN(${ACTIVE_SALE_SQL}) AS min_current_price,
      MAX(${ACTIVE_SALE_SQL}) AS max_current_price,

      MAX(
        CASE
          WHEN inventory.allow_backorder = 1
            OR GREATEST(
              COALESCE(inventory.quantity_on_hand, 0)
                - COALESCE(inventory.quantity_reserved, 0),
              0
            ) > 0
          THEN 1
          ELSE 0
        END
      ) AS in_stock,

      CASE
        WHEN MAX(COALESCE(inventory.allow_backorder, 0)) = 0
          AND MAX(
            GREATEST(
              COALESCE(inventory.quantity_on_hand, 0)
                - COALESCE(inventory.quantity_reserved, 0),
              0
            )
          ) BETWEEN 1 AND 3
        THEN 1
        ELSE 0
      END AS low_stock

    FROM product_variants variant

    LEFT JOIN inventory
      ON inventory.variant_id = variant.id

    WHERE variant.is_active = 1
      AND variant.deleted_at IS NULL

    GROUP BY variant.product_id
  ) price_summary
    ON price_summary.product_id = product.id

  LEFT JOIN (
    SELECT
      review.product_id,
      AVG(review.rating) AS rating_average,
      COUNT(*) AS rating_count

    FROM product_reviews review

    WHERE review.is_published = 1

    GROUP BY review.product_id
  ) review_summary
    ON review_summary.product_id = product.id

  LEFT JOIN (
    SELECT
      item.product_id,
      SUM(item.quantity) AS sold_count

    FROM order_items item

    INNER JOIN orders product_order
      ON product_order.id = item.order_id
      AND product_order.status IN (
        'confirmed',
        'packed',
        'shipped',
        'outForDelivery',
        'delivered'
      )

    WHERE item.product_id IS NOT NULL

    GROUP BY item.product_id
  ) sales_summary
    ON sales_summary.product_id = product.id
`;

const SORT_SQL = Object.freeze({
  featured:
    "product.is_featured DESC, product.published_at DESC, product.id DESC",

  newest: "product.published_at DESC, product.id DESC",

  price_asc:
    "price_summary.min_current_price ASC, product.published_at DESC, product.id DESC",

  price_desc:
    "price_summary.max_current_price DESC, product.published_at DESC, product.id DESC",

  name_asc:
    "COALESCE(translation.name, fallback_translation.name, product.code) ASC, product.id DESC",

  discount: `COALESCE((
    SELECT MAX(
      ((variant.regular_price - ${ACTIVE_SALE_SQL}) / variant.regular_price) * 100
    )
    FROM product_variants variant
    WHERE variant.product_id = product.id
      AND variant.is_active = 1
      AND variant.deleted_at IS NULL
      AND ${ACTIVE_SALE_SQL} < variant.regular_price
  ), 0) DESC, product.published_at DESC, product.id DESC`,

  rating:
    "COALESCE(review_summary.rating_average, 0) DESC, COALESCE(review_summary.rating_count, 0) DESC, product.published_at DESC, product.id DESC",

  popular:
    "COALESCE(sales_summary.sold_count, 0) DESC, product.published_at DESC, product.id DESC",
});

function buildPublicProductQuery(filters) {
  const replacements = {
    locale: filters.locale,
    fallbackLocale: filters.fallbackLocale,
  };

  const conditions = [
    "product.status = 'published'",
    "product.approval_status = 'approved'",
    "product.visibility = 'public'",
    "product.published_at IS NOT NULL",
    "product.deleted_at IS NULL",
    "(product.brand_id IS NULL OR (brand.is_active = 1 AND brand.deleted_at IS NULL))",
  ];

  const commonTableExpressions = [];

  let wishlistJoin = "";

  if (filters.wishlistAccountId !== undefined) {
    replacements.wishlistAccountId = filters.wishlistAccountId;

    wishlistJoin = `
      INNER JOIN wishlist_items wishlist_item
        ON wishlist_item.product_id = product.id
        AND wishlist_item.account_id = :wishlistAccountId
    `;
  }

  if (filters.category) {
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

    replacements.category = filters.category;

    conditions.push(`
      EXISTS (
        SELECT 1
        FROM product_categories product_category

        WHERE product_category.product_id = product.id

          AND product_category.category_id IN (
            SELECT id FROM selected_categories
          )
      )
    `);
  }

  if (filters.audience) {
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

    replacements.audience = filters.audience;

    conditions.push(`
      EXISTS (
        SELECT 1

        FROM product_categories audience_product_category

        WHERE audience_product_category.product_id = product.id

          AND audience_product_category.category_id IN (
            SELECT id FROM audience_categories
          )
      )
    `);
  }

  if (filters.brand.length > 0) {
    replacements.brandSlugs = filters.brand;

    conditions.push("brand.slug IN (:brandSlugs)");
  }

  if (filters.fit.length > 0) {
    replacements.fitCodes = filters.fit;

    conditions.push(
      "fit_profile.is_active = 1 AND fit_profile.code IN (:fitCodes)",
    );
  }

  if (filters.featured !== undefined) {
    replacements.featured = filters.featured ? 1 : 0;

    conditions.push("product.is_featured = :featured");
  }

  if (filters.tryOn === true) {
    conditions.push("product.try_on_ready = 1");
  }

  if (filters.q) {
    replacements.search = `%${filters.q
      .replaceAll("\\", "\\\\")
      .replaceAll("%", "\\%")
      .replaceAll("_", "\\_")}%`;

    conditions.push(`
      (
        COALESCE(
          translation.name,
          fallback_translation.name,
          product.code
        ) LIKE :search ESCAPE '\\\\'

        OR brand.name LIKE :search ESCAPE '\\\\'

        OR product.code LIKE :search ESCAPE '\\\\'
      )
    `);
  }

  const variantConditions = [
    "filtered_variant.product_id = product.id",
    "filtered_variant.is_active = 1",
    "filtered_variant.deleted_at IS NULL",
  ];

  if (filters.color.length > 0) {
    replacements.colorCodes = filters.color;

    variantConditions.push(`
      EXISTS (
        SELECT 1
        FROM colors filtered_color

        WHERE filtered_color.id = filtered_variant.color_id
          AND filtered_color.code IN (:colorCodes)
          AND filtered_color.is_active = 1
      )
    `);
  }

  if (filters.size.length > 0) {
    replacements.sizeCodes = filters.size;

    variantConditions.push(`
      EXISTS (
        SELECT 1
        FROM sizes filtered_size

        WHERE filtered_size.id = filtered_variant.size_id
          AND filtered_size.code IN (:sizeCodes)
          AND filtered_size.is_active = 1
      )
    `);
  }

  if (filters.inStock === true) {
    variantConditions.push(`
      EXISTS (
        SELECT 1

        FROM inventory filtered_inventory

        WHERE filtered_inventory.variant_id = filtered_variant.id

          AND (
            filtered_inventory.allow_backorder = 1

            OR GREATEST(
              filtered_inventory.quantity_on_hand
                - filtered_inventory.quantity_reserved,
              0
            ) > 0
          )
      )
    `);
  }

  const filteredPriceSql = ACTIVE_SALE_SQL.replaceAll(
    "variant.",
    "filtered_variant.",
  );

  if (filters.minPrice !== undefined) {
    replacements.minPrice = filters.minPrice;

    variantConditions.push(`${filteredPriceSql} >= :minPrice`);
  }

  if (filters.maxPrice !== undefined) {
    replacements.maxPrice = filters.maxPrice;

    variantConditions.push(`${filteredPriceSql} <= :maxPrice`);
  }

  if (filters.minDiscount !== undefined) {
    replacements.minDiscount = filters.minDiscount;

    variantConditions.push(`
      ${filteredPriceSql}
        < filtered_variant.regular_price

      AND (
        (
          filtered_variant.regular_price
          - ${filteredPriceSql}
        )
        / filtered_variant.regular_price
      ) * 100 >= :minDiscount
    `);
  }

  if (
    filters.color.length > 0 ||
    filters.size.length > 0 ||
    filters.inStock === true ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.minDiscount !== undefined
  ) {
    conditions.push(`
      EXISTS (
        SELECT 1

        FROM product_variants filtered_variant

        WHERE ${variantConditions.join(" AND ")}
      )
    `);
  }

  const commonTableExpression =
    commonTableExpressions.length > 0
      ? `WITH RECURSIVE ${commonTableExpressions.join(",\n")}`
      : "";

  return {
    commonTableExpression,
    replacements,
    whereSql: conditions.join(" AND "),
    fromSql: `${PUBLIC_PRODUCT_FROM_SQL}${wishlistJoin}`,
  };
}

export async function findActiveBrands() {
  return sequelize.query(
    `
      SELECT
        id,
        code,
        name,
        slug,
        logo_key AS logoKey,
        website_url AS websiteUrl

      FROM brands

      WHERE is_active = 1
        AND deleted_at IS NULL

      ORDER BY name ASC, id ASC
    `,
    {
      type: QueryTypes.SELECT,
    },
  );
}

export async function findCatalogBrands({ category, q } = {}) {
  const replacements = {};

  const conditions = [
    "brand.is_active = 1",
    "brand.deleted_at IS NULL",
    "product.status = 'published'",
    "product.approval_status = 'approved'",
    "product.visibility = 'public'",
    "product.published_at IS NOT NULL",
    "product.deleted_at IS NULL",
  ];

  let commonTableExpression = "";

  if (category) {
    replacements.category = category;

    commonTableExpression = `
      WITH RECURSIVE selected_categories AS (
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
    `;

    conditions.push(`
      EXISTS (
        SELECT 1

        FROM product_categories product_category

        WHERE product_category.product_id = product.id

          AND product_category.category_id IN (
            SELECT id FROM selected_categories
          )
      )
    `);
  }

  if (q) {
    replacements.search = `%${q
      .replaceAll("\\", "\\\\")
      .replaceAll("%", "\\%")
      .replaceAll("_", "\\_")}%`;

    conditions.push(`
      (
        brand.name LIKE :search ESCAPE '\\\\'

        OR brand.code LIKE :search ESCAPE '\\\\'

        OR brand.slug LIKE :search ESCAPE '\\\\'
      )
    `);
  }

  return sequelize.query(
    `
      ${commonTableExpression}

      SELECT
        brand.id,
        brand.code,
        brand.name,
        brand.slug,
        brand.logo_key AS logoKey,
        brand.website_url AS websiteUrl,
        COUNT(DISTINCT product.id) AS productCount

      FROM brands brand

      INNER JOIN products product
        ON product.brand_id = brand.id

      INNER JOIN vendors vendor
        ON vendor.id = product.vendor_id
        AND vendor.status = 'active'
        AND vendor.approval_status = 'approved'
        AND vendor.deleted_at IS NULL

      INNER JOIN (
        SELECT
          variant.product_id

        FROM product_variants variant

        LEFT JOIN inventory
          ON inventory.variant_id = variant.id

        WHERE variant.is_active = 1
          AND variant.deleted_at IS NULL

          AND (
            inventory.allow_backorder = 1

            OR GREATEST(
              COALESCE(
                inventory.quantity_on_hand,
                0
              )
              -
              COALESCE(
                inventory.quantity_reserved,
                0
              ),
              0
            ) > 0
          )

        GROUP BY variant.product_id
      ) stock_summary
        ON stock_summary.product_id =
          product.id

      WHERE ${conditions.join(" AND ")}

      GROUP BY
        brand.id,
        brand.code,
        brand.name,
        brand.slug,
        brand.logo_key,
        brand.website_url

      ORDER BY
        brand.name ASC,
        brand.id ASC
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );
}

export async function findCategoryProductCounts() {
  return sequelize.query(
    `
      WITH RECURSIVE category_closure AS (
        SELECT
          category.id AS ancestor_id,
          category.id AS descendant_id

        FROM categories category

        WHERE category.is_active = 1
          AND category.deleted_at IS NULL

        UNION ALL

        SELECT
          closure.ancestor_id,
          child.id AS descendant_id

        FROM category_closure closure

        INNER JOIN categories child
          ON child.parent_id =
            closure.descendant_id

        WHERE child.is_active = 1
          AND child.deleted_at IS NULL
      ),

      live_products AS (
        SELECT DISTINCT
          product.id

        FROM products product

        INNER JOIN vendors vendor
          ON vendor.id = product.vendor_id
          AND vendor.status = 'active'
          AND vendor.approval_status = 'approved'
          AND vendor.deleted_at IS NULL

        LEFT JOIN brands brand
          ON brand.id = product.brand_id

        INNER JOIN product_variants variant
          ON variant.product_id = product.id
          AND variant.is_active = 1
          AND variant.deleted_at IS NULL

        LEFT JOIN inventory
          ON inventory.variant_id = variant.id

        WHERE product.status = 'published'
          AND product.approval_status = 'approved'
          AND product.visibility = 'public'
          AND product.published_at IS NOT NULL
          AND product.deleted_at IS NULL

          AND (
            product.brand_id IS NULL

            OR (
              brand.is_active = 1
              AND brand.deleted_at IS NULL
            )
          )

          AND (
            inventory.allow_backorder = 1

            OR GREATEST(
              COALESCE(
                inventory.quantity_on_hand,
                0
              )
              -
              COALESCE(
                inventory.quantity_reserved,
                0
              ),
              0
            ) > 0
          )
      )

      SELECT
        closure.ancestor_id AS categoryId,

        COUNT(
          DISTINCT product_category.product_id
        ) AS productCount

      FROM category_closure closure

      INNER JOIN product_categories product_category
        ON product_category.category_id =
          closure.descendant_id

      INNER JOIN live_products live_product
        ON live_product.id =
          product_category.product_id

      GROUP BY closure.ancestor_id
    `,
    {
      type: QueryTypes.SELECT,
    },
  );
}

export async function findActiveCategories({ locale, fallbackLocale }) {
  return sequelize.query(
    `
      SELECT
        category.id,
        category.parent_id AS parentId,
        category.code,
        category.slug,
        category.sort_order AS sortOrder,

        COALESCE(
          translation.name,
          fallback_translation.name,
          category.code
        ) AS name,

        COALESCE(
          translation.description,
          fallback_translation.description
        ) AS description

      FROM categories category

      LEFT JOIN category_translations translation
        ON translation.category_id = category.id
        AND translation.language_code = :locale

      LEFT JOIN category_translations fallback_translation
        ON fallback_translation.category_id = category.id
        AND fallback_translation.language_code = :fallbackLocale

      WHERE category.is_active = 1
        AND category.deleted_at IS NULL

      ORDER BY
        category.sort_order ASC,
        name ASC,
        category.id ASC
    `,
    {
      replacements: {
        locale,
        fallbackLocale,
      },
      type: QueryTypes.SELECT,
    },
  );
}

export async function findActiveColors() {
  return sequelize.query(
    `
      SELECT
        id,
        code,
        name,
        hex_code AS hexCode,
        sort_order AS sortOrder

      FROM colors

      WHERE is_active = 1

      ORDER BY
        sort_order ASC,
        name ASC,
        id ASC
    `,
    {
      type: QueryTypes.SELECT,
    },
  );
}

export async function findActiveSizes() {
  return sequelize.query(
    `
      SELECT
        size_system.id AS systemId,
        size_system.code AS systemCode,
        size_system.name AS systemName,

        size.id,
        size.code,
        size.label,
        size.sort_order AS sortOrder

      FROM size_systems size_system

      INNER JOIN sizes size
        ON size.size_system_id = size_system.id
        AND size.is_active = 1

      WHERE size_system.is_active = 1

      ORDER BY
        size_system.id ASC,
        size.sort_order ASC,
        size.id ASC
    `,
    {
      type: QueryTypes.SELECT,
    },
  );
}

export async function findActiveFitProfiles() {
  return sequelize.query(
    `
      SELECT
        id,
        code,
        name,
        sort_order AS sortOrder

      FROM fit_profiles

      WHERE is_active = 1

      ORDER BY
        sort_order ASC,
        name ASC,
        id ASC
    `,
    {
      type: QueryTypes.SELECT,
    },
  );
}

export async function findFilterableAttributes({ locale }) {
  const labelColumn = locale === "en" ? "label_en" : "label_it";

  const nameColumn = locale === "en" ? "name_en" : "name_it";

  return sequelize.query(
    `
      SELECT
        attribute.id AS attributeId,
        attribute.code AS attributeCode,
        attribute.${nameColumn} AS attributeName,
        attribute.data_type AS dataType,
        attribute.input_type AS inputType,
        attribute.unit_code AS unitCode,
        attribute.allows_multiple AS allowsMultiple,

        attribute_value.id AS valueId,
        attribute_value.code AS valueCode,
        attribute_value.${labelColumn} AS valueLabel,
        attribute_value.sort_order AS valueSortOrder

      FROM attributes attribute

      LEFT JOIN attribute_values attribute_value
        ON attribute_value.attribute_id = attribute.id
        AND attribute_value.is_active = 1

      WHERE attribute.is_active = 1
        AND attribute.is_filterable = 1

      ORDER BY
        attribute.sort_order ASC,
        attribute.id ASC,
        attribute_value.sort_order ASC,
        attribute_value.id ASC
    `,
    {
      type: QueryTypes.SELECT,
    },
  );
}

export async function findPublicProducts(filters) {
  const query = buildPublicProductQuery(filters);

  const offset = (filters.page - 1) * filters.limit;

  const orderBy =
    filters.wishlistAccountId !== undefined
      ? "wishlist_item.created_at DESC, wishlist_item.id DESC"
      : (SORT_SQL[filters.sort] ?? SORT_SQL.featured);

  const countPromise = sequelize.query(
    `
      ${query.commonTableExpression}

      SELECT
        COUNT(DISTINCT product.id) AS total

      ${query.fromSql}

      WHERE ${query.whereSql}
    `,
    {
      replacements: query.replacements,
      type: QueryTypes.SELECT,
    },
  );

  const rowsPromise = sequelize.query(
    `
      ${query.commonTableExpression}

      SELECT
        product.id,
        product.code,
        product.slug,
        product.currency_code AS currencyCode,
        product.is_featured AS isFeatured,
        product.try_on_ready AS tryOnReady,
        product.published_at AS publishedAt,

        COALESCE(
          translation.name,
          fallback_translation.name,
          product.code
        ) AS name,

        COALESCE(
          translation.short_description,
          fallback_translation.short_description
        ) AS shortDescription,

        brand.id AS brandId,
        brand.name AS brandName,
        brand.slug AS brandSlug,

        vendor.id AS vendorId,
        vendor.slug AS vendorSlug,
        vendor.display_name AS vendorName,
        vendor.logo_key AS vendorLogoKey,

        fit_profile.id AS fitId,
        fit_profile.code AS fitCode,
        fit_profile.name AS fitName,

        price_summary.min_regular_price AS minRegularPrice,
        price_summary.max_regular_price AS maxRegularPrice,
        price_summary.min_current_price AS minCurrentPrice,
        price_summary.max_current_price AS maxCurrentPrice,
        price_summary.in_stock AS inStock,
        price_summary.low_stock AS lowStock,

        review_summary.rating_average AS ratingAverage,
        review_summary.rating_count AS ratingCount,

        (
          SELECT media.storage_key

          FROM product_media media

          WHERE media.product_id = product.id
            AND media.media_type = 'image'
            AND media.moderation_status = 'approved'
            AND media.deleted_at IS NULL

          ORDER BY
            media.is_primary DESC,
            media.sort_order ASC,
            media.id ASC

          LIMIT 1
        ) AS imageStorageKey,

        (
          SELECT media.alt_text

          FROM product_media media

          WHERE media.product_id = product.id
            AND media.media_type = 'image'
            AND media.moderation_status = 'approved'
            AND media.deleted_at IS NULL

          ORDER BY
            media.is_primary DESC,
            media.sort_order ASC,
            media.id ASC

          LIMIT 1
        ) AS imageAltText,

        (
          SELECT media.width

          FROM product_media media

          WHERE media.product_id = product.id
            AND media.media_type = 'image'
            AND media.moderation_status = 'approved'
            AND media.deleted_at IS NULL

          ORDER BY
            media.is_primary DESC,
            media.sort_order ASC,
            media.id ASC

          LIMIT 1
        ) AS imageWidth,

        (
          SELECT media.height

          FROM product_media media

          WHERE media.product_id = product.id
            AND media.media_type = 'image'
            AND media.moderation_status = 'approved'
            AND media.deleted_at IS NULL

          ORDER BY
            media.is_primary DESC,
            media.sort_order ASC,
            media.id ASC

          LIMIT 1
        ) AS imageHeight,

        (
          SELECT media.storage_key

          FROM product_media media

          WHERE media.product_id = product.id
            AND media.media_type = 'image'
            AND media.moderation_status = 'approved'
            AND media.deleted_at IS NULL

          ORDER BY
            media.is_primary DESC,
            media.sort_order ASC,
            media.id ASC

          LIMIT 1 OFFSET 1
        ) AS hoverImageStorageKey,

        (
          SELECT media.alt_text

          FROM product_media media

          WHERE media.product_id = product.id
            AND media.media_type = 'image'
            AND media.moderation_status = 'approved'
            AND media.deleted_at IS NULL

          ORDER BY
            media.is_primary DESC,
            media.sort_order ASC,
            media.id ASC

          LIMIT 1 OFFSET 1
        ) AS hoverImageAltText

      ${query.fromSql}

      WHERE ${query.whereSql}

      ORDER BY ${orderBy}

      LIMIT :limit
      OFFSET :offset
    `,
    {
      replacements: {
        ...query.replacements,
        limit: filters.limit,
        offset,
      },

      type: QueryTypes.SELECT,
    },
  );

  const [[countRow], rows] = await Promise.all([countPromise, rowsPromise]);

  return {
    rows,
    total: Number(countRow?.total ?? 0),
  };
}

export async function findProductColors(productIds) {
  if (productIds.length === 0) {
    return [];
  }

  return sequelize.query(
    `
      SELECT DISTINCT
        variant.product_id AS productId,
        color.id,
        color.code,
        color.name,
        color.hex_code AS hexCode,
        color.sort_order AS sortOrder

      FROM product_variants variant

      INNER JOIN colors color
        ON color.id = variant.color_id
        AND color.is_active = 1

      WHERE variant.product_id IN (:productIds)
        AND variant.is_active = 1
        AND variant.deleted_at IS NULL

      ORDER BY
        color.sort_order ASC,
        color.id ASC
    `,
    {
      replacements: {
        productIds,
      },
      type: QueryTypes.SELECT,
    },
  );
}

export async function findPublicProductBySlug({
  slug,
  locale,
  fallbackLocale,
}) {
  const filters = {
    locale,
    fallbackLocale,

    category: undefined,
    audience: undefined,

    brand: [],
    color: [],
    size: [],
    fit: [],

    featured: undefined,
    q: undefined,

    inStock: undefined,

    minPrice: undefined,
    maxPrice: undefined,
    minDiscount: undefined,

    onSale: undefined,
    tryOn: undefined,
  };

  const query = buildPublicProductQuery(filters);

  const rows = await sequelize.query(
    `
      SELECT
        product.id,
        product.code,
        product.slug,
        product.currency_code AS currencyCode,
        product.is_featured AS isFeatured,
        product.try_on_ready AS tryOnReady,
        product.is_returnable AS isReturnable,
        product.return_window_days AS returnWindowDays,
        product.published_at AS publishedAt,

        COALESCE(
          translation.name,
          fallback_translation.name,
          product.code
        ) AS name,

        COALESCE(
          translation.short_description,
          fallback_translation.short_description
        ) AS shortDescription,

        COALESCE(
          translation.description,
          fallback_translation.description
        ) AS description,

        COALESCE(
          translation.care_instructions,
          fallback_translation.care_instructions
        ) AS careInstructions,

        COALESCE(
          translation.size_and_fit_notes,
          fallback_translation.size_and_fit_notes
        ) AS sizeAndFitNotes,

        brand.id AS brandId,
        brand.code AS brandCode,
        brand.name AS brandName,
        brand.slug AS brandSlug,
        brand.logo_key AS brandLogoKey,

        vendor.id AS vendorId,
        vendor.slug AS vendorSlug,
        vendor.display_name AS vendorName,
        vendor.logo_key AS vendorLogoKey,

        fit_profile.id AS fitId,
        fit_profile.code AS fitCode,
        fit_profile.name AS fitName,

        price_summary.min_regular_price AS minRegularPrice,
        price_summary.max_regular_price AS maxRegularPrice,
        price_summary.min_current_price AS minCurrentPrice,
        price_summary.max_current_price AS maxCurrentPrice,
        price_summary.in_stock AS inStock,

        review_summary.rating_average AS ratingAverage,
        review_summary.rating_count AS ratingCount

      ${PUBLIC_PRODUCT_FROM_SQL}

      WHERE ${query.whereSql}
        AND product.slug = :slug

      LIMIT 1
    `,
    {
      replacements: {
        ...query.replacements,
        slug,
      },
      type: QueryTypes.SELECT,
    },
  );

  return rows[0] ?? null;
}

export async function findProductDetailRelations({
  productId,
  locale,
  fallbackLocale,
}) {
  const localizedAttributeName = locale === "en" ? "name_en" : "name_it";

  const localizedAttributeLabel = locale === "en" ? "label_en" : "label_it";

  const currentPriceSql = ACTIVE_SALE_SQL.replaceAll("variant.", "variant.");

  const mediaPromise = sequelize.query(
    `
      SELECT
        media.id,
        media.variant_id AS variantId,
        color.code AS colorCode,
        media.media_type AS mediaType,
        media.storage_key AS storageKey,
        media.mime_type AS mimeType,
        media.alt_text AS altText,
        media.width,
        media.height,
        media.duration_seconds AS durationSeconds,
        media.is_primary AS isPrimary

      FROM product_media media

      LEFT JOIN product_variants media_variant
        ON media_variant.id = media.variant_id

      LEFT JOIN colors color
        ON color.id = media_variant.color_id
        AND color.is_active = 1

      WHERE media.product_id = :productId
        AND media.moderation_status = 'approved'
        AND media.deleted_at IS NULL

      ORDER BY
        media.is_primary DESC,
        media.sort_order ASC,
        media.id ASC
    `,
    {
      replacements: {
        productId,
      },
      type: QueryTypes.SELECT,
    },
  );

  const variantsPromise = sequelize.query(
    `
      SELECT
        variant.id,
        variant.sku,

        size.id AS sizeId,
        size.code AS sizeCode,
        size.label AS sizeLabel,

        size_system.code AS sizeSystemCode,
        size_system.name AS sizeSystemName,

        color.id AS colorId,
        color.code AS colorCode,
        color.name AS colorName,
        color.hex_code AS colorHexCode,

        variant.regular_price AS regularPrice,
        ${currentPriceSql} AS currentPrice,

        variant.is_default AS isDefault,
        variant.weight_value AS weightValue,
        variant.weight_unit AS weightUnit,

        CASE
          WHEN inventory.allow_backorder = 1
            OR GREATEST(
              COALESCE(
                inventory.quantity_on_hand,
                0
              )
              -
              COALESCE(
                inventory.quantity_reserved,
                0
              ),
              0
            ) > 0
          THEN 1
          ELSE 0
        END AS inStock,

        COALESCE(
          inventory.allow_backorder,
          0
        ) AS allowsBackorder,

        GREATEST(
          COALESCE(
            inventory.quantity_on_hand,
            0
          )
          -
          COALESCE(
            inventory.quantity_reserved,
            0
          ),
          0
        ) AS availableQuantity

      FROM product_variants variant

      LEFT JOIN sizes size
        ON size.id = variant.size_id
        AND size.is_active = 1

      LEFT JOIN size_systems size_system
        ON size_system.id = size.size_system_id
        AND size_system.is_active = 1

      LEFT JOIN colors color
        ON color.id = variant.color_id
        AND color.is_active = 1

      LEFT JOIN inventory
        ON inventory.variant_id = variant.id

      WHERE variant.product_id = :productId
        AND variant.is_active = 1
        AND variant.deleted_at IS NULL

      ORDER BY
        variant.is_default DESC,
        variant.sort_order ASC,
        variant.id ASC
    `,
    {
      replacements: {
        productId,
      },
      type: QueryTypes.SELECT,
    },
  );

  const categoriesPromise = sequelize.query(
    `
      SELECT
        category.id,
        category.code,
        category.slug,

        COALESCE(
          translation.name,
          fallback_translation.name,
          category.code
        ) AS name,

        product_category.is_primary AS isPrimary

      FROM product_categories product_category

      INNER JOIN categories category
        ON category.id =
          product_category.category_id
        AND category.is_active = 1
        AND category.deleted_at IS NULL

      LEFT JOIN category_translations translation
        ON translation.category_id =
          category.id
        AND translation.language_code =
          :locale

      LEFT JOIN category_translations fallback_translation
        ON fallback_translation.category_id =
          category.id
        AND fallback_translation.language_code =
          :fallbackLocale

      WHERE product_category.product_id =
        :productId

      ORDER BY
        product_category.is_primary DESC,
        product_category.sort_order ASC,
        category.id ASC
    `,
    {
      replacements: {
        productId,
        locale,
        fallbackLocale,
      },
      type: QueryTypes.SELECT,
    },
  );

  const breadcrumbsPromise = sequelize.query(
    `
      WITH RECURSIVE breadcrumb AS (
        SELECT
          category.id,
          category.parent_id AS parentId,
          category.code,
          category.slug,

          COALESCE(
            translation.name,
            fallback_translation.name,
            category.code
          ) AS name,

          0 AS depth

        FROM product_categories product_category

        INNER JOIN categories category
          ON category.id =
            product_category.category_id
          AND category.is_active = 1
          AND category.deleted_at IS NULL

        LEFT JOIN category_translations translation
          ON translation.category_id =
            category.id
          AND translation.language_code =
            :locale

        LEFT JOIN category_translations fallback_translation
          ON fallback_translation.category_id =
            category.id
          AND fallback_translation.language_code =
            :fallbackLocale

        WHERE product_category.product_id =
          :productId

          AND product_category.is_primary =
            1

        UNION ALL

        SELECT
          parent.id,
          parent.parent_id AS parentId,
          parent.code,
          parent.slug,

          COALESCE(
            parent_translation.name,
            parent_fallback_translation.name,
            parent.code
          ) AS name,

          child.depth + 1 AS depth

        FROM breadcrumb child

        INNER JOIN categories parent
          ON parent.id = child.parentId
          AND parent.is_active = 1
          AND parent.deleted_at IS NULL

        LEFT JOIN category_translations parent_translation
          ON parent_translation.category_id =
            parent.id
          AND parent_translation.language_code =
            :locale

        LEFT JOIN category_translations parent_fallback_translation
          ON parent_fallback_translation.category_id =
            parent.id
          AND parent_fallback_translation.language_code =
            :fallbackLocale
      )

      SELECT
        id,
        code,
        slug,
        name

      FROM breadcrumb

      ORDER BY
        depth DESC,
        id ASC
    `,
    {
      replacements: {
        productId,
        locale,
        fallbackLocale,
      },
      type: QueryTypes.SELECT,
    },
  );

  const attributesPromise = sequelize.query(
    `
      SELECT
        product_value.variant_id AS variantId,

        attribute.id AS attributeId,
        attribute.code AS attributeCode,
        attribute.${localizedAttributeName} AS attributeName,
        attribute.data_type AS dataType,
        attribute.unit_code AS defaultUnitCode,

        option_value.id AS optionId,
        option_value.code AS optionCode,
        option_value.${localizedAttributeLabel} AS optionLabel,

        product_value.value_text AS valueText,
        product_value.value_decimal AS valueDecimal,
        product_value.value_boolean AS valueBoolean,
        product_value.unit_code AS unitCode

      FROM product_attribute_values product_value

      INNER JOIN attributes attribute
        ON attribute.id =
          product_value.attribute_id
        AND attribute.is_active = 1

      LEFT JOIN attribute_values option_value
        ON option_value.id =
          product_value.attribute_value_id
        AND option_value.is_active = 1

      WHERE product_value.product_id =
        :productId

      ORDER BY
        attribute.sort_order ASC,
        product_value.id ASC
    `,
    {
      replacements: {
        productId,
      },
      type: QueryTypes.SELECT,
    },
  );

  const measurementsPromise = sequelize.query(
    `
      SELECT
        measurement.variant_id AS variantId,

        measurement_type.code,
        measurement_type.${localizedAttributeName} AS name,

        measurement.value_cm AS valueCm,
        measurement.tolerance_plus_cm AS tolerancePlusCm,
        measurement.tolerance_minus_cm AS toleranceMinusCm,
        measurement.is_estimated AS isEstimated

      FROM garment_measurements measurement

      INNER JOIN garment_measurement_types measurement_type
        ON measurement_type.id =
          measurement.measurement_type_id
        AND measurement_type.is_active = 1

      INNER JOIN product_variants variant
        ON variant.id =
          measurement.variant_id
        AND variant.product_id =
          :productId
        AND variant.is_active = 1
        AND variant.deleted_at IS NULL

      ORDER BY
        measurement.variant_id ASC,
        measurement_type.sort_order ASC,
        measurement.id ASC
    `,
    {
      replacements: {
        productId,
      },
      type: QueryTypes.SELECT,
    },
  );

  const [media, variants, categories, breadcrumbs, attributes, measurements] =
    await Promise.all([
      mediaPromise,
      variantsPromise,
      categoriesPromise,
      breadcrumbsPromise,
      attributesPromise,
      measurementsPromise,
    ]);

  return {
    media,
    variants,
    categories,
    breadcrumbs,
    attributes,
    measurements,
  };
}
