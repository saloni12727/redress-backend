-- Demo Home-feed content for Flutter testing.
-- Run only against an isolated development/test database after migrations and
-- demo catalog/media have been seeded. It publishes and discounts the named
-- demo products so every catalog-backed Home rail has cards. It never changes
-- users or S3 objects. Upload Home artwork first with:
--   npm run storage:upload:home:test
--
-- Home banners, brand cards, audience cards, lookbook and offer tiles use
-- separately downloaded Unsplash demo images stored under private S3 home/.
-- The upload script crops each image to its approved Admin CMS section ratio.
-- Re-running this fixture preserves existing placements and refreshes only its
-- own Home demo rows.
-- Preferred commands from the backend project root:
--   npm run setup:home-feed:dev
--   npm run setup:home-feed:test

-- Preflight: expected seeded roots, products, and approved product images.
SELECT
  (SELECT COUNT(*) FROM categories
   WHERE slug IN ('women', 'men', 'kids')
     AND is_active = 1 AND deleted_at IS NULL) AS audience_categories,
  (SELECT COUNT(*) FROM products
   WHERE code IN (
     'RD-W-DRESS-001',
     'RD-M-SHIRT-001',
     'RD-G-DRESS-001',
     'RD-M-TSHIRT-001'
   )
     AND deleted_at IS NULL) AS demo_products,
  (SELECT COUNT(DISTINCT product.code)
   FROM products product
   INNER JOIN product_media media
     ON media.product_id = product.id
    AND media.media_type = 'image'
    AND media.moderation_status = 'approved'
    AND media.deleted_at IS NULL
   WHERE product.code IN (
     'RD-W-DRESS-001',
     'RD-M-SHIRT-001',
     'RD-G-DRESS-001',
     'RD-M-TSHIRT-001'
   )) AS products_with_approved_images,
  (SELECT COUNT(DISTINCT brand.slug)
   FROM brands brand
   INNER JOIN products product
     ON product.brand_id = brand.id
    AND product.code IN ('RD-W-DRESS-001', 'RD-G-DRESS-001')
    AND product.deleted_at IS NULL
   WHERE brand.slug IN ('modaviva', 'velora')
     AND brand.is_active = 1 AND brand.deleted_at IS NULL) AS featured_brands,
  (SELECT COUNT(*)
   FROM brands
   WHERE slug IN (
     'redress-essentials',
     'urban-loom',
     'modaviva',
     'north-thread',
     'velora',
     'atelier-nova'
   )
     AND is_active = 1 AND deleted_at IS NULL) AS home_demo_brands;

START TRANSACTION;

-- Test-only catalog readiness for aiPicks, deals, try-on demo and trending demo.
UPDATE vendors vendor
INNER JOIN products product ON product.vendor_id = vendor.id
SET vendor.status = 'active',
    vendor.approval_status = 'approved'
WHERE product.code IN (
  'RD-W-DRESS-001',
  'RD-M-SHIRT-001',
  'RD-G-DRESS-001',
  'RD-M-TSHIRT-001'
)
  AND vendor.deleted_at IS NULL;

UPDATE products
SET status = 'published',
    approval_status = 'approved',
    visibility = 'public',
    is_featured = 1,
    published_at = COALESCE(published_at, UTC_TIMESTAMP())
WHERE code IN (
  'RD-W-DRESS-001',
  'RD-M-SHIRT-001',
  'RD-G-DRESS-001',
  'RD-M-TSHIRT-001'
)
  AND deleted_at IS NULL;

UPDATE product_variants variant
INNER JOIN products product ON product.id = variant.product_id
SET variant.sale_price = ROUND(variant.regular_price * 0.60, 2),
    variant.sale_start_at = UTC_TIMESTAMP() - INTERVAL 1 DAY,
    variant.sale_end_at = UTC_TIMESTAMP() + INTERVAL 30 DAY
