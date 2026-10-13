import { beforeEach, describe, expect, it, vi } from "vitest";
import { Op } from "sequelize";

const state = vi.hoisted(() => ({
  transaction: {
    LOCK: { UPDATE: "UPDATE" },
    finished: null,
    commit: vi.fn(),
    rollback: vi.fn(),
  },
  sequelize: { transaction: vi.fn() },
  Order: { findOne: vi.fn() },
  OrderItem: { findAll: vi.fn() },
  Inventory: { findOne: vi.fn() },
  OrderReturn: { findAll: vi.fn(), findAndCountAll: vi.fn(), findOne: vi.fn(), create: vi.fn() },
  OrderReturnItem: { create: vi.fn() },
  OrderFulfillment: {},
}));

vi.mock("../src/config/database.js", () => ({ sequelize: state.sequelize }));
vi.mock("../src/models/index.js", () => ({
  Address: {},
  Cart: {},
  CartItem: {},
  Color: {},
  Inventory: state.Inventory,
  Order: state.Order,
  OrderItem: state.OrderItem,
  OrderFulfillment: state.OrderFulfillment,
  OrderReturn: state.OrderReturn,
  OrderReturnItem: state.OrderReturnItem,
  Payment: {},
  Product: {},
  ProductMedia: {},
  ProductVariant: {},
  Size: {},
}));
vi.mock("../src/services/media/media-storage.service.js", () => ({
  getMediaUrl: vi.fn(),
}));

import {
  cancelOrder,
  cancelReturnRequest,
  createReturnRequest,
  getOrderTracking,
  getReturnRequest,
  listReturnRequests,
} from "../src/modules/commerce/commerce.service.js";

const accountId = 5;
const fixedNow = new Date("2026-10-20T12:00:00.000Z");

function order(overrides = {}) {
  return {
    id: 123,
    accountId,
    orderNumber: "RG-123",
    status: "placed",
    deliveredAt: null,
    updatedAt: fixedNow,
    update: vi.fn(async function update(values) {
      Object.assign(this, values);
    }),
    ...overrides,
  };
}

function orderItem(overrides = {}) {
  return {
    id: 456,
    orderId: 123,
    productVariantId: 77,
    productSnapshot: { title: "Jacket" },
    quantity: 3,
    unitPrice: "25.00",
    ...overrides,
  };
}

function deliveredOrder(overrides = {}) {
  return order({
    status: "delivered",
    deliveredAt: new Date("2026-10-10T12:00:00.000Z"),
    ...overrides,
  });
}

function validReturnPayload(items = [{ orderItemId: 456, quantity: 1, reason: "sizeFit", note: null }]) {
  return { orderId: 123, items };
}

function returnItemPayload(overrides = {}) {
  return { orderItemId: 456, quantity: 1, reason: "sizeFit", note: null, ...overrides };
}

function returnedLine(overrides = {}) {
  return {
    id: 1,
    orderItemId: 456,
    productSnapshot: { title: "Jacket" },
    quantity: 1,
    reason: "sizeFit",
    note: null,
    unitPrice: "25.00",
    lineTotal: "25.00",
    createdAt: fixedNow,
    ...overrides,
  };
}

function returnRequest(overrides = {}) {
  return {
    id: 888,
    orderId: 123,
    status: "requested",
    refundStatus: "not_started",
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides,
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
  state.OrderItem.findAll.mockResolvedValue([]);
  state.OrderReturn.findAll.mockResolvedValue([]);
  state.OrderReturn.create.mockResolvedValue(returnRequest());
  state.OrderReturnItem.create.mockImplementation(async (values) => returnedLine(values));
});

