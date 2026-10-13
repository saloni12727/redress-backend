import { env } from "../../config/env.js";

import { getMediaUrl } from "../../services/media/media-storage.service.js";

import {
  getBrands,
  getCategories,
  getProducts,
} from "../catalog/catalog.service.js";

import { findLiveHomePlacements } from "./home.repository.js";

const PRODUCT_LIST_DEFAULTS = {
  page: 1,
  limit: 8,
  q: undefined,
  category: undefined,
  brand: [],
  color: [],
  size: [],
  fit: [],
  minPrice: undefined,
  maxPrice: undefined,
  minDiscount: undefined,
  featured: undefined,
  inStock: true,
  sort: "featured",
};

const RAIL_COPY = {
  en: {
    aiPicks: {
      title: "AI picks for you",
      subtitle: "Selected from styles shoppers love",
      seeAll: { sort: "featured" },
    },
    hotOffers: "Hot offers",
    deals: "Top deals",
    tryOnPicks: "Ready for try-on",
    trending: "Trending",
  },
  it: {
    aiPicks: {
      title: "Scelte AI per te",
      subtitle: "Selezionati tra gli stili più amati",
      seeAll: { sort: "featured" },
    },
    hotOffers: "Offerte del momento",
    deals: "Le migliori offerte",
    tryOnPicks: "Pronti per il try-on",
    trending: "Di tendenza",
  },
};

const STUDIO_COPY = {
  en: {
    title: "Style Studio",
    subtitle: "Try looks with AI and find your perfect fit",
    ctaLabel: "Generate look",
  },
  it: {
    title: "Style Studio",
    subtitle: "Prova i look con l’AI e trova la taglia giusta",
    ctaLabel: "Genera look",
  },
};

const AUDIENCES = new Set(["women", "men", "kids"]);
const CATALOG_SORT_VALUES = new Set([
  "featured",
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
  "discount",
]);
const CATALOG_FILTER_SLUG_KEYS = new Set(["category"]);
const CATALOG_FILTER_LIST_KEYS = new Set(["brand", "color", "size", "fit"]);
const CATALOG_FILTER_PRICE_KEYS = new Set(["minPrice", "maxPrice"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COLOR_PATTERN = /^[a-z0-9_-]+$/;
const PRICE_PATTERN = /^\d{1,10}(?:\.\d{1,2})?$/;

function id(value) {
  return value === null || value === undefined ? null : String(value);
}

function positiveInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function priceNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return null;
  }

  return Number(value);
}

function localized(row, property, locale) {
  const preferred = locale === "en" ? `${property}En` : `${property}It`;
  const fallback = locale === "en" ? `${property}It` : `${property}En`;

  return row[preferred] ?? row[fallback] ?? null;
}

function toObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function normalizeList(value, pattern, maximum = 20) {
  const values = Array.isArray(value) ? value : [value];

  return [
    ...new Set(
      values
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => pattern.test(item)),
    ),
  ].slice(0, maximum);
}

function sanitizeCatalogFilters(value) {
  const source = toObject(value);
  const filters = {};

  for (const key of CATALOG_FILTER_SLUG_KEYS) {
    if (typeof source[key] === "string" && SLUG_PATTERN.test(source[key])) {
      filters[key] = source[key];
    }
  }

  for (const key of CATALOG_FILTER_LIST_KEYS) {
    const pattern =
      key === "color" || key === "fit"
        ? COLOR_PATTERN
        : key === "size"
          ? /^\d+$/
          : SLUG_PATTERN;
    const values = normalizeList(source[key], pattern, key === "size" ? 50 : 20);

    if (values.length > 0) {
      filters[key] = values;
    }
  }

  for (const key of CATALOG_FILTER_PRICE_KEYS) {
    if (typeof source[key] === "string" && PRICE_PATTERN.test(source[key])) {
      filters[key] = source[key];
    }
  }

  if (
    Number.isInteger(source.minDiscount) &&
    source.minDiscount >= 1 &&
    source.minDiscount <= 100
  ) {
    filters.minDiscount = source.minDiscount;
  }

  if (source.featured === true || source.featured === false) {
    filters.featured = source.featured;
  }

  if (source.inStock === true || source.inStock === false) {
    filters.inStock = source.inStock;
  }

  if (CATALOG_SORT_VALUES.has(source.sort)) {
    filters.sort = source.sort;
  }

  return filters;
}

