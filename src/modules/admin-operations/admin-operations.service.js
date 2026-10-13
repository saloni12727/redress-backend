import { Op } from "sequelize";

import {
  Account,
  Order,
  OrderFulfillment,
  OrderItem,
  OrderReturn,
  OrderReturnItem,
  Payment,
  Product,
  Vendor,
} from "../../models/index.js";
import { sequelize } from "../../config/database.js";

import { AdminOperationsError, adminOperationsNotFound } from "./admin-operations.error.js";

const ORDER_TRANSITIONS = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["outForDelivery"],
  outForDelivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

const plain = (value) => value?.get ? value.get({ plain: true }) : value;
const stringId = (value) => value === null || value === undefined ? null : String(value);
const money = (value) => Number(Number(value ?? 0).toFixed(2));
const date = (value) => value ? new Date(value).toISOString() : null;

function customerDto(account) {
  if (!account) return null;
  const value = plain(account);
  return {
    id: stringId(value.id),
    name: value.displayName || [value.firstName, value.lastName].filter(Boolean).join(" ") || null,
    email: value.email ?? null,
    phone: value.phone ?? null,
  };
}

function fulfillmentDto(fulfillment) {
  if (!fulfillment) return null;
  const value = plain(fulfillment);
  return {
    carrier: value.carrier,
    trackingNumber: value.trackingNumber,
    trackingUrl: value.trackingUrl ?? null,
    shippedAt: date(value.shippedAt),
  };
}

function orderDto(order, { detailed = false } = {}) {
  const value = plain(order);
  const result = {
    id: stringId(value.id),
    orderNumber: value.orderNumber,
    status: value.status,
    paymentMode: value.paymentMode,
    currency: value.currencyCode,
    subtotal: money(value.subtotal),
    discount: money(value.discount),
    shippingFee: money(value.shippingFee),
    codFee: money(value.codFee),
    total: money(value.total),
    createdAt: date(value.createdAt ?? value.created_at),
    customer: customerDto(value.account),
    payment: value.payment ? {
      id: stringId(value.payment.id),
      status: value.payment.status,
      mode: value.payment.mode,
      provider: value.payment.provider,
    } : null,
    tracking: fulfillmentDto(value.fulfillment),
  };

  if (detailed) {
    result.vatIncluded = money(value.vatIncluded);
    result.shippingMethod = value.shippingMethod;
    result.address = value.addressSnapshot;
    result.cancelledAt = date(value.cancelledAt);
    result.cancelReason = value.cancelReason ?? null;
    result.cancelNote = value.cancelNote ?? null;
    result.deliveredAt = date(value.deliveredAt);
    result.items = (value.items ?? []).map((item) => ({
      id: stringId(item.id),
      ...item.productSnapshot,
      quantity: Number(item.quantity),
      unitPrice: money(item.unitPrice),
      regularPrice: money(item.regularPrice),
      lineTotal: money(item.lineTotal),
    }));
  }

  return result;
}

function returnDto(returnRequest, { detailed = false } = {}) {
  const value = plain(returnRequest);
  const result = {
    id: stringId(value.id),
    orderId: stringId(value.orderId),
    status: value.status,
    refundStatus: value.refundStatus,
    refundMethod: value.refundMethod ?? null,
    refundProvider: value.refundProvider ?? null,
    providerRefundId: value.providerRefundId ?? null,
    requestedAt: date(value.createdAt ?? value.created_at),
    updatedAt: date(value.updatedAt ?? value.updated_at),
    customer: customerDto(value.account),
    order: value.order ? {
      id: stringId(value.order.id),
      orderNumber: value.order.orderNumber,
      status: value.order.status,
      total: money(value.order.total),
      currency: value.order.currencyCode,
    } : null,
  };

  if (detailed) {
    result.items = (value.items ?? []).map((item) => ({
      id: stringId(item.id),
      orderItemId: stringId(item.orderItemId),
      product: item.productSnapshot,
      quantity: Number(item.quantity),
      reason: item.reason,
      note: item.note ?? null,
      unitPrice: money(item.unitPrice),
      lineTotal: money(item.lineTotal),
    }));
  }

  return result;
}

const orderIncludes = (detailed = false) => [
  { model: Account, as: "account", required: false },
  { model: Payment, as: "payment", required: false },
  { model: OrderFulfillment, as: "fulfillment", required: false },
  ...(detailed ? [{ model: OrderItem, as: "items", required: false }] : []),
];

const returnIncludes = (detailed = false) => [
  { model: Account, as: "account", required: false },
  { model: Order, as: "order", required: true },
  ...(detailed ? [{ model: OrderReturnItem, as: "items", required: false }] : []),
];

async function adminOrder(orderId, { transaction = null, lock = false, detailed = true } = {}) {
  const order = await Order.findByPk(orderId, {
    transaction,
    lock: lock ? transaction.LOCK.UPDATE : undefined,
    include: orderIncludes(detailed),
  });
  if (!order) throw adminOperationsNotFound("The requested order could not be found.");
  return order;
}

async function adminReturn(returnId, { transaction = null, lock = false, detailed = true } = {}) {
  const returnRequest = await OrderReturn.findByPk(returnId, {
    transaction,
    lock: lock ? transaction.LOCK.UPDATE : undefined,
    include: returnIncludes(detailed),
  });
  if (!returnRequest) throw adminOperationsNotFound("The requested return request could not be found.");
  return returnRequest;
}

