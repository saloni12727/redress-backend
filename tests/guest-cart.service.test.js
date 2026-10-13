import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  transaction: {
    LOCK: { UPDATE: "UPDATE" },
    finished: null,
    commit: vi.fn(),
    rollback: vi.fn(),
  },
  sequelize: {
    transaction: vi.fn(),
    query: vi.fn(),
  },
  Account: { findByPk: vi.fn() },
  Cart: { findOne: vi.fn(), create: vi.fn() },
  CartItem: { findAll: vi.fn(), findOne: vi.fn() },
  markGuestSessionConverted: vi.fn(),
  verifyGuestToken: vi.fn(),
  getCart: vi.fn(),
  lockAndValidateCartVariant: vi.fn(),
}));

vi.mock("../src/config/database.js", () => ({ sequelize: state.sequelize }));
vi.mock("../src/models/index.js", () => ({
  Account: state.Account,
  Cart: state.Cart,
  CartItem: state.CartItem,
}));
vi.mock("../src/modules/guest/guest.repository.js", () => ({
  markGuestSessionConverted: state.markGuestSessionConverted,
}));
vi.mock("../src/modules/guest/guest-token.service.js", () => ({
  verifyGuestToken: state.verifyGuestToken,
}));
vi.mock("../src/modules/commerce/commerce.service.js", () => ({
  getCart: state.getCart,
  lockAndValidateCartVariant: state.lockAndValidateCartVariant,
}));

import { mergeGuestCart } from "../src/modules/commerce/guest-cart.service.js";

const accountId = "42";
const guestSessionId = "ec57e2b2-c76c-48d9-9b54-5605df061301";

function activeGuestSession(overrides = {}) {
  return {
    session_uuid: guestSessionId,
    token_version: 1,
    status: "active",
    converted_account_id: null,
    expires_at: "2030-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function cart(id, overrides = {}) {
  return {
    id,
    destroy: vi.fn(),
    ...overrides,
  };
}

function cartItem({ cartId, productVariantId, quantity }) {
  return {
    cartId,
    productVariantId,
    quantity,
    update: vi.fn(),
    destroy: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.transaction.finished = null;
  state.transaction.commit.mockImplementation(async () => {
    state.transaction.finished = "commit";
  });
  state.transaction.rollback.mockImplementation(async () => {
    state.transaction.finished = "rollback";
  });
  state.sequelize.transaction.mockResolvedValue(state.transaction);
  state.sequelize.query.mockResolvedValue([activeGuestSession()]);
  state.Account.findByPk.mockResolvedValue({ id: accountId });
  state.markGuestSessionConverted.mockResolvedValue(undefined);
  state.verifyGuestToken.mockReturnValue({ sid: guestSessionId, ver: 1 });
  state.getCart.mockResolvedValue({ items: [], summary: { count: 0 } });
  state.lockAndValidateCartVariant.mockResolvedValue({ id: 7 });
});

describe("guest cart merge", () => {
  it("merges the same variant only after validating the combined quantity", async () => {
    const accountCart = cart(101);
    const guestCart = cart(202);
    const accountItem = cartItem({
      cartId: accountCart.id,
      productVariantId: 7,
      quantity: 2,
    });
    const guestItem = cartItem({
      cartId: guestCart.id,
      productVariantId: 7,
      quantity: 3,
    });
    state.Cart.findOne.mockImplementation(({ where }) =>
      where.accountId ? accountCart : guestCart,
    );
    state.CartItem.findAll.mockResolvedValue([guestItem]);
    state.CartItem.findOne.mockResolvedValue(accountItem);

    await mergeGuestCart({ accountId, guestToken: "guest-token" });

    expect(state.Account.findByPk).toHaveBeenCalledWith(
      accountId,
      expect.objectContaining({ lock: "UPDATE" }),
    );
    expect(state.lockAndValidateCartVariant).toHaveBeenCalledWith({
      productVariantId: 7,
      quantity: 5,
      transaction: state.transaction,
    });
    expect(accountItem.update).toHaveBeenCalledWith(
      { quantity: 5 },
      { transaction: state.transaction },
    );
    expect(guestItem.destroy).toHaveBeenCalledWith({
      transaction: state.transaction,
    });
    expect(guestCart.destroy).toHaveBeenCalledWith({
      transaction: state.transaction,
    });
    expect(state.markGuestSessionConverted).toHaveBeenCalledWith({
      sessionUuid: guestSessionId,
      accountId,
      transaction: state.transaction,
    });
    expect(state.transaction.commit).toHaveBeenCalledOnce();
  });

  it("keeps both carts unchanged when the combined quantity is unavailable", async () => {
    const accountCart = cart(101);
    const guestCart = cart(202);
    const accountItem = cartItem({
      cartId: accountCart.id,
      productVariantId: 7,
      quantity: 9,
    });
    const guestItem = cartItem({
      cartId: guestCart.id,
      productVariantId: 7,
      quantity: 2,
    });
    state.Cart.findOne.mockImplementation(({ where }) =>
      where.accountId ? accountCart : guestCart,
    );
    state.CartItem.findAll.mockResolvedValue([guestItem]);
    state.CartItem.findOne.mockResolvedValue(accountItem);
    state.lockAndValidateCartVariant.mockRejectedValue(
      new Error("quantity unavailable"),
    );

    await expect(
      mergeGuestCart({ accountId, guestToken: "guest-token" }),
    ).rejects.toThrow("quantity unavailable");

    expect(accountItem.update).not.toHaveBeenCalled();
    expect(guestItem.destroy).not.toHaveBeenCalled();
    expect(guestCart.destroy).not.toHaveBeenCalled();
    expect(state.markGuestSessionConverted).not.toHaveBeenCalled();
    expect(state.transaction.rollback).toHaveBeenCalledOnce();
  });

  it("validates a guest-only variant before moving it to the account cart", async () => {
    const accountCart = cart(101);
    const guestCart = cart(202);
    const guestItem = cartItem({
      cartId: guestCart.id,
      productVariantId: 8,
      quantity: 2,
    });
    state.Cart.findOne.mockImplementation(({ where }) =>
      where.accountId ? accountCart : guestCart,
    );
    state.CartItem.findAll.mockResolvedValue([guestItem]);
    state.CartItem.findOne.mockResolvedValue(null);

    await mergeGuestCart({ accountId, guestToken: "guest-token" });

    expect(state.lockAndValidateCartVariant).toHaveBeenCalledWith({
      productVariantId: 8,
      quantity: 2,
      transaction: state.transaction,
    });
    expect(guestItem.update).toHaveBeenCalledWith(
      { cartId: accountCart.id },
      { transaction: state.transaction },
    );
  });

  it("returns the account cart without re-merging a retry already converted to this account", async () => {
    state.sequelize.query.mockResolvedValue([
      activeGuestSession({
        status: "converted",
        converted_account_id: Number(accountId),
      }),
    ]);
    const expectedCart = { items: [{ id: "1" }] };
    state.getCart.mockResolvedValue(expectedCart);

    const result = await mergeGuestCart({
      accountId,
      guestToken: "guest-token",
    });

    expect(result).toBe(expectedCart);
    expect(state.Account.findByPk).not.toHaveBeenCalled();
    expect(state.markGuestSessionConverted).not.toHaveBeenCalled();
    expect(state.transaction.commit).toHaveBeenCalledOnce();
  });
});
