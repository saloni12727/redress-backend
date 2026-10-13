import request from "supertest";

import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  findActiveBrands: vi.fn(),
  findCatalogBrands: vi.fn(),
  findActiveCategories: vi.fn(),
  findCategoryProductCounts: vi.fn(),
  findActiveColors: vi.fn(),
  findActiveSizes: vi.fn(),
  findActiveFitProfiles: vi.fn(),
  findFilterableAttributes: vi.fn(),
  findPublicProducts: vi.fn(),
  findProductColors: vi.fn(),
  findPublicProductBySlug: vi.fn(),
  findProductDetailRelations: vi.fn(),
}));

const facetsRepository = vi.hoisted(() => ({
  findCatalogFacets: vi.fn(),
}));

const reviewService = vi.hoisted(() => ({
  getReviewBlock: vi.fn(),
  getReviews: vi.fn(),
}));

const storage = vi.hoisted(() => ({
  createMediaUrl: vi.fn(async () => "https://media.example/api/v1/media/token"),
}));

vi.mock("../src/modules/catalog/catalog.repository.js", () => repository);
vi.mock("../src/modules/catalog/catalog.facets.repository.js", () => facetsRepository);
vi.mock("../src/modules/catalog/catalog.reviews.service.js", () => reviewService);
vi.mock("../src/services/media-url.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  createMediaUrl: storage.createMediaUrl,
}));

import app from "../src/app.js";
import { env } from "../src/config/env.js";

function productRow(overrides = {}) {
  return {
    id: 41,
    code: "RD-W-DRESS-001",
    slug: "floral-midi-dress",
    currencyCode: "EUR",
    isFeatured: 1,
    publishedAt: new Date("2026-10-01T10:00:00.000Z"),
    name: "Floral Midi Dress",
    shortDescription: "A light dress.",
    brandId: 2,
    brandName: "ModaViva",
    brandSlug: "modaviva",
    vendorId: 8,
    vendorName: "Redress Official",
    vendorSlug: "redress-official",
    fitId: 4,
    fitCode: "regular",
    fitName: "Regular",
    minRegularPrice: "79.90",
    maxRegularPrice: "79.90",
    minCurrentPrice: "69.90",
    maxCurrentPrice: "69.90",
    inStock: 1,
    imageStorageKey: "products/dress/main.webp",
    imageAltText: null,
    imageWidth: 1200,
    imageHeight: 1600,
    ...overrides,
  };
}

