import {
  createHash,
} from "node:crypto";

import {
  brandListQuerySchema,
  catalogFiltersQuerySchema,
  catalogLanguageQuerySchema,
  productListQuerySchema,
  productReviewsQuerySchema,
  productSlugParamsSchema,
} from "./catalog.validation.js";

import { getCatalogFacets } from "./catalog.facets.service.js";

import {
  getBrands,
  getCategories,
  getProductBySlug,
  getProductReviewsBySlug,
  getProducts,
} from "./catalog.service.js";

function validationError(response, error) {
  void error;

  return response.status(400).json({
    success: false,

    data: null,

    message: "One or more catalog parameters are invalid.",
  });
}

function normalizeProductListQuery(query) {
  const normalized = {
    ...query,

    /*
     * Flutter catalog should show
     * purchasable products by default.
     */
    inStock: query.inStock ?? true,
  };

  /*
   * Existing product repository already
   * has mature minDiscount handling.
   *
   * So onSale=true safely reuses that
   * implementation without touching the
   * main repository in Phase 2.
   *
   * Any positive discount qualifies.
   */
  if (query.onSale === true && query.minDiscount === undefined) {
    normalized.minDiscount = 0.000001;
  }

  /*
   * Main Phase 1 repository does not need
   * to know about the onSale helper field.
   */
  delete normalized.onSale;

  return normalized;
}

/*
 * Opaque media URLs intentionally have a fresh random token on every
 * response. They must not participate in a representation ETag, otherwise
 * an unchanged product can never produce a 304 response. The media object's
 * non-URL fields still participate, so media additions/removals and metadata
 * changes invalidate the ETag normally.
 */
function etagRepresentation(value) {
  if (Array.isArray(value)) {
    return value.map(etagRepresentation);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [
          key,
          ["url", "thumbUrl", "logoUrl", "avatarUrl"].includes(key)
            ? "<opaque-media-url>"
            : etagRepresentation(item),
        ]),
    );
  }

  return value;
}

function createProductEtag(data) {
  return `"${createHash("sha256")
    .update(JSON.stringify(etagRepresentation(data)))
    .digest("base64url")}"`;
}

export async function listBrandsController(request, response) {
  const parsed = brandListQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return validationError(response, parsed.error);
  }

  return response.status(200).json({
    success: true,

    data: await getBrands(parsed.data),

    message: "Brands retrieved successfully.",
  });
}

export async function listCategoriesController(request, response) {
  const parsed = catalogLanguageQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return validationError(response, parsed.error);
  }

  return response.status(200).json({
    success: true,

    data: await getCategories(request.locale),

    message: "Categories retrieved successfully.",
  });
}

export async function listCatalogFiltersController(request, response) {
  const parsed = catalogFiltersQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return validationError(response, parsed.error);
  }

  return response.status(200).json({
    success: true,

    data: await getCatalogFacets(parsed.data, request.locale),

    message: "Catalog filters retrieved successfully.",
  });
}

export async function listProductsController(request, response) {
  const parsed = productListQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return validationError(response, parsed.error);
  }

  const result = await getProducts(
    normalizeProductListQuery(parsed.data),
    request.locale,
  );

  return response.status(200).json({
    success: true,

    data: {
      items: result.products,
      pagination: result.pagination,
    },

    message: "Products retrieved successfully.",
  });
}

export async function getProductController(request, response) {
  const query = catalogLanguageQuerySchema.safeParse(request.query);

  if (!query.success) {
    return validationError(response, query.error);
  }

  const params = productSlugParamsSchema.safeParse(request.params);

  if (!params.success) {
    return validationError(response, params.error);
  }

  const data = await getProductBySlug(params.data.slug, request.locale);
  const etag = createProductEtag(data);

  response.set("ETag", etag);
  response.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

  if (request.get("if-none-match") === etag) {
    return response.status(304).end();
  }

  return response.status(200).json({
    success: true,

    data,

    message: "Product retrieved successfully.",
  });
}

export async function listProductReviewsController(request, response) {
  const query = productReviewsQuerySchema.safeParse(request.query);
  const params = productSlugParamsSchema.safeParse(request.params);

  if (!query.success || !params.success) {
    return validationError(response, query.success ? params.error : query.error);
  }

  const result = await getProductReviewsBySlug(
    params.data.slug,
    query.data,
    request.locale,
  );

  return response.status(200).json({
    success: true,
    data: result,
    message: "Reviews retrieved successfully.",
  });
}
