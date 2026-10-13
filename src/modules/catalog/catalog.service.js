import { env } from "../../config/env.js";

import { getMediaUrl } from "../../services/media/media-storage.service.js";

import { AppError } from "../../utils/app-error.js";

import { getReviewBlock, getReviews } from "./catalog.reviews.service.js";

import {
  findActiveBrands,
  findActiveCategories,
  findActiveColors,
  findActiveFitProfiles,
  findActiveSizes,
  findFilterableAttributes,
  findProductColors,
  findProductDetailRelations,
  findPublicProductBySlug,
  findPublicProducts,
  findCatalogBrands,
  findCategoryProductCounts,
} from "./catalog.repository.js";

function id(value) {
  return value === null || value === undefined ? null : String(value);
}

function boolean(value) {
  return value === true || value === 1 || value === "1";
}

function money(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

function discountPercent(regular, current) {
  const regularValue = Number(regular);

  const currentValue = Number(current);

  if (
    !Number.isFinite(regularValue) ||
    !Number.isFinite(currentValue) ||
    regularValue <= 0 ||
    currentValue >= regularValue
  ) {
    return 0;
  }

  return Math.round(((regularValue - currentValue) / regularValue) * 100);
}

function positiveInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function createPrice(row) {
  return {
    currency: row.currencyCode,

    min: money(row.minCurrentPrice),

    max: money(row.maxCurrentPrice),

    regularMin: money(row.minRegularPrice),

    regularMax: money(row.maxRegularPrice),
  };
}

function mapVendor(row) {
  return {
    id: id(row.vendorId),
    name: row.vendorName,
    slug: row.vendorSlug,

    logoUrl: row.vendorLogoUrl ?? null,
  };
}

function mapRating(row) {
  const count = Number(row.ratingCount ?? 0);

  const average = Number(row.ratingAverage);

  return {
    average:
      count > 0 && Number.isFinite(average) ? Number(average.toFixed(1)) : null,

    count,
  };
}

async function signedUrl(storageKey) {
  return storageKey ? getMediaUrl(storageKey) : null;
}

async function mapBrand(row) {
  return {
    id: id(row.id),
    code: row.code,
    name: row.name,
    slug: row.slug,

    logoUrl: await signedUrl(row.logoKey),

    websiteUrl: row.websiteUrl ?? null,

    ...(row.productCount === null || row.productCount === undefined
      ? {}
      : {
          productCount: Number(row.productCount),
        }),
  };
}

function mapCategory(row, productCount = null) {
  return {
    id: id(row.id),
    code: row.code,
    slug: row.slug,
    name: row.name,

    description: row.description ?? null,

    imageUrl: null,
    iconUrl: null,

    ...(productCount === null
      ? {}
      : {
          productCount,
        }),

    children: [],
  };
}

function buildCategoryTree(
  rows,
  productCounts = null,
  { hideEmpty = false } = {},
) {
  const countByCategory = new Map(
    (productCounts ?? []).map((row) => [
      id(row.categoryId),
      Number(row.productCount),
    ]),
  );

  const nodes = new Map(
    rows.map((row) => {
      const productCount =
        productCounts === null ? null : (countByCategory.get(id(row.id)) ?? 0);

      return [id(row.id), mapCategory(row, productCount)];
    }),
  );

  const roots = [];

  for (const row of rows) {
    const node = nodes.get(id(row.id));

    const parent = nodes.get(id(row.parentId));

    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function finalize(nodesAtLevel, level) {
    return nodesAtLevel
      .map((node) => ({
        ...node,

        level,

        children: finalize(node.children, level + 1),
      }))
      .filter((node) => !hideEmpty || (node.productCount ?? 0) > 0);
  }

  return finalize(roots, 1);
}

function mapColor(row) {
  return {
    id: id(row.id),
    code: row.code,
    name: row.name,

    hexCode: row.hexCode ?? null,
  };
}

function groupSizes(rows) {
  const systems = new Map();

  for (const row of rows) {
    const systemId = id(row.systemId);

    if (!systems.has(systemId)) {
      systems.set(systemId, {
        id: systemId,
        code: row.systemCode,
        name: row.systemName,
        sizes: [],
      });
    }

    systems.get(systemId).sizes.push({
      id: id(row.id),
      code: row.code,
      label: row.label,
    });
  }

  return [...systems.values()];
}

function groupAttributes(rows) {
  const attributes = new Map();

  for (const row of rows) {
    const attributeId = id(row.attributeId);

    if (!attributes.has(attributeId)) {
      attributes.set(attributeId, {
        id: attributeId,
        code: row.attributeCode,
        name: row.attributeName,

        dataType: row.dataType,

        inputType: row.inputType,

        unitCode: row.unitCode ?? null,

        allowsMultiple: boolean(row.allowsMultiple),

        values: [],
      });
    }

    if (row.valueId !== null && row.valueId !== undefined) {
      attributes.get(attributeId).values.push({
        id: id(row.valueId),

        code: row.valueCode,

        label: row.valueLabel,
      });
    }
  }

  return [...attributes.values()];
}

function mapFitProfile(row) {
  return {
    id: id(row.id),
    code: row.code,
    name: row.name,
  };
}

function mapCategoryLeaf(row) {
  return {
    id: id(row.id),
    code: row.code,
    slug: row.slug,
    name: row.name,

    isPrimary: boolean(row.isPrimary),
  };
}

function attributeValue(row) {
  if (row.optionId !== null && row.optionId !== undefined) {
    return {
      id: id(row.optionId),

      code: row.optionCode,

      label: row.optionLabel,
    };
  }

  if (row.valueText !== null && row.valueText !== undefined) {
    return row.valueText;
  }

  if (row.valueDecimal !== null && row.valueDecimal !== undefined) {
    return String(row.valueDecimal);
  }

  if (row.valueBoolean !== null && row.valueBoolean !== undefined) {
    return boolean(row.valueBoolean);
  }

  return null;
}

function mapAttribute(row) {
  return {
    id: id(row.attributeId),

    code: row.attributeCode,

    name: row.attributeName,

    dataType: row.dataType,

    value: attributeValue(row),

    unitCode: row.unitCode ?? row.defaultUnitCode ?? null,
  };
}

function mapMeasurement(row) {
  return {
    code: row.code,
    name: row.name,

    valueCm: String(row.valueCm),

    tolerancePlusCm: String(row.tolerancePlusCm),

    toleranceMinusCm: String(row.toleranceMinusCm),

    isEstimated: boolean(row.isEstimated),
  };
}

function groupBy(rows, key) {
  const grouped = new Map();

  for (const row of rows) {
    const value = id(row[key]);

    const items = grouped.get(value) ?? [];

    items.push(row);

    grouped.set(value, items);
  }

  return grouped;
}

function mapVariant(row, attributeRows, measurementRows, currencyCode) {
  const regularPrice = money(row.regularPrice);

  const currentPrice = money(row.currentPrice);

  return {
    id: id(row.id),
    sku: row.sku,

    isDefault: boolean(row.isDefault),

    size:
      row.sizeId === null || row.sizeId === undefined
        ? null
        : {
            id: id(row.sizeId),

            code: row.sizeCode,

            label: row.sizeLabel,

            system: {
              code: row.sizeSystemCode,

              name: row.sizeSystemName,
            },
          },

    color:
      row.colorId === null || row.colorId === undefined
        ? null
        : {
            id: id(row.colorId),

            code: row.colorCode,

            name: row.colorName,

            hexCode: row.colorHexCode ?? null,
          },

    price: {
      currency: currencyCode,

      current: currentPrice,

      regular: regularPrice,

      onSale: Number(currentPrice) < Number(regularPrice),

      discountPercent: discountPercent(regularPrice, currentPrice),
    },

    inStock: boolean(row.inStock),

    lowStock:
      boolean(row.inStock) &&
      !boolean(row.allowsBackorder) &&
      Number(row.availableQuantity) > 0 &&
      Number(row.availableQuantity) <= 3,

    maxQty: boolean(row.allowsBackorder)
      ? null
      : Math.min(Math.max(Number(row.availableQuantity) || 0, 0), 3),

    allowsBackorder: boolean(row.allowsBackorder),

    weight:
      row.weightValue === null || row.weightValue === undefined
        ? null
        : {
            value: String(row.weightValue),

            unit: row.weightUnit,
          },

    attributes: attributeRows.map(mapAttribute),

    measurements: measurementRows.map(mapMeasurement),
  };
}

function productBadges(row, locale) {
  const badges = [];

  if (discountPercent(row.minRegularPrice, row.minCurrentPrice) > 0) {
    badges.push({
      code: "SALE",

      label: locale === "en" ? "Sale" : "In saldo",
    });
  }

  const publishedAt = new Date(row.publishedAt);

  if (
    !Number.isNaN(publishedAt.valueOf()) &&
    Date.now() - publishedAt.valueOf() <= 30 * 24 * 60 * 60 * 1000
  ) {
    badges.push({
      code: "NEW",

      label: locale === "en" ? "New" : "Novità",
    });
  }

  return badges;
}

function buildSizeChart(variants, locale) {
  const chartVariants = variants.filter(
    (variant) => variant.size && variant.measurements.length > 0,
  );

  if (chartVariants.length === 0) {
    return null;
  }

  const columns = new Map();

  for (const variant of chartVariants) {
    for (const measurement of variant.measurements) {
      if (!columns.has(measurement.code)) {
        columns.set(measurement.code, {
          code: measurement.code,

          name: measurement.name,
        });
      }
    }
  }

  return {
    system: chartVariants[0].size.system?.code ?? null,

    unit: "cm",

    columns: [...columns.values()],

    rows: chartVariants.map((variant) => ({
      sizeCode: variant.size.code,

      label: variant.size.label,

      equivalents: {},

      values: Object.fromEntries(
        variant.measurements.map((measurement) => [
          measurement.code,
          measurement.valueCm,
        ]),
      ),
    })),

    howToMeasure: [],

    fitTip:
      locale === "en"
        ? "Measurements are taken from the garment."
        : "Le misure sono rilevate direttamente dal capo.",
  };
}

export async function getBrands(options) {
  const rows = options
    ? await findCatalogBrands({
        category: options.category,

        q: options.q,
      })
    : await findActiveBrands();

  return Promise.all(rows.map(mapBrand));
}

export async function getCategories(locale) {
  const [rows, productCounts] = await Promise.all([
    findActiveCategories({
      locale,

      fallbackLocale: env.APP_DEFAULT_LANGUAGE,
    }),

    findCategoryProductCounts(),
  ]);

  return buildCategoryTree(rows, productCounts, {
    hideEmpty: true,
  });
}

export async function getCatalogFilters(locale) {
  const [brandRows, categoryRows, colorRows, sizeRows, fitRows, attributeRows] =
    await Promise.all([
      findActiveBrands(),

      findActiveCategories({
        locale,

        fallbackLocale: env.APP_DEFAULT_LANGUAGE,
      }),

      findActiveColors(),

      findActiveSizes(),

      findActiveFitProfiles(),

      findFilterableAttributes({
        locale,
      }),
    ]);

  return {
    brands: await Promise.all(brandRows.map(mapBrand)),

    categories: buildCategoryTree(categoryRows),

    colors: colorRows.map(mapColor),

    sizeSystems: groupSizes(sizeRows),

    fitProfiles: fitRows.map(mapFitProfile),

    attributes: groupAttributes(attributeRows),
  };
}

export async function getProducts(query, locale) {
  const filters = {
    ...query,

    locale,

    fallbackLocale: env.APP_DEFAULT_LANGUAGE,
  };

  const result = await findPublicProducts(filters);

  const productIds = result.rows.map((row) => row.id);

  const colorRows = await findProductColors(productIds);

  const colorsByProduct = groupBy(colorRows, "productId");

  const products = await Promise.all(
    result.rows.map(async (row) => ({
      id: id(row.id),

      code: row.code,

      slug: row.slug,

      name: row.name,

      shortDescription: row.shortDescription ?? null,

      isFeatured: boolean(row.isFeatured),

      publishedAt: row.publishedAt,

      discountPercent: discountPercent(
        row.minRegularPrice,
        row.minCurrentPrice,
      ),

      rating: mapRating(row),

      tryOnReady: boolean(row.tryOnReady),

      fitReady: row.fitId !== null && row.fitId !== undefined,

      badges: productBadges(row, locale),

      brand:
        row.brandId === null || row.brandId === undefined
          ? null
          : {
              id: id(row.brandId),

              name: row.brandName,

              slug: row.brandSlug,
            },

      vendor: mapVendor({
        ...row,

        vendorLogoUrl: await signedUrl(row.vendorLogoKey),
      }),

      fit:
        row.fitCode === null || row.fitCode === undefined
          ? null
          : {
              id: id(row.fitId),

              code: row.fitCode,

              name: row.fitName,
            },

      price: createPrice(row),

      inStock: boolean(row.inStock),

      image:
        row.imageStorageKey === null || row.imageStorageKey === undefined
          ? null
          : {
              url: await signedUrl(row.imageStorageKey),

              altText: row.imageAltText ?? row.name,

              width: positiveInteger(row.imageWidth),

              height: positiveInteger(row.imageHeight),
            },

      hoverImage:
        row.hoverImageStorageKey === null ||
        row.hoverImageStorageKey === undefined
          ? null
          : {
              url: await signedUrl(row.hoverImageStorageKey),

              altText: row.hoverImageAltText ?? row.name,
            },

      colors: (colorsByProduct.get(id(row.id)) ?? []).map(mapColor),

      lowStock: boolean(row.lowStock),
    })),
  );

  return {
    products,

    pagination: {
      page: query.page,

      limit: query.limit,

      total: result.total,

      totalPages:
        result.total === 0 ? 0 : Math.ceil(result.total / query.limit),
    },
  };
}

export async function getWishlistProducts({ accountId, page, limit }, locale) {
  const result = await getProducts(
    {
      page,
      limit,

      q: undefined,
      audience: undefined,
      category: undefined,

      brand: [],
      color: [],
      size: [],
      fit: [],

      minPrice: undefined,
      maxPrice: undefined,
      minDiscount: undefined,

      featured: undefined,
      inStock: undefined,
      onSale: undefined,
      tryOn: undefined,

      sort: "featured",

      wishlistAccountId: accountId,
    },
    locale,
  );

  return {
    ...result,

    products: result.products.map((product) => ({
      ...product,
      wishlisted: true,
    })),
  };
}

export async function getProductBySlug(slug, locale) {
  const fallbackLocale = env.APP_DEFAULT_LANGUAGE;

  const product = await findPublicProductBySlug({
    slug,
    locale,
    fallbackLocale,
  });

  if (!product) {
    throw new AppError({
      message: "The requested product could not be found.",

      statusCode: 404,

      errorCode: "PRODUCT_NOT_FOUND",

      messageKey: "errorProductNotFound",

      details: {
        retryable: false,
      },
    });
  }

  const relations = await findProductDetailRelations({
    productId: product.id,

    locale,

    fallbackLocale,
  });

  const attributesByVariant = groupBy(relations.attributes, "variantId");

  const measurementsByVariant = groupBy(relations.measurements, "variantId");

  const variants = relations.variants.map((variant) =>
    mapVariant(
      variant,

      attributesByVariant.get(id(variant.id)) ?? [],

      measurementsByVariant.get(id(variant.id)) ?? [],

      product.currencyCode,
    ),
  );

  const media = await Promise.all(
    relations.media.map(async (item) => ({
      id: id(item.id),

      variantId: id(item.variantId),

      colorCode: item.colorCode ?? null,

      type: item.mediaType,

      url: await signedUrl(item.storageKey),

      mimeType: item.mimeType ?? null,

      altText: item.altText ?? product.name,

      width: item.width ?? null,

      height: item.height ?? null,

      durationSeconds: item.durationSeconds ?? null,

      isPrimary: boolean(item.isPrimary),
    })),
  );

  const colors = [
    ...new Map(
      variants
        .filter((variant) => variant.color)
        .map((variant) => [
          variant.color.code,

          {
            ...variant.color,

            inStock: variant.inStock,
          },
        ]),
    ).values(),
  ];

  const isReturnable = boolean(product.isReturnable);

  const reviewBlock = await getReviewBlock(product.id).catch(() => null);

  const primaryCategory =
    relations.categories.find((category) => boolean(category.isPrimary)) ??
    relations.categories[0] ??
    null;

  const currentPrice = Number(product.minCurrentPrice);

  const hasComparablePrice = Number.isFinite(currentPrice) && currentPrice > 0;

  const relatedBaseQuery = {
    page: 1,
    limit: 12,

    q: undefined,
    audience: undefined,
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

    onSale: undefined,
    tryOn: undefined,

    sort: "featured",
  };

  const similarQuery = {
    ...relatedBaseQuery,

    category: primaryCategory?.slug,

    minPrice: hasComparablePrice ? (currentPrice * 0.5).toFixed(2) : undefined,

    maxPrice: hasComparablePrice ? (currentPrice * 1.5).toFixed(2) : undefined,
  };

  const emptyRelatedResult = { products: [] };

  /* Related product rows enrich the PDP but are never allowed to make it
   * unavailable. A client can retry the normal list route through seeAll. */
  const [similarResult, sameBrandResult] = await Promise.all([
    primaryCategory
      ? getProducts(similarQuery, locale).catch(() => emptyRelatedResult)
      : Promise.resolve(emptyRelatedResult),

    product.brandSlug
      ? getProducts(
          {
            ...relatedBaseQuery,

            brand: [product.brandSlug],
          },
          locale,
        ).catch(() => emptyRelatedResult)
      : Promise.resolve(emptyRelatedResult),
  ]);

  const withoutCurrent = (items) =>
    items.filter((item) => item.id !== id(product.id)).slice(0, 10);

  const similar = withoutCurrent(similarResult.products);

  return {
    product: {
      id: id(product.id),

      code: product.code,

      slug: product.slug,

      name: product.name,

      shortDescription: product.shortDescription ?? null,

      description: product.description ?? null,

      highlights: [],

      careInstructions: product.careInstructions ?? null,

      sizeAndFitNotes: product.sizeAndFitNotes ?? null,

      modelInfo: null,

      isFeatured: boolean(product.isFeatured),

      publishedAt: product.publishedAt,

      brand:
        product.brandId === null || product.brandId === undefined
          ? null
          : {
              id: id(product.brandId),

              code: product.brandCode,

              name: product.brandName,

              slug: product.brandSlug,

              logoUrl: await signedUrl(product.brandLogoKey),
            },

      vendor: mapVendor({
        ...product,

        vendorLogoUrl: await signedUrl(product.vendorLogoKey),
      }),

      breadcrumbs: (relations.breadcrumbs?.length > 0
        ? relations.breadcrumbs
        : relations.categories
      ).map(
        ({
          slug: categorySlug,

          name,
        }) => ({
          slug: categorySlug,

          name,
        }),
      ),

      fit:
        product.fitCode === null || product.fitCode === undefined
          ? null
          : {
              id: id(product.fitId),

              code: product.fitCode,

              name: product.fitName,
            },

      fitReady: product.fitId !== null && product.fitId !== undefined,

      tryOnReady: boolean(product.tryOnReady),

      price: createPrice(product),

      rating: mapRating(product),

      discountPercent: discountPercent(
        product.minRegularPrice,
        product.minCurrentPrice,
      ),

      inStock: boolean(product.inStock),

      colors,

      returns: {
        allowed: isReturnable,

        windowDays: isReturnable ? 14 : null,

        text: isReturnable
          ? locale === "en"
            ? "Eligible items may be returned within 14 days."
            : "Gli articoli idonei possono essere restituiti entro 14 giorni."
          : null,
      },

      delivery: null,

      shareUrl: null,

      categories: relations.categories.map(mapCategoryLeaf),

      attributes: (attributesByVariant.get(null) ?? []).map(mapAttribute),

      media,

      variants,
    },

    sizeChart: buildSizeChart(variants, locale),

    reviews: reviewBlock,

    related: {
      similar,

      sameBrand: withoutCurrent(sameBrandResult.products),

      /*
       * Intentionally empty until a
       * real curated outfit/look mapping
       * exists. Do not fake this.
       */
      completeLook: [],

      seeAll: {
        ...(primaryCategory
          ? {
              similar: {
                category: primaryCategory.slug,
              },
            }
          : {}),

        ...(product.brandSlug
          ? {
              sameBrand: {
                brand: product.brandSlug,
              },
            }
          : {}),
      },
    },
  };
}

export async function getProductReviewsBySlug(slug, filters, locale) {
  const product = await findPublicProductBySlug({
    slug,

    locale,

    fallbackLocale: env.APP_DEFAULT_LANGUAGE,
  });

  if (!product) {
    throw new AppError({
      message: "The requested product could not be found.",

      statusCode: 404,
    });
  }

  return getReviews(product.id, filters);
}
