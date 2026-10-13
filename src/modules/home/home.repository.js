import { QueryTypes } from "sequelize";

import { sequelize } from "../../config/database.js";

/*
|--------------------------------------------------------------------------
| Home Feed Queries
|--------------------------------------------------------------------------
|
| A placement is only returned when it is live and its referenced entity is
| still public. This prevents an old campaign from exposing an archived
| product or an inactive brand after its underlying catalog data changes.
|
*/

export async function findLiveHomePlacements(locale, fallbackLocale) {
  return sequelize.query(
    `
      SELECT
        placement.id,
        placement.section_key AS sectionKey,
        placement.target_type AS targetType,
        placement.target_filters AS targetFilters,
        placement.link_path AS linkPath,
        placement.link_query AS linkQuery,
        placement.external_url AS externalUrl,
        placement.offer_payload AS offerPayload,
        placement.image_storage_key AS imageStorageKey,
        placement.image_width AS imageWidth,
        placement.image_height AS imageHeight,
        placement.title_en AS titleEn,
        placement.title_it AS titleIt,
        placement.subtitle_en AS subtitleEn,
        placement.subtitle_it AS subtitleIt,
        placement.cta_label_en AS ctaLabelEn,
        placement.cta_label_it AS ctaLabelIt,
        placement.alt_text_en AS altTextEn,
        placement.alt_text_it AS altTextIt,
        placement.badge_en AS badgeEn,
        placement.badge_it AS badgeIt,
        placement.discount_label_en AS discountLabelEn,
        placement.discount_label_it AS discountLabelIt,
        placement.sort_order AS sortOrder,
        placement.starts_at AS startsAt,
        placement.ends_at AS endsAt,
        CASE
          WHEN target_vendor.id IS NULL THEN NULL
          ELSE target_product.id
        END AS publicTargetProductId,
        COALESCE(
          product_translation.name,
          fallback_product_translation.name,
          target_product.code
        ) AS targetProductName,
        target_product.currency_code AS targetProductCurrency,
        (
          SELECT MIN(
            CASE
              WHEN product_variant.sale_price IS NOT NULL
                AND (product_variant.sale_start_at IS NULL OR product_variant.sale_start_at <= UTC_TIMESTAMP())
                AND (product_variant.sale_end_at IS NULL OR product_variant.sale_end_at >= UTC_TIMESTAMP())
              THEN LEAST(product_variant.sale_price, product_variant.regular_price)
              ELSE product_variant.regular_price
            END
          )
          FROM product_variants product_variant
          WHERE product_variant.product_id = target_product.id
            AND product_variant.is_active = 1
            AND product_variant.deleted_at IS NULL
        ) AS targetProductPrice,
        (
          SELECT MIN(product_variant.regular_price)
          FROM product_variants product_variant
          WHERE product_variant.product_id = target_product.id
            AND product_variant.is_active = 1
            AND product_variant.deleted_at IS NULL
        ) AS targetProductMrp,
        (
          SELECT product_media.storage_key
          FROM product_media
          WHERE product_media.product_id = target_product.id
            AND product_media.media_type = 'image'
            AND product_media.moderation_status = 'approved'
            AND product_media.deleted_at IS NULL
          ORDER BY product_media.is_primary DESC, product_media.sort_order ASC, product_media.id ASC
          LIMIT 1
        ) AS targetProductImageStorageKey,
        product_brand.name AS targetProductBrandName,
        product_brand.id AS targetProductBrandId,
        target_brand.id AS publicTargetBrandId,
        target_brand.name AS targetBrandName,
        target_brand.logo_key AS targetBrandLogoKey,
        target_category.id AS publicTargetCategoryId,
        target_category.slug AS targetCategorySlug
      FROM home_placements placement
      LEFT JOIN products target_product
        ON target_product.id = placement.target_product_id
        AND target_product.deleted_at IS NULL
        AND target_product.status = 'published'
        AND target_product.approval_status = 'approved'
        AND target_product.visibility = 'public'
        AND target_product.published_at IS NOT NULL
      LEFT JOIN vendors target_vendor
        ON target_vendor.id = target_product.vendor_id
        AND target_vendor.deleted_at IS NULL
        AND target_vendor.status = 'active'
        AND target_vendor.approval_status = 'approved'
      LEFT JOIN product_translations product_translation
        ON product_translation.product_id = target_product.id
        AND product_translation.language_code = :locale
      LEFT JOIN product_translations fallback_product_translation
        ON fallback_product_translation.product_id = target_product.id
        AND fallback_product_translation.language_code = :fallbackLocale
      LEFT JOIN brands product_brand
        ON product_brand.id = target_product.brand_id
        AND product_brand.deleted_at IS NULL
        AND product_brand.is_active = 1
      LEFT JOIN brands target_brand
        ON target_brand.id = placement.target_brand_id
        AND target_brand.deleted_at IS NULL
        AND target_brand.is_active = 1
      LEFT JOIN categories target_category
        ON target_category.id = placement.target_category_id
        AND target_category.deleted_at IS NULL
        AND target_category.is_active = 1
      WHERE placement.section_key IN (
          'hero',
          'audience',
          'top_brand',
          'lookbook',
          'promotion',
          'offer'
        )
        AND placement.status = 'live'
        AND placement.deleted_at IS NULL
        AND (placement.starts_at IS NULL OR placement.starts_at <= UTC_TIMESTAMP())
        AND (placement.ends_at IS NULL OR placement.ends_at > UTC_TIMESTAMP())
      ORDER BY
        FIELD(
          placement.section_key,
          'hero',
          'audience',
          'top_brand',
          'lookbook',
          'promotion',
          'offer'
        ) ASC,
        placement.sort_order ASC,
        placement.id ASC
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
