import assert from "node:assert/strict";

import {
  connectDatabase,
  disconnectDatabase,
} from "../config/database.js";

import {
  getBrands,
  getCategories,
  getProductBySlug,
  getProductReviewsBySlug,
  getProducts,
} from "../modules/catalog/catalog.service.js";
import { getCatalogFacets } from "../modules/catalog/catalog.facets.service.js";

const locale = "en";

function listingQuery(overrides = {}) {
  return {
    page: 1,
    limit: 5,
    brand: [],
    color: [],
    size: [],
    fit: [],
    sort: "featured",
    ...overrides,
  };
}

try {
  await connectDatabase();

  const [brands, categories, filters, listing] = await Promise.all([
    getBrands(),
    getCategories(locale),
    getCatalogFacets(listingQuery({ inStock: true }), locale),
    getProducts(listingQuery(), locale),
  ]);

  assert(Array.isArray(brands));
  assert(Array.isArray(categories));
  assert(Array.isArray(filters.colors));
  assert(Array.isArray(filters.sizes));
  assert(Array.isArray(listing.products));
  assert(Number.isInteger(listing.pagination.total));

  let productDetailChecked = false;
  let filteredQueriesChecked = false;

  if (listing.products.length > 0) {
    const detail = await getProductBySlug(listing.products[0].slug, locale);

    assert.equal(typeof detail.product.id, "string");
    assert(Array.isArray(detail.product.variants));
    assert(Array.isArray(detail.product.media));
    const reviews = await getProductReviewsBySlug(
      listing.products[0].slug,
      { sort: "recent", rating: [], withPhotos: undefined, size: undefined, page: 1, limit: 10 },
      locale,
    );
    assert(Array.isArray(reviews.items));
    assert(Number.isInteger(reviews.pagination.total));

    productDetailChecked = true;

    const firstColor = filters.colors[0];
    const firstSize = filters.sizes[0]?.sizes[0];

    await Promise.all([
      getProducts(
        listingQuery({
          category: categories[0]?.slug,
          sort: "newest",
        }),
        locale,
      ),
      getProducts(
        listingQuery({
          q: listing.products[0].name.slice(0, 2),
          sort: "name_asc",
        }),
        locale,
      ),
      getProducts(
        listingQuery({
          brand: brands[0] ? [brands[0].slug] : [],
          color: firstColor ? [firstColor.code] : [],
          size: firstSize ? [firstSize.code] : [],
          fit: [],
          minPrice: "0.00",
          maxPrice: "999999.99",
          inStock: true,
          sort: "price_asc",
        }),
        locale,
      ),
      getProducts(listingQuery({ sort: "price_desc" }), locale),
    ]);

    filteredQueriesChecked = true;
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        locale,
        brands: brands.length,
        categoryRoots: categories.length,
        colors: filters.colors.length,
        sizeSystems: filters.sizes.length,
        productsOnFirstPage: listing.products.length,
        totalPublicProducts: listing.pagination.total,
        productDetailChecked,
        filteredQueriesChecked,
      },
      null,
      2,
    ),
  );
} finally {
  await disconnectDatabase();
}

