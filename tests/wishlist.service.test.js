import { UniqueConstraintError } from "sequelize";

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  Product: { findOne: vi.fn() },
  WishlistItem: {
    findOne: vi.fn(),
    create: vi.fn(),
    destroy: vi.fn(),
  },
  getWishlistProducts: vi.fn(),
}));

vi.mock("../src/models/index.js", () => ({
  Product: state.Product,
  Vendor: {},
  WishlistItem: state.WishlistItem,
}));
vi.mock("../src/modules/catalog/catalog.service.js", () => ({
  getWishlistProducts: state.getWishlistProducts,
}));

import {
  addWishlistItem,
  listWishlist,
  removeWishlistItem,
} from "../src/modules/wishlist/wishlist.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  state.Product.findOne.mockResolvedValue({ id: 7 });
});

describe("wishlist service", () => {
  it("adds a public product once for the authenticated account", async () => {
    state.WishlistItem.findOne.mockResolvedValue(null);

    await expect(
      addWishlistItem({ accountId: "42", productId: 7 }),
    ).resolves.toEqual({
      productId: "7",
      wishlisted: true,
      created: true,
    });

    expect(state.Product.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 7,
          status: "published",
          approvalStatus: "approved",
          visibility: "public",
        }),
      }),
    );
    expect(state.WishlistItem.create).toHaveBeenCalledWith({
      accountId: "42",
      productId: 7,
    });
  });

  it("does not create a duplicate when an item is already saved", async () => {
    state.WishlistItem.findOne.mockResolvedValue({ id: 99 });

    await expect(
      addWishlistItem({ accountId: "42", productId: 7 }),
    ).resolves.toEqual({
      productId: "7",
      wishlisted: true,
      created: false,
    });

    expect(state.WishlistItem.create).not.toHaveBeenCalled();
  });

  it("handles a concurrent duplicate save without failing", async () => {
    state.WishlistItem.findOne.mockResolvedValue(null);
    state.WishlistItem.create.mockRejectedValue(
      new UniqueConstraintError({ errors: [] }),
    );

    await expect(
      addWishlistItem({ accountId: "42", productId: 7 }),
    ).resolves.toEqual({
      productId: "7",
      wishlisted: true,
      created: false,
    });
  });

  it("does not permit saving a non-public product", async () => {
    state.Product.findOne.mockResolvedValue(null);

    await expect(
      addWishlistItem({ accountId: "42", productId: 7 }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(state.WishlistItem.findOne).not.toHaveBeenCalled();
    expect(state.WishlistItem.create).not.toHaveBeenCalled();
  });

  it("removes only the authenticated account's saved item", async () => {
    await removeWishlistItem({ accountId: "42", productId: 7 });

    expect(state.WishlistItem.destroy).toHaveBeenCalledWith({
      where: { accountId: "42", productId: 7 },
    });
  });

  it("returns catalog cards and pagination for the account wishlist", async () => {
    state.getWishlistProducts.mockResolvedValue({
      products: [{ id: "7", wishlisted: true }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    await expect(
      listWishlist({
        accountId: "42",
        query: { page: 1, limit: 20 },
        locale: "en",
      }),
    ).resolves.toEqual({
      items: [{ id: "7", wishlisted: true }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    expect(state.getWishlistProducts).toHaveBeenCalledWith(
      { accountId: "42", page: 1, limit: 20 },
      "en",
    );
  });
});