function safeInternalPath(value) {
  return typeof value === "string" && /^\/[a-zA-Z0-9/_-]*$/.test(value);
}

function sanitizeLinkQuery(value, type) {
  const source = toObject(value);
  const query = {};
  const allowedKeys = {
    catalog: new Set([
      "audience",
      "category",
      "brandId",
      "sort",
      "minDiscount",
      "minPrice",
      "maxPrice",
      "brand",
      "color",
      "size",
      "fit",
      "featured",
      "inStock",
    ]),
    offer: new Set(["campaignId", "sort", "minDiscount"]),
    brand: new Set(["brandId"]),
    product: new Set(["productId"]),
    tryOn: new Set(["productId"]),
  }[type];

  if (!allowedKeys) {
    return query;
  }

  for (const [key, value] of Object.entries(source)) {
    if (!allowedKeys.has(key)) {
      continue;
    }

    if (key === "audience" && AUDIENCES.has(value)) {
      query[key] = value;
    } else if (
      key === "category" &&
      typeof value === "string" &&
      SLUG_PATTERN.test(value)
    ) {
      query[key] = value;
    } else if (
      ["brandId", "campaignId", "productId"].includes(key) &&
      (typeof value === "string" || typeof value === "number") &&
      /^[a-zA-Z0-9_-]{1,100}$/.test(String(value))
    ) {
      query[key] = String(value);
    } else if (key === "sort" && CATALOG_SORT_VALUES.has(value)) {
      query[key] = value;
    } else if (
      key === "minDiscount" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 100
    ) {
      query[key] = value;
    } else if (
      CATALOG_FILTER_PRICE_KEYS.has(key) &&
      typeof value === "string" &&
      PRICE_PATTERN.test(value)
    ) {
      query[key] = value;
    } else if (
      key === "brand" ||
      key === "color" ||
      key === "fit" ||
      key === "size"
    ) {
      const pattern =
        key === "color" || key === "fit"
          ? COLOR_PATTERN
          : key === "size"
            ? /^\d+$/
            : SLUG_PATTERN;
      const values = normalizeList(value, pattern, key === "size" ? 50 : 20);
      if (values.length > 0) {
        query[key] = values;
      }
    } else if (
      (key === "featured" || key === "inStock") &&
      typeof value === "boolean"
    ) {
      query[key] = value;
    }
  }

  return query;
}

function withSafeLinkQuery(link, row) {
  return {
    ...link,
    query: {
      ...sanitizeLinkQuery(row.linkQuery, link.type),
      ...link.query,
    },
  };
}

function makeLink(row, sectionKey) {
  if (row.externalUrl) {
    try {
      const url = new URL(row.externalUrl);
      if (url.protocol === "https:") {
        return {
          type: "external",
          path: url.toString(),
          query: {},
        };
      }
    } catch {
      return null;
    }
  }

  const requestedCampaignId = toObject(row.offerPayload).id;
  const campaignId =
    (typeof requestedCampaignId === "string" ||
      typeof requestedCampaignId === "number") &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(String(requestedCampaignId))
      ? String(requestedCampaignId)
      : id(row.id);
  const filters = sanitizeCatalogFilters(row.targetFilters);

  if (row.targetType === "product" && row.publicTargetProductId) {
    const productId = id(row.publicTargetProductId);
    return withSafeLinkQuery(
      {
        type: "product",
        path: `/product/${productId}`,
        query: { productId },
      },
      row,
    );
  }

  if (row.targetType === "brand" && row.publicTargetBrandId) {
    return withSafeLinkQuery(
      {
        type: "brand",
        path: "/categories",
        query: { brandId: id(row.publicTargetBrandId) },
      },
      row,
    );
  }

  if (row.targetType === "category" && row.targetCategorySlug) {
    return withSafeLinkQuery(
      {
        type: "catalog",
        path: "/categories",
        query: { category: row.targetCategorySlug },
      },
      row,
    );
  }

  if (
    row.targetType === "offer" ||
    (sectionKey === "offer" &&
      Object.keys(toObject(row.offerPayload)).length > 0)
  ) {
    return withSafeLinkQuery(
      {
        type: "offer",
        path: "/categories",
        query: { campaignId, sort: "discount" },
      },
      row,
    );
  }

  if (row.targetType === "catalog") {
    return withSafeLinkQuery(
      {
        type: "catalog",
        path: "/categories",
        query: filters,
      },
      row,
    );
  }

  if (row.targetType === "tryOn") {
    return withSafeLinkQuery(
      {
        type: "tryOn",
        path: "/try-on",
        query: {},
      },
      row,
    );
  }

  if (row.targetType === "route" && safeInternalPath(row.linkPath)) {
    return {
      type: "route",
      path: row.linkPath,
      query: {},
    };
  }

  return null;
}

