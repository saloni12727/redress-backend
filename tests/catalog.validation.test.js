import { describe, expect, it } from "vitest";

import {
  catalogLanguageQuerySchema,
  productListQuerySchema,
  productSlugParamsSchema,
} from "../src/modules/catalog/catalog.validation.js";

describe("catalog validation", () => {
  it("applies safe product-list defaults", () => {
    expect(productListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      brand: [],
      color: [],
      size: [],
      fit: [],
      sort: "featured",
    });
  });

  it("normalizes repeated and comma-separated filters", () => {
    const result = productListQuerySchema.parse({
      page: "2",
      limit: "25",
      brand: ["modaviva,urban-loom", "modaviva"],
      color: "black,navy",
      size: ["10", "11,12"],
      featured: "1",
      inStock: "true",
      audience: "women",
      tryOn: "false",
      minPrice: "10.50",
      maxPrice: "99.99",
      minDiscount: "30",
      sort: "discount",
      lang: "en",
    });

    expect(result).toMatchObject({
      page: 2,
      limit: 25,
      brand: ["modaviva", "urban-loom"],
      color: ["black", "navy"],
      size: ["10", "11", "12"],
      featured: true,
      inStock: true,
      audience: "women",
      tryOn: false,
      minDiscount: 30,
      sort: "discount",
      lang: "en",
    });
  });

  it("rejects invalid ranges, unknown fields, and unsafe slugs", () => {
    expect(
      productListQuerySchema.safeParse({
        minPrice: "100.00",
        maxPrice: "20.00",
      }).success,
    ).toBe(false);

    expect(
      productListQuerySchema.safeParse({ internal: "true" }).success,
    ).toBe(false);
    expect(
      productListQuerySchema.safeParse({ minDiscount: "101" }).success,
    ).toBe(false);

    expect(productSlugParamsSchema.safeParse({ slug: "../draft" }).success).toBe(
      false,
    );
  });

  it("only accepts supported language query parameters", () => {
    expect(catalogLanguageQuerySchema.safeParse({ lang: "it" }).success).toBe(
      true,
    );
    expect(catalogLanguageQuerySchema.safeParse({ lang: "fr" }).success).toBe(
      false,
    );
  });
});
