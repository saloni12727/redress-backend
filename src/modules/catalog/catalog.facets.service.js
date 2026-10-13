import { env } from "../../config/env.js";

import { getMediaUrl } from "../../services/media/media-storage.service.js";

import { findCatalogFacets } from "./catalog.facets.repository.js";

const ITALIAN_COLOR_NAMES = Object.freeze({
  black: "Nero",
  white: "Bianco",
  grey: "Grigio",
  gray: "Grigio",
  navy: "Blu navy",
  blue: "Blu",
  red: "Rosso",
  green: "Verde",
  olive: "Oliva",
  yellow: "Giallo",
  orange: "Arancione",
  pink: "Rosa",
  purple: "Viola",
  beige: "Beige",
  brown: "Marrone",
  maroon: "Bordeaux",
});

const COPY = Object.freeze({
  en: {
    priceUnder25: "Under €25",
    price25To50: "€25 – €50",
    price50To100: "€50 – €100",
    priceOver100: "Over €100",

    discount10: "10% and more",
    discount30: "30% and more",
    discount50: "50% and more",

    onSale: "On sale",
    inStock: "In stock",
    tryOn: "Virtual try-on",

    sorts: {
      featured: "Featured",
      newest: "Newest",
      price_asc: "Price: low to high",
      price_desc: "Price: high to low",
      discount: "Best discount",
      rating: "Top rated",
      popular: "Most popular",
    },

    sizeSystems: {
      alpha: "Clothing",
      eu_clothing: "EU Clothing",
      eu_footwear: "EU Shoes",
    },
  },

  it: {
    priceUnder25: "Sotto 25 €",
    price25To50: "25 € – 50 €",
    price50To100: "50 € – 100 €",
    priceOver100: "Oltre 100 €",

    discount10: "10% e più",
    discount30: "30% e più",
    discount50: "50% e più",

    onSale: "In saldo",
    inStock: "Disponibile",
    tryOn: "Prova virtuale",

    sorts: {
      featured: "In evidenza",
      newest: "Novità",
      price_asc: "Prezzo crescente",
      price_desc: "Prezzo decrescente",
      discount: "Sconto migliore",
      rating: "Più votati",
      popular: "Più venduti",
    },

    sizeSystems: {
      alpha: "Abbigliamento",
      eu_clothing: "Abbigliamento EU",
      eu_footwear: "Scarpe EU",
    },
  },
});

function id(value) {
  return value === null || value === undefined ? null : String(value);
}

function count(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function money(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

async function mediaUrl(storageKey) {
  return storageKey ? getMediaUrl(storageKey) : null;
}

function localizedColorName(row, locale) {
  if (locale !== "it") {
    return row.name;
  }

  return ITALIAN_COLOR_NAMES[String(row.code).toLowerCase()] ?? row.name;
}

function localizedSizeSystemName(row, locale) {
  const copy = COPY[locale] ?? COPY.it;

  return copy.sizeSystems[row.systemCode] ?? row.systemName;
}

function groupSizes(rows, locale) {
  const groups = new Map();

  for (const row of rows) {
    const key = id(row.systemId);

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        code: row.systemCode,
        name: localizedSizeSystemName(row, locale),
        sizes: [],
      });
    }

    groups.get(key).sizes.push({
      id: id(row.id),
      code: row.code,
      label: row.label,
      count: count(row.count),
    });
  }

  return [...groups.values()];
}

function newSizeShape(sizeSystems) {
  return sizeSystems.map((system) => ({
    system: system.code,
    label: system.name,

    sizes: system.sizes.map((size) => ({
      code: size.code,
      label: size.label,
      count: size.count,
    })),
  }));
}