async function mapImage(storageKey) {
  return storageKey ? getMediaUrl(storageKey) : null;
}

async function mapPlacement(row, locale, sectionKey = row.sectionKey) {
  const link = makeLink(row, sectionKey);
  if (!link) {
    return null;
  }

  const title = localized(row, "title", locale);
  const payload = toObject(row.offerPayload);
  // `offer` is presentation metadata for the Hot offers rail, not only for
  // legacy campaign links. Admin-authored offer placements may legitimately
  // point at a product or a filtered catalog, so keep their offer card data
  // populated as well. Flutter uses this object to recognise and render an
  // editorial offer card.
  const offer =
    sectionKey === "offer" || link.type === "offer"
      ? {
          id: id(payload.id ?? row.id),
          title: payload.title ?? title,
          badge: localized(row, "badge", locale) ?? payload.badge ?? null,
          sellerId: id(payload.sellerId),
          sellerName: payload.sellerName ?? null,
          startsAt: row.startsAt ?? null,
          endsAt: row.endsAt ?? null,
          minDiscount: positiveInteger(payload.minDiscount),
        }
      : null;
  const product =
    link.type === "product"
      ? {
          id: id(row.publicTargetProductId),
          brand: row.targetProductBrandName ?? null,
          brandId: id(row.targetProductBrandId),
          title: row.targetProductName,
          price: priceNumber(row.targetProductPrice),
          mrp: priceNumber(row.targetProductMrp),
          currency: row.targetProductCurrency ?? null,
          imageUrls: row.targetProductImageStorageKey
            ? [await mapImage(row.targetProductImageStorageKey)]
            : [],
          badge: "Editorial",
        }
      : null;
  const brand =
    link.type === "brand"
      ? {
          id: id(row.publicTargetBrandId),
          name: row.targetBrandName,
          tagline: payload.tagline ?? null,
          imageUrl: await mapImage(
            row.imageStorageKey ?? row.targetBrandLogoKey,
          ),
          link,
        }
      : null;

  return {
    id: id(row.id),
    title,
    subtitle: localized(row, "subtitle", locale),
    ctaLabel: localized(row, "ctaLabel", locale),
    imageUrl: await mapImage(row.imageStorageKey),
    alt: localized(row, "altText", locale) ?? title ?? "",
    sortOrder: positiveInteger(row.sortOrder) ?? 0,
    type: link.type,
    link,
    product,
    offer,
    brand,
    badge: localized(row, "badge", locale) ?? offer?.badge ?? null,
    discountLabel: localized(row, "discountLabel", locale),
  };
}

function categoryBySlug(categories) {
  const result = new Map();
  const visit = (items) => {
    for (const category of items) {
      if (category?.slug) {
        result.set(category.slug, category);
      }
      visit(category?.children ?? []);
    }
  };

  visit(categories);
  return result;
}

async function mapAudience(category, placement, locale) {
  const imageUrl = await mapImage(placement?.imageStorageKey);
  return {
    id: id(category.id),
    label: localized(placement ?? {}, "title", locale) ?? category.name,
    imageUrl,
    audience: category.slug,
    link: {
      type: "catalog",
      path: "/categories",
      query: { audience: category.slug },
    },
  };
}

function rail(title, subtitle, seeAll, items) {
  return {
    title,
    ...(subtitle ? { subtitle } : {}),
    seeAll: {
      type: "catalog",
      path: "/categories",
      query: seeAll,
    },
    items,
  };
}

