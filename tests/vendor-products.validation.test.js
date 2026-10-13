import { describe, expect, it } from "vitest";

import {
  categoryMappingSchema,
  createProductSchema,
  createVariantSchema,
  productAttributesSchema,
  sizeChartSchema,
  updateProductSchema,
} from "../src/modules/vendor-products/vendor-products.validation.js";

describe("Vendor product validation", () => {
  it("accepts the minimum viable draft and partial draft updates", () => {
    expect(
      createProductSchema.safeParse({
        code: "linen_shirt",
        slug: "linen-shirt",
        currencyCode: "EUR",
      }).success,
    ).toBe(true);

    expect(updateProductSchema.safeParse({ brandId: null }).success).toBe(true);
  });

  it("requires unique category mappings and valid variant prices", () => {
    expect(
      categoryMappingSchema.safeParse({
        categories: [{ categoryId: 3 }, { categoryId: 3 }],
      }).success,
    ).toBe(false);

    expect(
      createVariantSchema.safeParse({
        sku: "LINEN-S-RED",
        regularPrice: 49,
        salePrice: 50,
      }).success,
    ).toBe(false);
  });

  it("accepts typed attribute values and rejects duplicate size-chart entries", () => {
    expect(
      productAttributesSchema.safeParse({
        attributes: [{ attributeId: 7, optionValueIds: [11] }],
      }).success,
    ).toBe(true);

    expect(
      sizeChartSchema.safeParse({
        measurements: [
          { measurementTypeId: 2, valueCm: 90 },
          { measurementTypeId: 2, valueCm: 91 },
        ],
      }).success,
    ).toBe(false);
  });
});