describe("public catalog routes", () => {
  beforeEach(() => {
    storage.createMediaUrl.mockReset();
    storage.createMediaUrl.mockResolvedValue("https://media.example/api/v1/media/token");
    repository.findActiveBrands.mockResolvedValue([]);
    repository.findCatalogBrands.mockResolvedValue([]);
    repository.findActiveCategories.mockResolvedValue([]);
    repository.findCategoryProductCounts.mockResolvedValue([]);
    repository.findActiveColors.mockResolvedValue([]);
    repository.findActiveSizes.mockResolvedValue([]);
    repository.findActiveFitProfiles.mockResolvedValue([]);
    repository.findFilterableAttributes.mockResolvedValue([]);
    repository.findPublicProducts.mockResolvedValue({ rows: [], total: 0 });
    repository.findProductColors.mockResolvedValue([]);
    repository.findPublicProductBySlug.mockResolvedValue(null);
    repository.findProductDetailRelations.mockResolvedValue({
      media: [],
      variants: [],
      categories: [],
      attributes: [],
      measurements: [],
    });
    facetsRepository.findCatalogFacets.mockResolvedValue({
      brands: [],
      colors: [],
      sizes: [],
      priceData: null,
      discountData: null,
      flags: { onSale: 0, inStock: 0, tryOn: 0 },
    });
    reviewService.getReviewBlock.mockResolvedValue({
      summary: { average: null, count: 0 },
      top: [],
    });
    reviewService.getReviews.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it("returns public brands with signed logo URLs and string IDs", async () => {
    repository.findCatalogBrands.mockResolvedValue([
      {
        id: 9,
        code: "modaviva",
        name: "ModaViva",
        slug: "modaviva",
        logoKey: "brands/modaviva.webp",
        websiteUrl: null,
      },
    ]);

    const response = await request(app).get(
      `${env.API_PREFIX}/catalog/brands?lang=en`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          id: "9",
          code: "modaviva",
          name: "ModaViva",
          slug: "modaviva",
          logoUrl: "https://media.example/api/v1/media/token",
          websiteUrl: null,
        },
      ],
      message: "Brands retrieved successfully.",
    });
  });

  it("returns a localized nested category tree", async () => {
    repository.findActiveCategories.mockResolvedValue([
      {
        id: 1,
        parentId: null,
        code: "women",
        slug: "women",
        name: "Women",
        description: null,
      },
      {
        id: 2,
        parentId: 1,
        code: "women_dresses",
        slug: "women-dresses",
        name: "Dresses",
        description: null,
      },
    ]);
    repository.findCategoryProductCounts.mockResolvedValue([
      { categoryId: 1, productCount: 1 },
      { categoryId: 2, productCount: 1 },
    ]);

    const response = await request(app)
      .get(`${env.API_PREFIX}/catalog/categories`)
      .set("Accept-Language", "en-US");

    expect(response.status).toBe(200);
    expect(response.headers["content-language"]).toBe("en");
    expect(response.body.data[0].children[0]).toMatchObject({
      id: "2",
      slug: "women-dresses",
      name: "Dresses",
      level: 2,
      productCount: 1,
    });
    expect(repository.findActiveCategories).toHaveBeenCalledWith({
      locale: "en",
      fallbackLocale: "it",
    });
  });

  it("returns paginated product cards without storage keys", async () => {
    repository.findPublicProducts.mockResolvedValue({
      rows: [productRow()],
      total: 1,
    });
    repository.findProductColors.mockResolvedValue([
      {
        productId: 41,
        id: 3,
        code: "black",
        name: "Black",
        hexCode: "#000000",
      },
    ]);

    const response = await request(app).get(
      `${env.API_PREFIX}/catalog/products?brand=modaviva&inStock=true&limit=12`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 12,
      total: 1,
      totalPages: 1,
    });
    expect(response.body.data.items[0]).toMatchObject({
      id: "41",
      slug: "floral-midi-dress",
      image: {
        url: "https://media.example/api/v1/media/token",
        altText: "Floral Midi Dress",
        width: 1200,
        height: 1600,
      },
      price: {
        currency: "EUR",
        min: "69.90",
        max: "69.90",
      },
      inStock: true,
      fitReady: true,
      tryOnReady: false,
      vendor: {
        id: "8",
        name: "Redress Official",
        slug: "redress-official",
      },
      colors: [{ id: "3", code: "black" }],
    });
    expect(JSON.stringify(response.body)).not.toContain("imageStorageKey");
  });

  it("rejects invalid product filters before querying the database", async () => {
    const response = await request(app).get(
      `${env.API_PREFIX}/catalog/products?minPrice=90&maxPrice=10`,
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      data: null,
      message: "One or more catalog parameters are invalid.",
    });
    expect(repository.findPublicProducts).not.toHaveBeenCalled();
  });

  it("uses a stable not-found error for non-public products", async () => {
    const response = await request(app).get(
      `${env.API_PREFIX}/catalog/products/draft-product`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "The requested product could not be found.",
    });
  });

  it("returns paginated public reviews using the standard envelope", async () => {
    repository.findPublicProductBySlug.mockResolvedValue(productRow());
    reviewService.getReviews.mockResolvedValue({
      items: [
        {
          id: "77",
          rating: 5,
          author: { displayName: "Giulia R.", avatarUrl: null },
          photos: [],
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const response = await request(app).get(
      `${env.API_PREFIX}/catalog/products/floral-midi-dress/reviews?rating=5`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        items: [
          {
            id: "77",
            rating: 5,
            author: { displayName: "Giulia R.", avatarUrl: null },
            photos: [],
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
      message: "Reviews retrieved successfully.",
    });
    expect(reviewService.getReviews).toHaveBeenCalledWith(41, expect.objectContaining({ rating: [5] }));
  });

  it("returns product detail while withholding internal storage and stock data", async () => {
    repository.findPublicProductBySlug.mockResolvedValue(
      productRow({
        brandCode: "modaviva",
        brandLogoKey: "brands/modaviva.webp",
        description: "Full description.",
        careInstructions: "Wash cold.",
        sizeAndFitNotes: "Regular fit.",
        isReturnable: 1,
        returnWindowDays: 14,
      }),
    );
    repository.findProductDetailRelations.mockResolvedValue({
      media: [
        {
          id: 70,
          variantId: null,
          mediaType: "image",
          storageKey: "products/dress/main.webp",
          mimeType: "image/webp",
          altText: null,
          width: 1200,
          height: 1600,
          durationSeconds: null,
          isPrimary: 1,
        },
      ],
      variants: [
        {
          id: 80,
          sku: "RD-W-DRESS-001-BLK-M",
          sizeId: 10,
          sizeCode: "M",
          sizeLabel: "M",
          sizeSystemCode: "alpha",
          sizeSystemName: "Alpha",
          colorId: 3,
          colorCode: "black",
          colorName: "Black",
          colorHexCode: "#000000",
          regularPrice: "79.90",
          currentPrice: "69.90",
          isDefault: 1,
          weightValue: null,
          weightUnit: null,
          inStock: 1,
          allowsBackorder: 0,
          availableQuantity: 99,
          costPrice: "20.00",
          quantityOnHand: 99,
        },
      ],
      returns: {
        allowed: true,
        windowDays: 14,
      },
      categories: [
        {
          id: 5,
          code: "women_dresses",
          slug: "women-dresses",
          name: "Dresses",
          isPrimary: 1,
        },
      ],
      attributes: [
        {
          variantId: null,
          attributeId: 15,
          attributeCode: "fabric",
          attributeName: "Fabric",
          dataType: "option",
          defaultUnitCode: null,
          optionId: 16,
          optionCode: "cotton",
          optionLabel: "Cotton",
          valueText: null,
          valueDecimal: null,
          valueBoolean: null,
          unitCode: null,
        },
      ],
      measurements: [
        {
          variantId: 80,
          code: "bust_circumference",
          name: "Bust circumference",
          valueCm: "94.00",
          tolerancePlusCm: "1.00",
          toleranceMinusCm: "1.00",
          isEstimated: 0,
        },
      ],
    });

    const response = await request(app).get(
      `${env.API_PREFIX}/catalog/products/floral-midi-dress?lang=en`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBeTruthy();
    expect(response.headers["cache-control"]).toContain("max-age=60");
    const cachedResponse = await request(app)
      .get(`${env.API_PREFIX}/catalog/products/floral-midi-dress?lang=en`)
      .set("If-None-Match", response.headers.etag);
    expect(cachedResponse.status).toBe(304);
    expect(response.body.data.product).toMatchObject({
      id: "41",
      brand: {
        id: "2",
        code: "modaviva",
        logoUrl: "https://media.example/api/v1/media/token",
      },
      vendor: {
        id: "8",
        name: "Redress Official",
        slug: "redress-official",
      },
      fitReady: true,
      attributes: [
        {
          code: "fabric",
          value: {
            id: "16",
            code: "cotton",
            label: "Cotton",
          },
        },
      ],
      media: [
        {
          id: "70",
          url: "https://media.example/api/v1/media/token",
          isPrimary: true,
        },
      ],
      variants: [
        {
          id: "80",
          price: {
            current: "69.90",
            regular: "79.90",
            onSale: true,
          },
          inStock: true,
          lowStock: false,
          maxQty: 3,
          measurements: [{ code: "bust_circumference", valueCm: "94.00" }],
        },
      ],
    });
    expect(response.body.data).toMatchObject({
      reviews: { summary: { average: null, count: 0 }, top: [] },
      related: {
        similar: [],
        sameBrand: [],
        completeLook: [],
        seeAll: {
          similar: { category: "women-dresses" },
          sameBrand: { brand: "modaviva" },
        },
      },
    });

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("costPrice");
    expect(serialized).not.toContain("quantityOnHand");
  });

  it("returns 304 when only opaque media URL tokens change", async () => {
    let token = 0;
    storage.createMediaUrl.mockImplementation(
      () => `https://media.example/api/v1/media/token-${++token}`,
    );
    repository.findPublicProductBySlug.mockResolvedValue(
      productRow({
        brandCode: "modaviva",
        brandLogoKey: "brands/modaviva.webp",
      }),
    );

    const first = await request(app).get(
      `${env.API_PREFIX}/catalog/products/floral-midi-dress?lang=en`,
    );
    const second = await request(app)
      .get(`${env.API_PREFIX}/catalog/products/floral-midi-dress?lang=en`)
      .set("If-None-Match", first.headers.etag);

    expect(first.status).toBe(200);
    expect(second.status).toBe(304);
    expect(storage.createMediaUrl).toHaveBeenCalledTimes(2);
  });

  it("returns product detail when related product lookups fail", async () => {
    repository.findPublicProductBySlug.mockResolvedValue(productRow());
    repository.findProductDetailRelations.mockResolvedValue({
      media: [],
      variants: [],
      categories: [
        {
          id: 5,
          code: "women_dresses",
          slug: "women-dresses",
          name: "Dresses",
          isPrimary: 1,
        },
      ],
      attributes: [],
      measurements: [],
    });
    repository.findPublicProducts.mockRejectedValue(
      new Error("Recommendation lookup unavailable"),
    );

    const response = await request(app).get(
      `${env.API_PREFIX}/catalog/products/floral-midi-dress?lang=en`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.related).toMatchObject({
      similar: [],
      sameBrand: [],
    });
  });
});