WHERE product.code IN (
  'RD-W-DRESS-001',
  'RD-M-SHIRT-001',
  'RD-G-DRESS-001',
  'RD-M-TSHIRT-001'
)
  AND variant.is_active = 1
  AND variant.deleted_at IS NULL
  AND variant.regular_price > 0;

-- Preserve existing Home content. Refresh artwork only for this fixture's
-- explicit test rows, including all tagged brand/lookbook/offer rows.
UPDATE home_placements
SET image_storage_key = CASE title_en
      WHEN '[TEST HOME] Autumn edit' THEN 'home/banners/test-women.webp'
      WHEN '[TEST HOME] Smart essentials' THEN 'home/banners/test-men.webp'
      WHEN '[TEST HOME] Women' THEN 'home/audience/test-women.webp'
      WHEN '[TEST HOME] Men' THEN 'home/audience/test-men.webp'
      WHEN '[TEST HOME] Kids' THEN 'home/audience/test-kids.webp'
      WHEN '[TEST HOME] ModaViva' THEN 'home/brands/test-modaviva.webp'
      WHEN '[TEST HOME] Velora' THEN 'home/brands/test-velora.webp'
      WHEN '[TEST HOME] Redress Essentials' THEN 'home/brands/test-redress-essentials.webp'
      WHEN '[TEST HOME] Urban Loom' THEN 'home/brands/test-urban-loom.webp'
      WHEN '[TEST HOME] North Thread' THEN 'home/brands/test-north-thread.webp'
      WHEN '[TEST HOME] Atelier Nova' THEN 'home/brands/test-atelier-nova.webp'
      WHEN '[TEST HOME] Floral edit' THEN 'home/lookbook/test-women.webp'
      WHEN '[TEST HOME] Menswear edit' THEN 'home/lookbook/test-men.webp'
      WHEN '[TEST HOME] Style Studio' THEN 'home/promotion/test-style-studio.webp'
      WHEN '[TEST HOME] Weekend picks' THEN 'home/offers/test-weekend.webp'
      WHEN '[TEST HOME] Daily offers' THEN 'home/offers/test-daily.webp'
      ELSE image_storage_key
    END,
    image_width = CASE
      WHEN section_key IN ('hero', 'promotion') THEN 1440
      WHEN section_key = 'top_brand' THEN 800
      WHEN section_key IN ('audience', 'offer') THEN 900
      WHEN section_key = 'lookbook' THEN 1080
      ELSE image_width
    END,
    image_height = CASE
      WHEN section_key IN ('hero', 'promotion') THEN 810
      WHEN section_key = 'top_brand' THEN 800
      WHEN section_key IN ('audience', 'offer') THEN 1200
      WHEN section_key = 'lookbook' THEN 1350
      ELSE image_height
    END,
    image_content_type = CASE
      WHEN section_key IN ('hero', 'top_brand', 'audience', 'lookbook', 'promotion', 'offer') THEN 'image/webp'
      ELSE image_content_type
    END,
    target_type = CASE
      WHEN title_en IN ('[TEST HOME] Weekend picks', '[TEST HOME] Daily offers') THEN 'catalog'
      ELSE target_type
    END,
    target_filters = CASE
      WHEN title_en IN ('[TEST HOME] Style Studio', '[TEST HOME] Weekend picks', '[TEST HOME] Daily offers')
        THEN JSON_OBJECT('sort', 'featured', 'inStock', TRUE)
      ELSE target_filters
    END,
    offer_payload = CASE
      WHEN title_en IN ('[TEST HOME] Weekend picks', '[TEST HOME] Daily offers') THEN NULL
      ELSE offer_payload
    END,
    updated_at = UTC_TIMESTAMP()
WHERE source = 'admin'
  AND deleted_at IS NULL
  AND title_en IN (
    '[TEST HOME] Autumn edit',
    '[TEST HOME] Smart essentials',
    '[TEST HOME] Women',
    '[TEST HOME] Men',
    '[TEST HOME] Kids',
    '[TEST HOME] ModaViva',
    '[TEST HOME] Velora',
    '[TEST HOME] Redress Essentials',
    '[TEST HOME] Urban Loom',
    '[TEST HOME] North Thread',
    '[TEST HOME] Atelier Nova',
    '[TEST HOME] Floral edit',
    '[TEST HOME] Menswear edit',
    '[TEST HOME] Style Studio',
    '[TEST HOME] Weekend picks',
    '[TEST HOME] Daily offers'
  );