describe("order cancellation service", () => {
  for (const status of ["placed", "confirmed"]) {
    it(`cancels an owned ${status} order and releases reserved stock`, async () => {
      const ownedOrder = order({ status });
      const inventory = {
        quantityReserved: 4,
        decrement: vi.fn(async (_field, { by }) => {
          inventory.quantityReserved -= by;
        }),
      };
      state.Order.findOne.mockResolvedValue(ownedOrder);
      state.OrderItem.findAll.mockResolvedValue([orderItem({ quantity: 2 })]);
      state.Inventory.findOne.mockResolvedValue(inventory);

      const result = await cancelOrder({
        accountId,
        orderId: 123,
        payload: { reason: "changedMind", note: null },
      });

      expect(result).toMatchObject({ status: "cancelled", reason: "changedMind", note: null });
      expect(ownedOrder.update).toHaveBeenCalledWith(expect.objectContaining({
        status: "cancelled",
        cancelReason: "changedMind",
        cancelNote: null,
      }), { transaction: state.transaction });
      expect(state.Inventory.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { variantId: 77 },
      }));
      expect(inventory.quantityReserved).toBe(2);
      expect(state.transaction.commit).toHaveBeenCalledOnce();
    });
  }

  for (const status of ["packed", "shipped"]) {
    it(`rejects a ${status} order with conflict`, async () => {
      state.Order.findOne.mockResolvedValue(order({ status }));

      await expect(cancelOrder({
        accountId,
        orderId: 123,
        payload: { reason: "changedMind", note: null },
      })).rejects.toMatchObject({ statusCode: 409 });
      expect(state.OrderItem.findAll).not.toHaveBeenCalled();
      expect(state.transaction.rollback).toHaveBeenCalledOnce();
    });
  }

  it("returns 404 when the order is not owned by the customer", async () => {
    state.Order.findOne.mockResolvedValue(null);

    await expect(cancelOrder({
      accountId,
      orderId: 123,
      payload: { reason: "changedMind", note: null },
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(state.Order.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 123, accountId },
    }));
  });

  it("does not release inventory twice when cancellation is retried", async () => {
    state.Order.findOne.mockResolvedValue(order({ status: "cancelled", cancelReason: "other" }));

    const result = await cancelOrder({
      accountId,
      orderId: 123,
      payload: { reason: "changedMind", note: null },
    });

    expect(result.status).toBe("cancelled");
    expect(state.OrderItem.findAll).not.toHaveBeenCalled();
    expect(state.transaction.commit).toHaveBeenCalledOnce();
  });
});

