import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ProductVariant: { findOne: vi.fn() },
}));

vi.mock("../src/config/database.js", () => ({
  sequelize: {},
}));
vi.mock("../src/models/index.js", () => ({
  Address: {},
  Cart: {},
  CartItem: {},
  Color: {},
  Inventory: {},
  Order: {},
  OrderItem: {},
  OrderReturn: {},
  OrderReturnItem: {},
  Payment: {},
  Product: {},
  ProductMedia: {},
  ProductVariant: state.ProductVariant,
  Size: {},
}));
vi.mock("../src/services/media/media-storage.service.js", () => ({
  getMediaUrl: vi.fn(),
}));

import {
  lockAndValidateCartVariant,
} from "../src/modules/commerce/commerce.service.js";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

function purchasableVariant(overrides = {}) {
  return {
    id: 7,
    product: {
      status: "published",
      approvalStatus: "approved",
      visibility: "public",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    inventory: {
      quantityOnHand: 5,
      quantityReserved: 1,
      allowBackorder: false,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("guest-cart availability validation", () => {
  it("locks and accepts a publicly purchasable variant within available stock", async () => {
    const variant = purchasableVariant();
    state.ProductVariant.findOne.mockResolvedValue(variant);

    await expect(
      lockAndValidateCartVariant({
        productVariantId: 7,
        quantity: 4,
        transaction,
      }),
    ).resolves.toBe(variant);

    expect(state.ProductVariant.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7, isActive: true },
        lock: "UPDATE",
        transaction,
      }),
    );
  });

  it("rejects a quantity above current available inventory", async () => {
    state.ProductVariant.findOne.mockResolvedValue(purchasableVariant());

    await expect(
      lockAndValidateCartVariant({
        productVariantId: 7,
        quantity: 5,
        transaction,
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("rejects a variant whose product is no longer publicly purchasable", async () => {
    state.ProductVariant.findOne.mockResolvedValue(
      purchasableVariant({
        product: {
          status: "draft",
          approvalStatus: "approved",
          visibility: "public",
          publishedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
    );

    await expect(
      lockAndValidateCartVariant({
        productVariantId: 7,
        quantity: 1,
        transaction,
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