-- Women banner, linked to a real public demo product.
INSERT INTO home_placements (
  section_key, target_type, target_product_id,
  image_storage_key, image_width, image_height, image_content_type,
  title_en, title_it, subtitle_en, subtitle_it,
  cta_label_en, cta_label_it, alt_text_en, alt_text_it,
  source, status, starts_at, ends_at, sort_order, published_at,
  created_at, updated_at
)
SELECT
  'hero', 'product', product.id,
  'home/banners/test-women.webp', 1440, 810, 'image/webp',
  '[TEST HOME] Autumn edit', '[TEST HOME] Selezione autunnale',
  'Discover the latest styles', 'Scopri i nuovi stili',
  'Shop now', 'Acquista ora',
  'Woman shopping for seasonal fashion', 'Donna che sceglie la moda stagionale',
  'admin', 'live', UTC_TIMESTAMP() - INTERVAL 1 DAY,
  UTC_TIMESTAMP() + INTERVAL 30 DAY, 1, UTC_TIMESTAMP(),
  UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM products product
INNER JOIN vendors vendor
  ON vendor.id = product.vendor_id
 AND vendor.status = 'active'
 AND vendor.approval_status = 'approved'
 AND vendor.deleted_at IS NULL
WHERE product.code = 'RD-W-DRESS-001'
  AND product.status = 'published'
  AND product.approval_status = 'approved'
  AND product.visibility = 'public'
  AND product.published_at IS NOT NULL
  AND product.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM home_placements existing
    WHERE existing.source = 'admin'
      AND existing.title_en = '[TEST HOME] Autumn edit'
      AND existing.deleted_at IS NULL
  )
LIMIT 1;

-- Second banner, linked to a real public menswear demo product.
INSERT INTO home_placements (
  section_key, target_type, target_product_id,
  image_storage_key, image_width, image_height, image_content_type,
  title_en, title_it, subtitle_en, subtitle_it,
  cta_label_en, cta_label_it, alt_text_en, alt_text_it,
  source, status, starts_at, ends_at, sort_order, published_at,
  created_at, updated_at
)
SELECT
  'hero', 'product', product.id,
  'home/banners/test-men.webp', 1440, 810, 'image/webp',
  '[TEST HOME] Smart essentials', '[TEST HOME] Essenziali eleganti',
  'Tailored pieces for every day', 'Capi curati per ogni giorno',
  'Shop menswear', 'Scopri uomo',
  'Menswear street style', 'Stile urbano uomo',
  'admin', 'live', UTC_TIMESTAMP() - INTERVAL 1 DAY,
  UTC_TIMESTAMP() + INTERVAL 30 DAY, 2, UTC_TIMESTAMP(),
  UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM products product
INNER JOIN vendors vendor
  ON vendor.id = product.vendor_id
 AND vendor.status = 'active'
 AND vendor.approval_status = 'approved'
 AND vendor.deleted_at IS NULL
WHERE product.code = 'RD-M-SHIRT-001'
  AND product.status = 'published'
  AND product.approval_status = 'approved'
  AND product.visibility = 'public'
  AND product.published_at IS NOT NULL
  AND product.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM home_placements existing
    WHERE existing.source = 'admin'
      AND existing.title_en = '[TEST HOME] Smart essentials'
      AND existing.deleted_at IS NULL
  )
LIMIT 1;