export async function getHomeFeed(locale) {
  const [placementRows, categories, catalogBrands, featured, newest, deals] =
    await Promise.all([
      findLiveHomePlacements(locale, env.APP_DEFAULT_LANGUAGE),
      getCategories(locale),
      getBrands(),
      getProducts(
        {
          ...PRODUCT_LIST_DEFAULTS,
          featured: true,
          sort: "featured",
        },
        locale,
      ),
      getProducts(
        {
          ...PRODUCT_LIST_DEFAULTS,
          sort: "newest",
        },
        locale,
      ),
      getProducts(
        {
          ...PRODUCT_LIST_DEFAULTS,
          minDiscount: 30,
          sort: "discount",
        },
        locale,
      ),
    ]);

  const copy = RAIL_COPY[locale] ?? RAIL_COPY.it;
  const mappedPlacements = await Promise.all(
    placementRows.map((row) =>
      row.sectionKey === "audience" ? null : mapPlacement(row, locale),
    ),
  );
  const placementPairs = placementRows
    .map((row, index) => ({ row, content: mappedPlacements[index] }))
    .filter(({ content }) => content);
  const sections = (key) =>
    placementPairs.filter(({ row }) => row.sectionKey === key);
  const curatedBrands = sections("top_brand").map(
    ({ content }) => content.brand ?? content,
  );
  const brandById = new Map(
    curatedBrands.map((brand) => [id(brand.id), brand]),
  );
  for (const brand of catalogBrands) {
    const brandId = id(brand.id);
    if (!brandById.has(brandId)) {
      brandById.set(brandId, {
        id: brandId,
        name: brand.name,
        tagline: null,
        imageUrl: brand.logoUrl,
        link: {
          type: "brand",
          path: "/categories",
          query: { brandId },
        },
      });
    }
  }
  const categoryMap = categoryBySlug(categories);
  const audiencePlacements = new Map(
    placementRows
      .filter(
        (row) => row.sectionKey === "audience" && row.targetCategorySlug,
      )
      .map((row) => [row.targetCategorySlug, row]),
  );
  const audiences = [...AUDIENCES]
    .map((slug) => categoryMap.get(slug))
    .filter(Boolean);

  const aiPicks = featured.products.length > 0 ? featured : newest;
  // The persisted try-on eligibility and popularity signals are not available
  // yet. Keep production honest by hiding those rails, but populate the
  // non-production demo feed with public catalog cards for Flutter testing.
  const demoRailProducts =
    env.NODE_ENV === "production"
      ? []
      : newest.products.length > 0
        ? newest.products
        : featured.products;
  const styleCopy = STUDIO_COPY[locale] ?? STUDIO_COPY.it;
  const studio = {
    ...styleCopy,
    link: {
      type: "tryOn",
      path: "/try-on",
      query: {},
    },
  };
  const promotion = sections("promotion")[0]?.content;
  const hotOffers = sections("offer").map(({ content }) => content);

  return {
    generatedAt: new Date().toISOString(),
    locale,
    meta: {
      unreadNotifications: 0,
      wishlistCount: 0,
      delivery: {
        addressId: null,
        city: null,
        label: null,
      },
    },
    banners: sections("hero").map(({ content }) => content),
    audiences: await Promise.all(
      audiences.map((category) =>
        mapAudience(
          category,
          audiencePlacements.get(category.slug),
          locale,
        ),
      ),
    ),
    brands: [...brandById.values()].slice(0, 6),
    studio,
    promo: promotion
      ? {
          id: promotion.id,
          badge: promotion.badge,
          title: promotion.title,
          subtitle: promotion.subtitle,
          imageUrl: promotion.imageUrl,
          discountLabel: promotion.discountLabel,
          ctaLabel: promotion.ctaLabel,
          link: promotion.link,
        }
      : {},
    lookbook: sections("lookbook").map(({ content }) => content),
    aiPicks: rail(
      copy.aiPicks.title,
      copy.aiPicks.subtitle,
      copy.aiPicks.seeAll,
      aiPicks.products,
    ),
    hotOffers: rail(
      copy.hotOffers,
      null,
      { sort: "discount" },
      hotOffers,
    ),
    deals: rail(
      copy.deals,
      null,
      { sort: "discount", minDiscount: 30 },
      deals.products,
    ),
    tryOnPicks: rail(
      copy.tryOnPicks,
      null,
      {},
      demoRailProducts,
    ),
    trending: rail(
      copy.trending,
      null,
      { sort: "newest" },
      demoRailProducts.slice(0, 2),
    ),
  };
}