function buildPriceRanges(row, locale, currency) {
  const copy = COPY[locale] ?? COPY.it;

  const ranges = [
    {
      id: "u25",
      label: copy.priceUnder25,
      min: null,
      max: "25.00",
      count: count(row?.under25),
    },

    {
      id: "25-50",
      label: copy.price25To50,
      min: "25.00",
      max: "50.00",
      count: count(row?.from25To50),
    },

    {
      id: "50-100",
      label: copy.price50To100,
      min: "50.00",
      max: "100.00",
      count: count(row?.from50To100),
    },

    {
      id: "o100",
      label: copy.priceOver100,
      min: "100.00",
      max: null,
      count: count(row?.over100),
    },
  ];

  return ranges
    .filter((range) => range.count > 0)
    .map((range) => ({
      ...range,
      currency,
    }));
}

function buildDiscountRanges(row, locale) {
  const copy = COPY[locale] ?? COPY.it;

  return [
    {
      id: "d10",
      label: copy.discount10,
      minPercent: 10,
      count: count(row?.d10),
    },

    {
      id: "d30",
      label: copy.discount30,
      minPercent: 30,
      count: count(row?.d30),
    },

    {
      id: "d50",
      label: copy.discount50,
      minPercent: 50,
      count: count(row?.d50),
    },
  ].filter((range) => range.count > 0);
}

function buildFlags(flags, locale) {
  const copy = COPY[locale] ?? COPY.it;

  const result = [];

  if (count(flags?.onSale) > 0) {
    result.push({
      code: "onSale",
      label: copy.onSale,
      count: count(flags.onSale),
    });
  }

  if (count(flags?.inStock) > 0) {
    result.push({
      code: "inStock",
      label: copy.inStock,
      count: count(flags.inStock),
    });
  }

  if (count(flags?.tryOn) > 0) {
    result.push({
      code: "tryOn",
      label: copy.tryOn,
      count: count(flags.tryOn),
    });
  }

  return result;
}

function buildSorts(locale) {
  const copy = COPY[locale] ?? COPY.it;

  return [
    "featured",
    "newest",
    "price_asc",
    "price_desc",
    "discount",
    "rating",
    "popular",
  ].map((code) => ({
    code,
    label: copy.sorts[code],
  }));
}

export async function getCatalogFacets(query, locale) {
  const filters = {
    ...query,

    locale,

    fallbackLocale: env.APP_DEFAULT_LANGUAGE,

    inStock: query.inStock ?? true,
  };

  const facets = await findCatalogFacets(filters);

  const sizeSystems = groupSizes(facets.sizes, locale);

  const currency = facets.priceData?.currencyCode ?? "EUR";

  const sorts = buildSorts(locale);

  const brands = await Promise.all(
    facets.brands.map(async (row) => ({
      id: id(row.id),
      code: row.code,
      name: row.name,
      slug: row.slug,

      logoUrl: await mediaUrl(row.logoKey),

      websiteUrl: row.websiteUrl ?? null,

      count: count(row.count),

      productCount: count(row.count),
    })),
  );

  const colors = facets.colors.map((row) => ({
    id: id(row.id),
    code: row.code,

    name: localizedColorName(row, locale),

    hexCode: row.hexCode ?? null,

    count: count(row.count),
  }));

  return {
    brands,

    /*
     * Category tree is returned by:
     * GET /catalog/categories
     *
     * This empty key is retained only
     * for backward compatibility.
     */
    categories: [],

    colors,

    sizeSystems,

    sizes: newSizeShape(sizeSystems),

    /*
     * Reserved for later filters.
     */
    fitProfiles: [],

    attributes: [],

    /*
     * Backward-compatible Flutter
     * fallback values.
     */
    discountSteps: [10, 20, 30, 40, 50],

    priceBounds: {
      min: money(facets.priceData?.minPrice),

      max: money(facets.priceData?.maxPrice),

      currency,
    },

    priceRanges: buildPriceRanges(facets.priceData, locale, currency),

    discountRanges: buildDiscountRanges(facets.discountData, locale),

    flags: buildFlags(facets.flags, locale),

    /*
     * Existing Flutter shape.
     */
    sortOptions: sorts.map((item) => ({
      id: item.code,
      name: item.label,
    })),

    /*
     * New canonical shape.
     */
    sorts,
  };
}