-- Second featured brand, using its own downloaded editorial artwork.
INSERT INTO home_placements (
  section_key, target_type, target_brand_id,
  image_storage_key, image_width, image_height, image_content_type,
  title_en, title_it, subtitle_en, subtitle_it, alt_text_en, alt_text_it,
  source, status, starts_at, ends_at, sort_order, published_at,
  created_at, updated_at
)
SELECT
  'top_brand', 'brand', brand.id,
  'home/brands/test-velora.webp', 800, 800, 'image/webp',
  '[TEST HOME] Velora', '[TEST HOME] Velora',
  'Featured kidswear brand', 'Brand bambini in evidenza',
  'Girls party dress by Velora', 'Abito da festa Velora',
  'admin', 'live', UTC_TIMESTAMP() - INTERVAL 1 DAY,
  UTC_TIMESTAMP() + INTERVAL 30 DAY, 2, UTC_TIMESTAMP(),
  UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM brands brand
INNER JOIN products product
  ON product.brand_id = brand.id
 AND product.code = 'RD-G-DRESS-001'
 AND product.status = 'published'
 AND product.approval_status = 'approved'
 AND product.visibility = 'public'
 AND product.published_at IS NOT NULL
 AND product.deleted_at IS NULL
INNER JOIN vendors vendor
  ON vendor.id = product.vendor_id
 AND vendor.status = 'active'
 AND vendor.approval_status = 'approved'
 AND vendor.deleted_at IS NULL
WHERE brand.slug = 'velora'
  AND brand.is_active = 1
  AND brand.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM home_placements existing
    WHERE existing.section_key = 'top_brand'
      AND existing.target_type = 'brand'
      AND existing.target_brand_id = brand.id
      AND existing.deleted_at IS NULL
  )
LIMIT 1;

-- Add demo artwork for the other four seeded brands, keeping their real brand
-- identity and destination. This is editorial art, not an official logo.
INSERT INTO home_placements (
  section_key, target_type, target_brand_id,
  image_storage_key, image_width, image_height, image_content_type,
  title_en, title_it, subtitle_en, subtitle_it, alt_text_en, alt_text_it,
  source, status, starts_at, ends_at, sort_order, published_at,
  created_at, updated_at
)
SELECT
  'top_brand', 'brand', brand.id,
  CASE brand.slug
    WHEN 'redress-essentials' THEN 'home/brands/test-redress-essentials.webp'
    WHEN 'urban-loom' THEN 'home/brands/test-urban-loom.webp'
    WHEN 'north-thread' THEN 'home/brands/test-north-thread.webp'
    WHEN 'atelier-nova' THEN 'home/brands/test-atelier-nova.webp'
  END,
  800, 800, 'image/webp',
  CONCAT('[TEST HOME] ', brand.name), CONCAT('[TEST HOME] ', brand.name),
  'Discover the collection', 'Scopri la collezione',
  CONCAT('Editorial fashion artwork for ', brand.name),
  CONCAT('Immagine editoriale moda per ', brand.name),
  'admin', 'live', UTC_TIMESTAMP() - INTERVAL 1 DAY,
  UTC_TIMESTAMP() + INTERVAL 30 DAY,
  CASE brand.slug
    WHEN 'redress-essentials' THEN 3
    WHEN 'urban-loom' THEN 4
    WHEN 'north-thread' THEN 5
    WHEN 'atelier-nova' THEN 6
  END,
  UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM brands brand
WHERE brand.slug IN (
    'redress-essentials',
    'urban-loom',
    'north-thread',
    'atelier-nova'
  )
  AND brand.is_active = 1
  AND brand.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM home_placements existing
    WHERE existing.section_key = 'top_brand'
      AND existing.target_type = 'brand'
      AND existing.target_brand_id = brand.id
      AND existing.deleted_at IS NULL
  );

