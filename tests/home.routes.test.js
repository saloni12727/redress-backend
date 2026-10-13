import request from "supertest";

import { beforeEach, describe, expect, it, vi } from "vitest";

const homeRepository = vi.hoisted(() => ({
  findLiveHomePlacements: vi.fn(),
}));

const catalog = vi.hoisted(() => ({
  getBrands: vi.fn(),
  getCatalogFilters: vi.fn(),
  getCategories: vi.fn(),
  getProductBySlug: vi.fn(),
  getProducts: vi.fn(),
}));

const storage = vi.hoisted(() => ({
  createMediaUrl: vi.fn(async () => "https://media.example/api/v1/media/token"),
}));

vi.mock("../src/modules/home/home.repository.js", () => homeRepository);
vi.mock("../src/modules/catalog/catalog.service.js", () => catalog);
vi.mock("../src/services/media-url.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  createMediaUrl: storage.createMediaUrl,
}));

import app from "../src/app.js";
import { env } from "../src/config/env.js";

function productCard() {
  return {
    id: "41",
    code: "RD-W-DRESS-001",
    slug: "floral-midi-dress",
    name: "Floral Midi Dress",
    shortDescription: "A light dress.",
    isFeatured: true,
    publishedAt: "2026-10-01T10:00:00.000Z",
    brand: null,
    vendor: {
      name: "Redress Official",
      slug: "redress-official",
    },
    fit: null,
    price: {
      currency: "EUR",
      min: "69.90",
      max: "69.90",
      regularMin: "79.90",
      regularMax: "79.90",
    },
    inStock: true,
    image: {
      url: "https://media.example/api/v1/media/token",
      altText: "Floral Midi Dress",
      width: 1200,
      height: 1600,
    },
    colors: [],
  };
}

function placement(overrides = {}) {
  return {
    id: 101,
    sectionKey: "hero",
    targetType: "product",
    targetProductId: 41,
    targetBrandId: null,
    targetCategoryId: null,
    publicTargetProductId: 41,
    publicTargetBrandId: null,
    targetBrandName: null,
    targetBrandLogoKey: null,
    targetProductName: "Floral Midi Dress",
    targetProductBrandName: null,
    targetProductBrandId: null,
    targetProductPrice: "69.90",
    targetProductMrp: "79.90",
    targetProductCurrency: "EUR",
    targetProductImageStorageKey: "products/floral-midi-dress.webp",
    targetFilters: null,
    linkPath: null,
    linkQuery: null,
    externalUrl: null,
    offerPayload: null,
    imageStorageKey: "home/hero/autumn.webp",
    imageWidth: 1600,
    imageHeight: 900,
    sortOrder: 1,
    titleEn: "Autumn edit",
    titleIt: "Selezione autunnale",
    subtitleEn: "Selected styles for the season.",
    subtitleIt: "Stili scelti per la stagione.",
    ctaLabelEn: "Shop now",
    ctaLabelIt: "Acquista ora",
    altTextEn: "Woman wearing an autumn outfit",
    altTextIt: "Donna con un look autunnale",
    badgeEn: null,
    badgeIt: null,
    discountLabelEn: null,
    discountLabelIt: null,
    startsAt: null,
    endsAt: null,
    targetBrandSlug: null,
    targetCategorySlug: null,
    ...overrides,
  };
}