export async function listAdminOrders(filters) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.q) where.orderNumber = { [Op.like]: `%${filters.q}%` };

  const paymentInclude = { model: Payment, as: "payment", required: Boolean(filters.paymentStatus) };
  if (filters.paymentStatus) paymentInclude.where = { status: filters.paymentStatus };

  const { count, rows } = await Order.findAndCountAll({
    where,
    distinct: true,
    col: "id",
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
    order: [["created_at", "DESC"]],
    include: [
      { model: Account, as: "account", required: false },
      paymentInclude,
      { model: OrderFulfillment, as: "fulfillment", required: false },
    ],
  });

  return {
    items: rows.map((order) => orderDto(order)),
    pagination: { page: filters.page, limit: filters.limit, total: count, totalPages: count ? Math.ceil(count / filters.limit) : 0 },
  };
}

export async function getAdminOrder(orderId) {
  return orderDto(await adminOrder(orderId), { detailed: true });
}

export async function updateAdminOrderStatus({ orderId, status }) {
  const transaction = await sequelize.transaction();
  try {
    const order = await adminOrder(orderId, { transaction, lock: true, detailed: false });
    if (!ORDER_TRANSITIONS[order.status].includes(status)) {
      throw new AdminOperationsError(`An order in ${order.status} status cannot be changed to ${status}.`, { statusCode: 409 });
    }
    await order.update({
      status,
      ...(status === "delivered" ? { deliveredAt: new Date() } : {}),
      ...(status === "cancelled" ? { cancelledAt: new Date(), cancelReason: "admin_cancelled" } : {}),
    }, { transaction });
    await transaction.commit();
    return getAdminOrder(orderId);
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

export async function updateAdminOrderTracking({ orderId, payload }) {
  const transaction = await sequelize.transaction();
  try {
    const order = await adminOrder(orderId, { transaction, lock: true, detailed: false });
    if (!["shipped", "outForDelivery", "delivered"].includes(order.status)) {
      throw new AdminOperationsError("Tracking can only be added after the order has shipped.", { statusCode: 409 });
    }
    const [fulfillment] = await OrderFulfillment.findOrCreate({
      where: { orderId: order.id },
      defaults: { orderId: order.id, ...payload, shippedAt: new Date() },
      transaction,
    });
    if (!fulfillment.isNewRecord) {
      await fulfillment.update(payload, { transaction });
    }
    await transaction.commit();
    return getAdminOrder(orderId);
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

export async function listAdminReturns(filters) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.refundStatus) where.refundStatus = filters.refundStatus;

  const { count, rows } = await OrderReturn.findAndCountAll({
    where,
    distinct: true,
    col: "id",
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
    order: [["created_at", "DESC"]],
    include: returnIncludes(false),
  });
  return {
    items: rows.map((item) => returnDto(item)),
    pagination: { page: filters.page, limit: filters.limit, total: count, totalPages: count ? Math.ceil(count / filters.limit) : 0 },
  };
}

export async function getAdminReturn(returnId) {
  return returnDto(await adminReturn(returnId), { detailed: true });
}

async function transitionReturn(returnId, acceptedStatuses, values) {
  const transaction = await sequelize.transaction();
  try {
    const returnRequest = await adminReturn(returnId, { transaction, lock: true, detailed: false });
    if (!acceptedStatuses.includes(returnRequest.status)) {
      throw new AdminOperationsError("This return request cannot be updated from its current status.", { statusCode: 409 });
    }
    await returnRequest.update(values, { transaction });
    await transaction.commit();
    return getAdminReturn(returnId);
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

export const approveAdminReturn = (returnId) => transitionReturn(returnId, ["requested"], { status: "approved" });
export const rejectAdminReturn = (returnId) => transitionReturn(returnId, ["requested", "approved"], { status: "rejected" });
export const receiveAdminReturn = (returnId) => transitionReturn(returnId, ["approved", "inTransit"], { status: "refundPending", refundStatus: "pending" });

export async function recordAdminReturnRefund({ returnId, payload }) {
  const transaction = await sequelize.transaction();
  try {
    const returnRequest = await adminReturn(returnId, { transaction, lock: true, detailed: false });
    if (returnRequest.status !== "refundPending" || returnRequest.refundStatus !== "pending") {
      throw new AdminOperationsError("Only a received return with a pending refund can be refunded.", { statusCode: 409 });
    }
    await returnRequest.update({
      status: "refunded",
      refundStatus: payload.refundMethod === "manual" ? "manual" : "refunded",
      refundMethod: payload.refundMethod,
      refundProvider: payload.refundProvider ?? null,
      providerRefundId: payload.providerRefundId ?? null,
    }, { transaction });
    await transaction.commit();
    return getAdminReturn(returnId);
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

export async function getAdminDashboardOverview() {
  const [pendingFulfillment, shipped, pendingReturns, pendingVendors, pendingProducts, totalOrders, revenue] = await Promise.all([
    Order.count({ where: { status: { [Op.in]: ["placed", "confirmed", "packed"] } } }),
    Order.count({ where: { status: { [Op.in]: ["shipped", "outForDelivery"] } } }),
    OrderReturn.count({ where: { status: "requested" } }),
    Vendor.count({ where: { approvalStatus: "pending" } }),
    Product.count({ where: { approvalStatus: "pending" } }),
    Order.count(),
    Order.sum("total", { where: { status: { [Op.ne]: "cancelled" } } }),
  ]);
  return {
    orders: { total: totalOrders, pendingFulfillment, inTransit: shipped },
    returns: { pendingReview: pendingReturns },
    vendors: { pendingApproval: pendingVendors },
    products: { pendingReview: pendingProducts },
    revenue: { total: money(revenue), currency: "EUR" },
  };
}