-- Audience artwork/labels use their own downloaded demo photos.
INSERT INTO home_placements (
  section_key, target_type, target_category_id,
  image_storage_key, image_width, image_height, image_content_type,
  title_en, title_it, alt_text_en, alt_text_it,
  source, status, starts_at, ends_at, sort_order, published_at,
  created_at, updated_at
)
SELECT
  'audience', 'category', category.id,
  CASE category.slug
    WHEN 'women' THEN 'home/audience/test-women.webp'
    WHEN 'men' THEN 'home/audience/test-men.webp'
    ELSE 'home/audience/test-kids.webp'
  END,
  900, 1200, 'image/webp',
  CASE category.slug
    WHEN 'women' THEN '[TEST HOME] Women'
    WHEN 'men' THEN '[TEST HOME] Men'
    ELSE '[TEST HOME] Kids'
  END,
  CASE category.slug
    WHEN 'women' THEN '[TEST HOME] Donna'
    WHEN 'men' THEN '[TEST HOME] Uomo'
    ELSE '[TEST HOME] Bambini'
  END,
  CONCAT('Shop ', category.slug),
  CONCAT('Scopri ', category.slug),
  'admin', 'live', UTC_TIMESTAMP() - INTERVAL 1 DAY,
  UTC_TIMESTAMP() + INTERVAL 30 DAY,
  CASE category.slug WHEN 'women' THEN 1 WHEN 'men' THEN 2 ELSE 3 END,
  UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM categories category
WHERE category.slug IN ('women', 'men', 'kids')
  AND category.is_active = 1
  AND category.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM home_placements existing
    WHERE existing.section_key = 'audience'
      AND existing.target_category_id = category.id
      AND existing.deleted_at IS NULL
  )
ORDER BY category.sort_order;

-- Featured-brand rail. The placement image is demo artwork; brand identity
-- and destination still come from the referenced active brand row.
INSERT INTO home_placements (
  section_key, target_type, target_brand_id,
  image_storage_key, image_width, image_height, image_content_type,
  title_en, title_it, subtitle_en, subtitle_it,
  source, status, starts_at, ends_at, sort_order, published_at,
  created_at, updated_at
)
SELECT
  'top_brand', 'brand', brand.id,
  'home/brands/test-modaviva.webp', 800, 800, 'image/webp',
  '[TEST HOME] ModaViva', '[TEST HOME] ModaViva',
  'Featured brand', 'Brand in evidenza',
  'admin', 'live', UTC_TIMESTAMP() - INTERVAL 1 DAY,
  UTC_TIMESTAMP() + INTERVAL 30 DAY, 1, UTC_TIMESTAMP(),
  UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM brands brand
INNER JOIN products product
  ON product.brand_id = brand.id
 AND product.code = 'RD-W-DRESS-001'
 AND product.status = 'published'
 AND product.approval_status = 'approved'
 AND product.visibility = 'public'
 AND product.deleted_at IS NULL
WHERE brand.slug = 'modaviva'
  AND brand.is_active = 1
  AND brand.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM home_placements existing
    WHERE existing.section_key = 'top_brand'
      AND existing.target_type = 'brand'
      AND existing.target_brand_id = brand.id
      AND existing.deleted_at IS NULL
  )
LIMIT 1;

-- Lookbook card linked to an existing public product.
INSERT INTO home_placements (
  section_key, target_type, target_product_id,
  image_storage_key, image_width, image_height, image_content_type,
  title_en, title_it, subtitle_en, subtitle_it,
  alt_text_en, alt_text_it, cta_label_en, cta_label_it,
  source, status, starts_at, ends_at, sort_order, published_at,
  created_at, updated_at
)
SELECT
  'lookbook', 'product', product.id,
  'home/lookbook/test-women.webp', 1080, 1350, 'image/webp',
  '[TEST HOME] Floral edit', '[TEST HOME] Selezione floreale',
  'A fresh look for the season', 'Un look fresco per la stagione',
  'Floral midi dress', 'Abito midi floreale',
  'Discover the look', 'Scopri il look',
  'admin', 'live', UTC_TIMESTAMP() - INTERVAL 1 DAY,
  UTC_TIMESTAMP() + INTERVAL 30 DAY, 1, UTC_TIMESTAMP(),
  UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM products product
INNER JOIN vendors vendor
  ON vendor.id = product.vendor_id
 AND vendor.status = 'active'
 AND vendor.approval_status = 'approved'
 AND vendor.deleted_at IS NULL
