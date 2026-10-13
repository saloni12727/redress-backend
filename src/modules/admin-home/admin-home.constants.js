export const HOME_SECTION_KEYS = Object.freeze([
  "hero",
  "audience",
  "top_brand",
  "lookbook",
  "promotion",
  "offer",
]);

export const HOME_TARGET_TYPES = Object.freeze([
  "product",
  "brand",
  "category",
  "catalog",
]);

export const HOME_STORED_STATUSES = Object.freeze([
  "draft",
  "live",
  "archived",
]);

export const HOME_LIST_STATUSES = Object.freeze([
  ...HOME_STORED_STATUSES,
  "scheduled",
  "expired",
]);

export const CATALOG_SORT_VALUES = Object.freeze([
  "featured",
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
]);

export const HOME_IMAGE_RULES = Object.freeze({
  hero: { width: 1440, height: 810, ratio: 16 / 9 },
  audience: { width: 900, height: 1200, ratio: 3 / 4 },
  top_brand: { width: 800, height: 800, ratio: 1 },
  lookbook: { width: 1080, height: 1350, ratio: 4 / 5 },
  promotion: { width: 1440, height: 810, ratio: 16 / 9 },
  offer: { width: 900, height: 1200, ratio: 3 / 4 },
});

export const HOME_AUDIENCE_CATEGORY_SLUGS = new Set(["women", "men", "kids"]);

export const HOME_SECTION_DESTINATIONS = Object.freeze({
  hero: new Set(["product", "catalog"]),
  audience: new Set(["category"]),
  top_brand: new Set(["brand"]),
  lookbook: new Set(["product", "brand", "catalog"]),
  promotion: new Set(["product", "catalog"]),
  offer: new Set(["product", "brand", "category", "catalog"]),
});