describe("item-level return request service", () => {
  it("creates a partial return within 14 days without issuing a refund", async () => {
    const ownedOrder = deliveredOrder();
    state.Order.findOne.mockResolvedValue(ownedOrder);
    state.OrderItem.findAll.mockResolvedValue([orderItem()]);
    state.OrderReturn.create.mockResolvedValue(returnRequest());
    state.OrderReturnItem.create.mockResolvedValue(returnedLine());

    const result = await createReturnRequest({
      accountId,
      orderId: 123,
      payload: validReturnPayload(),
      now: fixedNow,
    });

    expect(result).toMatchObject({
      status: "requested",
      refundStatus: "not_started",
      items: [{ orderItemId: "456", quantity: 1, reason: "sizeFit" }],
    });
    expect(state.OrderReturn.create).toHaveBeenCalledWith(expect.objectContaining({
      status: "requested",
      refundStatus: "not_started",
    }), { transaction: state.transaction });
    expect(state.OrderReturnItem.create).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 1,
      reason: "sizeFit",
    }), { transaction: state.transaction });
    expect(state.transaction.commit).toHaveBeenCalledOnce();
  });

  it("supports multiple selected order items in one return", async () => {
    state.Order.findOne.mockResolvedValue(deliveredOrder());
    state.OrderItem.findAll.mockResolvedValue([
      orderItem({ id: 456 }),
      orderItem({ id: 457, productVariantId: 78, quantity: 2 }),
    ]);
    state.OrderReturnItem.create
      .mockResolvedValueOnce(returnedLine({ orderItemId: 456 }))
      .mockResolvedValueOnce(returnedLine({ id: 2, orderItemId: 457, reason: "quality" }));

    const result = await createReturnRequest({
      accountId,
      orderId: 123,
      payload: validReturnPayload([
        returnItemPayload({ orderItemId: 456 }),
        returnItemPayload({ orderItemId: 457, quantity: 2, reason: "quality" }),
      ]),
      now: fixedNow,
    });

    expect(result.items).toHaveLength(2);
    expect(state.OrderReturnItem.create).toHaveBeenCalledTimes(2);
  });

  it("rejects an order that is not delivered", async () => {
    state.Order.findOne.mockResolvedValue(order({ status: "shipped" }));

    await expect(createReturnRequest({
      accountId,
      orderId: 123,
      payload: validReturnPayload(),
      now: fixedNow,
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it("rejects a delivery outside the 14-day window", async () => {
    state.Order.findOne.mockResolvedValue(deliveredOrder());

    await expect(createReturnRequest({
      accountId,
      orderId: 123,
      payload: validReturnPayload(),
      now: new Date("2026-10-25T12:00:00.000Z"),
    })).rejects.toMatchObject({ statusCode: 422 });
    expect(state.OrderReturn.create).not.toHaveBeenCalled();
  });

  it("rejects quantities greater than the quantity purchased", async () => {
    state.Order.findOne.mockResolvedValue(deliveredOrder());
    state.OrderItem.findAll.mockResolvedValue([orderItem({ quantity: 1 })]);

    await expect(createReturnRequest({
      accountId,
      orderId: 123,
      payload: validReturnPayload([returnItemPayload({ quantity: 2 })]),
      now: fixedNow,
    })).rejects.toMatchObject({ statusCode: 422 });
    expect(state.OrderReturn.create).not.toHaveBeenCalled();
  });

  it("rejects a return quantity that would exceed an earlier non-rejected request", async () => {
    state.Order.findOne.mockResolvedValue(deliveredOrder());
    state.OrderItem.findAll.mockResolvedValue([orderItem({ quantity: 2 })]);
    state.OrderReturn.findAll.mockResolvedValue([
      returnRequest({ items: [{ orderItemId: 456, quantity: 1 }] }),
    ]);

    await expect(createReturnRequest({
      accountId,
      orderId: 123,
      payload: validReturnPayload([returnItemPayload({ quantity: 2 })]),
      now: fixedNow,
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it("allows quantity again when the earlier request was rejected", async () => {
    state.Order.findOne.mockResolvedValue(deliveredOrder());
    state.OrderItem.findAll.mockResolvedValue([orderItem({ quantity: 1 })]);
    state.OrderReturn.findAll.mockResolvedValue([
      returnRequest({ status: "rejected", items: [{ orderItemId: 456, quantity: 1 }] }),
    ]);

    const result = await createReturnRequest({
      accountId,
      orderId: 123,
      payload: validReturnPayload(),
      now: fixedNow,
    });

    expect(result.status).toBe("requested");
  });

  it("returns 404 for an order owned by another customer", async () => {
    state.Order.findOne.mockResolvedValue(null);

    await expect(createReturnRequest({
      accountId,
      orderId: 123,
      payload: validReturnPayload(),
      now: fixedNow,
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(state.Order.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 123, accountId },
    }));
  });

  it("returns 404 when a selected line does not belong to the order", async () => {
    state.Order.findOne.mockResolvedValue(deliveredOrder());
    state.OrderItem.findAll.mockResolvedValue([orderItem({ id: 999 })]);

    await expect(createReturnRequest({
      accountId,
      orderId: 123,
      payload: validReturnPayload(),
      now: fixedNow,
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(state.transaction.rollback).toHaveBeenCalledOnce();
  });
});

describe("shopper return history and tracking service", () => {
  function returnWithDetails(overrides = {}) {
    return returnRequest({
      order: {
        id: 123,
        orderNumber: "RG-123",
        currencyCode: "EUR",
        deliveredAt: new Date("2026-10-10T12:00:00.000Z"),
      },
      items: [returnedLine()],
      ...overrides,
    });
  }

  it("lists only the authenticated shopper's return requests", async () => {
    state.OrderReturn.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [returnWithDetails()],
    });

    const result = await listReturnRequests({
      accountId,
      filters: { page: 1, limit: 20, status: ["requested"], orderId: undefined },
    });

    expect(result).toMatchObject({
      items: [{ id: "888", returnNumber: "RT-000888", orderNumber: "RG-123", itemCount: 1 }],
      pagination: { total: 1 },
    });
    expect(state.OrderReturn.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { accountId, status: { [Op.in]: ["requested"] } },
    }));
  });

  it("returns owned return detail and hides another shopper's return", async () => {
    state.OrderReturn.findOne.mockResolvedValueOnce(returnWithDetails()).mockResolvedValueOnce(null);

    const result = await getReturnRequest({ accountId, returnId: 888 });
    expect(result).toMatchObject({
      id: "888",
      status: "requested",
      actions: { canCancel: true },
      refund: { amount: 25, currency: "EUR" },
      items: [{ orderItemId: "456" }],
    });

    await expect(getReturnRequest({ accountId, returnId: 999 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("cancels only a requested return", async () => {
    const request = returnWithDetails();
    request.update = vi.fn(async function update(values) { Object.assign(this, values); });
    state.OrderReturn.findOne.mockResolvedValue(request);

    const result = await cancelReturnRequest({ accountId, returnId: 888 });

    expect(result).toMatchObject({ status: "cancelled", actions: { canCancel: false } });
    expect(request.update).toHaveBeenCalledWith({ status: "cancelled" }, { transaction: state.transaction });
    expect(state.transaction.commit).toHaveBeenCalledOnce();
  });

  it("returns an order-level timeline and a shipment when fulfillment exists", async () => {
    state.Order.findOne.mockResolvedValue(order({
      status: "shipped",
      createdAt: new Date("2026-10-10T12:00:00.000Z"),
      addressSnapshot: { fullName: "Ada Rossi", city: "Milano", postalCode: "20121", country: "IT" },
      items: [orderItem()],
      fulfillment: {
        id: 8,
        carrier: "BRT",
        trackingNumber: "BRT123",
        trackingUrl: "https://carrier.example/BRT123",
        shippedAt: new Date("2026-10-11T12:00:00.000Z"),
      },
    }));

    const result = await getOrderTracking({ accountId, orderId: 123 });

    expect(result).toMatchObject({
      orderId: "123",
      status: "shipped",
      shipments: [{ id: "8", trackingNumber: "BRT123", orderItemIds: ["456"] }],
    });
    expect(result.timeline).toHaveLength(6);
  });
});