INNER JOIN product_media media
  ON media.product_id = product.id
 AND media.media_type = 'image'
 AND media.moderation_status = 'approved'
 AND media.deleted_at IS NULL
WHERE product.code = 'RD-W-DRESS-001'
  AND product.status = 'published'
  AND product.approval_status = 'approved'
  AND product.visibility = 'public'
  AND product.published_at IS NOT NULL
  AND product.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM home_placements existing
    WHERE existing.source = 'admin'
      AND existing.title_en = '[TEST HOME] Floral edit'
      AND existing.deleted_at IS NULL
  )
ORDER BY media.is_primary DESC, media.sort_order, media.id
LIMIT 1;

-- Second lookbook card, linked to a real public menswear demo product.
INSERT INTO home_placements (
  section_key, target_type, target_product_id,
  image_storage_key, image_width, image_height, image_content_type,
  title_en, title_it, subtitle_en, subtitle_it,
  alt_text_en, alt_text_it, cta_label_en, cta_label_it,
  source, status, starts_at, ends_at, sort_order, published_at,
  created_at, updated_at
)
SELECT
  'lookbook', 'product', product.id,
  'home/lookbook/test-men.webp', 1080, 1350, 'image/webp',
  '[TEST HOME] Menswear edit', '[TEST HOME] Selezione uomo',
  'Modern layers for every day', 'Strati moderni per ogni giorno',
  'Menswear lookbook styling', 'Lookbook di moda uomo',
  'Explore the edit', 'Scopri la selezione',
  'admin', 'live', UTC_TIMESTAMP() - INTERVAL 1 DAY,
  UTC_TIMESTAMP() + INTERVAL 30 DAY, 2, UTC_TIMESTAMP(),
  UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM products product
INNER JOIN vendors vendor
  ON vendor.id = product.vendor_id
 AND vendor.status = 'active'
 AND vendor.approval_status = 'approved'
 AND vendor.deleted_at IS NULL
WHERE product.code = 'RD-M-SHIRT-001'
  AND product.status = 'published'
  AND product.approval_status = 'approved'
  AND product.visibility = 'public'
  AND product.published_at IS NOT NULL
  AND product.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM home_placements existing
    WHERE existing.source = 'admin'
      AND existing.title_en = '[TEST HOME] Menswear edit'
      AND existing.deleted_at IS NULL
  )
LIMIT 1;

-- Promo spotlight.
INSERT INTO home_placements (
  section_key, target_type, target_filters,
  image_storage_key, image_width, image_height, image_content_type,
  title_en, title_it, subtitle_en, subtitle_it,
  cta_label_en, cta_label_it, badge_en, badge_it,
  discount_label_en, discount_label_it,
  source, status, starts_at, ends_at, sort_order, published_at,
  created_at, updated_at
)
SELECT
  'promotion', 'catalog',
  JSON_OBJECT('sort', 'featured', 'inStock', TRUE),
  'home/promotion/test-style-studio.webp', 1440, 810, 'image/webp',
  '[TEST HOME] Style Studio', '[TEST HOME] Style Studio',
  'Find a look you love', 'Trova il look che ami',
  'Try it on', 'Provalo',
  'AI FIT', 'AI FIT',
  'Demo offer', 'Offerta demo',
  'admin', 'live', UTC_TIMESTAMP() - INTERVAL 1 DAY,
  UTC_TIMESTAMP() + INTERVAL 30 DAY, 1, UTC_TIMESTAMP(),
  UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM products product
INNER JOIN product_media media
  ON media.product_id = product.id
 AND media.media_type = 'image'
 AND media.moderation_status = 'approved'
 AND media.deleted_at IS NULL
WHERE product.code = 'RD-W-DRESS-001'
  AND product.status = 'published'
  AND product.approval_status = 'approved'
  AND product.visibility = 'public'
  AND product.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM home_placements existing
    WHERE existing.source = 'admin'
      AND existing.title_en = '[TEST HOME] Style Studio'
      AND existing.deleted_at IS NULL
  )