describe("public home feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    homeRepository.findLiveHomePlacements.mockResolvedValue([]);
    catalog.getBrands.mockResolvedValue([]);
    catalog.getCategories.mockResolvedValue([
      { id: "1", slug: "women", name: "Women", children: [] },
      { id: "2", slug: "men", name: "Men", children: [] },
      { id: "3", slug: "kids", name: "Kids", children: [] },
    ]);
    catalog.getProducts.mockResolvedValue({
      products: [productCard()],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it("returns curated placements, typed destinations, and product rails", async () => {
    homeRepository.findLiveHomePlacements.mockResolvedValue([
      placement(),
      placement({
        id: 102,
        sectionKey: "audience",
        targetType: "category",
        imageStorageKey: "home/audience/women.webp",
        publicTargetCategoryId: 1,
        targetCategorySlug: "women",
        titleEn: "Women",
        titleIt: "Donna",
      }),
      placement({
        id: 103,
        sectionKey: "top_brand",
        targetType: "brand",
        imageStorageKey: "home/brands/modaviva.webp",
        publicTargetBrandId: 5,
        targetBrandName: "ModaViva",
        targetBrandLogoKey: "brands/modaviva-logo.webp",
        targetBrandSlug: "modaviva",
      }),
      placement({
        id: 104,
        sectionKey: "promotion",
        targetType: "catalog",
        imageStorageKey: null,
        targetFilters: {
          brand: ["modaviva", "not valid"],
          inStock: true,
          sort: "newest",
          unsupported: "not returned",
        },
      }),
      placement({
        id: 105,
        sectionKey: "offer",
        targetType: "offer",
        imageStorageKey: "home/offers/weekend.webp",
        offerPayload: {
          id: "campaign-105",
          title: "Weekend offer",
          badge: "30% OFF",
          minDiscount: 30,
        },
      }),
    ]);

    const response = await request(app).get(`${env.API_PREFIX}/home/feed?lang=en`);

    expect(response.status).toBe(200);
    expect(response.headers["content-language"]).toBe("en");
    expect(response.headers["cache-control"]).toContain("must-revalidate");
    expect(response.body).toMatchObject({
      success: true,
      message: "Home feed retrieved successfully.",
      data: {
        generatedAt: expect.any(String),
        locale: "en",
        meta: {
          unreadNotifications: 0,
          wishlistCount: 0,
          delivery: { addressId: null, city: null, label: null },
        },
        banners: [
          {
            id: "101",
            title: "Autumn edit",
            imageUrl: "https://media.example/api/v1/media/token",
            type: "product",
            link: {
              type: "product",
              path: "/product/41",
              query: { productId: "41" },
            },
            product: {
              id: "41",
              title: "Floral Midi Dress",
              price: 69.9,
              mrp: 79.9,
              currency: "EUR",
              imageUrls: ["https://media.example/api/v1/media/token"],
            },
          },
        ],
        audiences: expect.arrayContaining([
          {
            id: "1",
            label: "Women",
            imageUrl: "https://media.example/api/v1/media/token",
            audience: "women",
            link: {
              type: "catalog",
              path: "/categories",
              query: { audience: "women" },
            },
          },
        ]),
        brands: [
          {
            id: "5",
            name: "ModaViva",
            imageUrl: "https://media.example/api/v1/media/token",
          },
        ],
        studio: {
          title: "Style Studio",
          link: { type: "tryOn", path: "/try-on", query: {} },
        },
        promo: { id: "104", title: "Autumn edit" },
        lookbook: [],
        aiPicks: { items: [expect.objectContaining({ id: "41" })] },
        hotOffers: {
          items: [
            {
              id: "105",
              type: "offer",
              offer: {
                id: "campaign-105",
                title: "Weekend offer",
                badge: "30% OFF",
                minDiscount: 30,
              },
            },
          ],
        },
        deals: { items: [expect.objectContaining({ id: "41" })] },
        tryOnPicks: { items: [expect.objectContaining({ id: "41" })] },
        trending: { items: [expect.objectContaining({ id: "41" })] },
      },
    });

    expect(catalog.getCategories).toHaveBeenCalledWith("en");
    expect(catalog.getProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 8,
        featured: true,
        inStock: true,
        sort: "featured",
      }),
      "en",
    );
    expect(catalog.getProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 8,
        featured: undefined,
        inStock: true,
        sort: "newest",
      }),
      "en",
    );
    expect(catalog.getProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 8,
        minDiscount: 30,
        sort: "discount",
      }),
      "en",
    );
  });

  it("keeps curated brand artwork and fills the Home brand rail to six", async () => {
    homeRepository.findLiveHomePlacements.mockResolvedValue([
      placement({
        id: 103,
        sectionKey: "top_brand",
        targetType: "brand",
        imageStorageKey: "home/brands/test-modaviva.webp",
        publicTargetBrandId: 5,
        targetBrandName: "ModaViva",
      }),
    ]);
    catalog.getBrands.mockResolvedValue(
      Array.from({ length: 7 }, (_, index) => ({
        id: String(index + 5),
        name: `Brand ${index + 1}`,
        slug: `brand-${index + 1}`,
        logoUrl: `https://media.example/logo-${index + 1}.webp`,
      })),
    );

    const response = await request(app).get(`${env.API_PREFIX}/home/feed?lang=en`);
    const brands = response.body.data.brands;

    expect(response.status).toBe(200);
    expect(brands).toHaveLength(6);
    expect(brands[0]).toMatchObject({
      id: "5",
      name: "ModaViva",
      imageUrl: "https://media.example/api/v1/media/token",
    });
    expect(brands[1]).toMatchObject({
      id: "6",
      name: "Brand 2",
      imageUrl: "https://media.example/logo-2.webp",
    });
    expect(new Set(brands.map((brand) => brand.id)).size).toBe(6);
  });

  it("returns two image-backed demo cards for lookbook, hot offers, and trending", async () => {
    const products = [
      productCard(),
      {
        ...productCard(),
        id: "42",
        code: "RD-M-SHIRT-001",
        slug: "mens-shirt",
        name: "Men's Shirt",
      },
      {
        ...productCard(),
        id: "43",
        code: "RD-G-DRESS-001",
        slug: "girls-dress",
        name: "Girls' Dress",
      },
    ];
    catalog.getProducts
      .mockResolvedValueOnce({ products: [products[0]] })
      .mockResolvedValueOnce({ products })
      .mockResolvedValueOnce({ products: [products[0]] });
    homeRepository.findLiveHomePlacements.mockResolvedValue([
      ...Array.from({ length: 6 }, (_, index) =>
        placement({
          id: 200 + index,
          sectionKey: "top_brand",
          targetType: "brand",
          imageStorageKey: `home/brands/test-${index}.webp`,
          publicTargetBrandId: index + 1,
          targetBrandName: `Brand ${index + 1}`,
        }),
      ),
      placement({
        id: 210,
        sectionKey: "lookbook",
        imageStorageKey: "home/lookbook/test-women.webp",
        titleEn: "Women's edit",
      }),
      placement({
        id: 211,
        sectionKey: "lookbook",
        imageStorageKey: "home/lookbook/test-men.webp",
        titleEn: "Men's edit",
        sortOrder: 2,
      }),
      placement({
        id: 212,
        sectionKey: "offer",
        targetType: "offer",
        imageStorageKey: "home/offers/test-weekend.webp",
        offerPayload: { id: "weekend" },
      }),
      placement({
        id: 213,
        sectionKey: "offer",
        targetType: "offer",
        imageStorageKey: "home/offers/test-daily.webp",
        offerPayload: { id: "daily" },
        sortOrder: 2,
      }),
      placement({
        id: 214,
        sectionKey: "offer",
        targetType: "catalog",
        targetProductId: null,
        publicTargetProductId: null,
        targetFilters: { inStock: true, sort: "featured" },
        imageStorageKey: "home/offers/test-catalog.webp",
        titleEn: "Catalog offer",
        badgeEn: "SALE",
        offerPayload: null,
        sortOrder: 3,
      }),
    ]);

    const response = await request(app).get(`${env.API_PREFIX}/home/feed?lang=en`);
    const { brands, lookbook, hotOffers, trending } = response.body.data;

    expect(response.status).toBe(200);
    expect(brands).toHaveLength(6);
    expect(brands.every((brand) => brand.imageUrl)).toBe(true);
    expect(lookbook).toHaveLength(2);
    expect(lookbook.every((item) => item.imageUrl)).toBe(true);
    expect(hotOffers.items).toHaveLength(3);
    expect(hotOffers.items.every((item) => item.imageUrl)).toBe(true);
    expect(hotOffers.items[2]).toMatchObject({
      id: "214",
      type: "catalog",
      offer: {
        id: "214",
        title: "Catalog offer",
        badge: "SALE",
      },
    });
    expect(trending.items).toHaveLength(2);
    expect(trending.items.every((item) => item.image.url)).toBe(true);
  });

  it("uses the standard error shape for invalid request parameters", async () => {
    const response = await request(app).get(`${env.API_PREFIX}/home/feed?limit=2`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "The request parameters are invalid. Use lang=en or lang=it.",
    });
    expect(homeRepository.findLiveHomePlacements).not.toHaveBeenCalled();
    expect(catalog.getProducts).not.toHaveBeenCalled();
  });

  it("does not expose dependency errors", async () => {
    homeRepository.findLiveHomePlacements.mockRejectedValue(
      new Error("storage connection details"),
    );

    const response = await request(app).get(`${env.API_PREFIX}/home/feed`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "An unexpected error occurred. Please try again later.",
    });
  });
});
