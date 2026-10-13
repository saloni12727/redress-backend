import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  transaction: {
    LOCK: { UPDATE: "UPDATE" },
    finished: null,
    commit: vi.fn(),
    rollback: vi.fn(),
  },
  sequelize: { transaction: vi.fn() },
  Address: {
    findOne: vi.fn(),
    destroy: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../src/config/database.js", () => ({
  sequelize: state.sequelize,
}));
vi.mock("../src/models/index.js", () => ({
  Address: state.Address,
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
  ProductVariant: {},
  Size: {},
}));
vi.mock("../src/services/media/media-storage.service.js", () => ({
  getMediaUrl: vi.fn(),
}));

import { removeAddress } from "../src/modules/commerce/commerce.service.js";

const accountId = "42";
const addressId = 4;

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
  state.Address.destroy.mockResolvedValue(1);
  state.Address.update.mockResolvedValue([1]);
});

describe("removeAddress", () => {
  it("soft-deletes only the authenticated account's non-default address", async () => {
    state.Address.findOne.mockResolvedValue({
      id: addressId,
      isDefault: false,
    });

    await expect(removeAddress({ accountId, addressId })).resolves.toBeUndefined();

    expect(state.Address.destroy).toHaveBeenCalledWith({
      where: { id: addressId, accountId },
      transaction: state.transaction,
    });
    expect(state.Address.update).not.toHaveBeenCalled();
    expect(state.transaction.commit).toHaveBeenCalledOnce();
  });

  it("promotes the newest remaining address after deleting the default", async () => {
    state.Address.findOne
      .mockResolvedValueOnce({ id: addressId, isDefault: 1 })
      .mockResolvedValueOnce({ id: 9, isDefault: false });

    await removeAddress({ accountId, addressId });

    expect(state.Address.findOne).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { accountId },
        order: [
          ["updated_at", "DESC"],
          ["id", "DESC"],
        ],
        transaction: state.transaction,
        lock: "UPDATE",
      }),
    );
    expect(state.Address.update).toHaveBeenCalledWith(
      { isDefault: true },
      {
        where: { id: 9, accountId },
        transaction: state.transaction,
      },
    );
  });

  it("rolls back and returns not found for an address outside the account", async () => {
    state.Address.findOne.mockResolvedValue(null);

    await expect(removeAddress({ accountId, addressId })).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(state.Address.destroy).not.toHaveBeenCalled();
    expect(state.transaction.rollback).toHaveBeenCalledOnce();
  });

  it("returns a conflict instead of a generic server error for a database reference", async () => {
    state.Address.findOne.mockResolvedValue({
      id: addressId,
      isDefault: false,
    });
    state.Address.destroy.mockRejectedValue({
      parent: { code: "ER_ROW_IS_REFERENCED_2" },
    });

    await expect(removeAddress({ accountId, addressId })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(state.transaction.rollback).toHaveBeenCalledOnce();
  });
});