ORDER BY media.is_primary DESC, media.sort_order, media.id
LIMIT 1;

-- Hot-offer marketing tile. Product selection filters are safe catalog
-- filters; this does not alter product prices or create a coupon.
INSERT INTO home_placements (
  section_key, target_type, target_filters,
  image_storage_key, image_width, image_height, image_content_type,
  title_en, title_it, subtitle_en, subtitle_it,
  badge_en, badge_it, source, status, starts_at, ends_at,
  sort_order, published_at, created_at, updated_at
)
SELECT
  'offer', 'catalog',
  JSON_OBJECT('sort', 'featured', 'inStock', TRUE),
  'home/offers/test-weekend.webp', 900, 1200, 'image/webp',
  '[TEST HOME] Weekend picks', '[TEST HOME] Selezione del weekend',
  'Browse demo sale items', 'Scopri i prodotti in offerta',
  'SALE', 'SALDI',
  'admin', 'live', UTC_TIMESTAMP() - INTERVAL 1 DAY,
  UTC_TIMESTAMP() + INTERVAL 30 DAY,
  1, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM products product
INNER JOIN product_media media
  ON media.product_id = product.id
 AND media.media_type = 'image'
 AND media.moderation_status = 'approved'
 AND media.deleted_at IS NULL
WHERE product.code = 'RD-W-DRESS-001'
  AND product.status = 'published'
  AND product.approval_status = 'approved'
  AND product.visibility = 'public'
  AND product.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM home_placements existing
    WHERE existing.source = 'admin'
      AND existing.title_en = '[TEST HOME] Weekend picks'
      AND existing.deleted_at IS NULL
  )
ORDER BY media.is_primary DESC, media.sort_order, media.id
LIMIT 1;

-- Second hot-offer tile, backed by a real catalog route.
INSERT INTO home_placements (
  section_key, target_type, target_filters,
  image_storage_key, image_width, image_height, image_content_type,
  title_en, title_it, subtitle_en, subtitle_it,
  badge_en, badge_it, source, status, starts_at, ends_at,
  sort_order, published_at, created_at, updated_at
)
SELECT
  'offer', 'catalog',
  JSON_OBJECT('sort', 'featured', 'inStock', TRUE),
  'home/offers/test-daily.webp', 900, 1200, 'image/webp',
  '[TEST HOME] Daily offers', '[TEST HOME] Offerte quotidiane',
  'Fresh finds at a special price', 'Nuovi stili a prezzo speciale',
  'DEALS', 'OFFERTE',
  'admin', 'live', UTC_TIMESTAMP() - INTERVAL 1 DAY,
  UTC_TIMESTAMP() + INTERVAL 30 DAY,
  2, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM products product
INNER JOIN product_media media
  ON media.product_id = product.id
 AND media.media_type = 'image'
 AND media.moderation_status = 'approved'
 AND media.deleted_at IS NULL
WHERE product.code = 'RD-M-SHIRT-001'
  AND product.status = 'published'
  AND product.approval_status = 'approved'
  AND product.visibility = 'public'
  AND product.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM home_placements existing
    WHERE existing.source = 'admin'
      AND existing.title_en = '[TEST HOME] Daily offers'
      AND existing.deleted_at IS NULL
  )
ORDER BY media.is_primary DESC, media.sort_order, media.id
LIMIT 1;

COMMIT;

-- Check fixture rows; then call GET /api/v1/home/feed?lang=en or ?lang=it.
SELECT id, section_key, target_type, status, title_en, image_storage_key
FROM home_placements
WHERE source = 'admin'
  AND title_en LIKE '[TEST HOME] %'
  AND deleted_at IS NULL
ORDER BY section_key, sort_order, id;

SELECT COUNT(*) AS test_home_placement_count
FROM home_placements
WHERE source = 'admin'
  AND title_en LIKE '[TEST HOME] %'
  AND deleted_at IS NULL;

-- No automatic rollback is provided: demo rows are preserved on re-seed.
