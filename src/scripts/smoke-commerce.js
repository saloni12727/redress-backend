import assert from "node:assert/strict";

import {
  connectDatabase,
  disconnectDatabase,
} from "../config/database.js";
import {
  Account,
  Address,
  Cart,
  CartItem,
  Color,
  Inventory,
  Order,
  OrderItem,
  Payment,
  Product,
  ProductVariant,
  Size,
} from "../models/index.js";
import {
  addCartItem,
  checkout,
  createAddress,
  getOrder,
  getQuote,
  listOrders,
} from "../modules/commerce/commerce.service.js";

const suffix = `${Date.now()}-${process.pid}`;
const email = `commerce-smoke-${suffix}@example.test`;
let accountId = null;
let reservedVariantId = null;
let reservedQuantity = 0;

async function availableVariant() {
  return ProductVariant.findOne({
    where: { isActive: true },
    include: [
      {
        model: Product,
        as: "product",
        required: true,
        where: {
          status: "published",
          approvalStatus: "approved",
          visibility: "public",
        },
      },
      { model: Color, as: "color", required: true, where: { isActive: true } },
      { model: Size, as: "size", required: true, where: { isActive: true } },
      { model: Inventory, as: "inventory", required: true },
    ],
    order: [["id", "ASC"]],
  });
}

async function cleanup() {
  if (!accountId) return;

  const orders = await Order.findAll({ where: { accountId }, attributes: ["id"] });
  const orderIds = orders.map((order) => order.id);

  if (orderIds.length) {
    await Payment.destroy({ where: { orderId: orderIds }, force: true });
    await OrderItem.destroy({ where: { orderId: orderIds }, force: true });
    await Order.destroy({ where: { id: orderIds }, force: true });
  }

  if (reservedVariantId && reservedQuantity > 0) {
    await Inventory.decrement("quantityReserved", {
      by: reservedQuantity,
      where: { variantId: reservedVariantId },
    });
  }

  const cart = await Cart.findOne({ where: { accountId } });
  if (cart) {
    await CartItem.destroy({ where: { cartId: cart.id }, force: true });
    await cart.destroy({ force: true });
  }

  await Address.destroy({ where: { accountId }, force: true });
  await Account.destroy({ where: { id: accountId }, force: true });
}

try {
  await connectDatabase();

  const variant = await availableVariant();
  assert(variant, "A published, stocked catalog variant is required for the commerce smoke test.");
  assert(Number(variant.inventory.quantityOnHand) > Number(variant.inventory.quantityReserved), "The selected catalog variant has no available inventory.");

  const account = await Account.create({
    email,
    firstName: "Commerce",
    lastName: "Smoke",
    displayName: "Commerce Smoke",
    emailVerifiedAt: new Date(),
  });
  accountId = account.id;

  const cart = await addCartItem({
    accountId,
    payload: {
      productId: variant.productId,
      colorId: variant.color.code,
      size: variant.size.code,
      qty: 1,
    },
  });
  assert.equal(cart.summary.count, 1);

  const address = await createAddress({
    accountId,
    payload: {
      label: "Smoke home",
      fullName: "Commerce Smoke",
      phone: "+393331234567",
      line1: "Via Roma 1",
      city: "Milano",
      postalCode: "20121",
      country: "IT",
    },
  });

  const quote = await getQuote({
    accountId,
    payload: { source: "cart", addressId: address.id, shippingMethod: "standard", paymentMode: "cod" },
  });
  assert.equal(quote.itemCount, 1);
  assert.equal(quote.paymentModes.find((item) => item.mode === "cod")?.available, true);

  const placed = await checkout({
    accountId,
    payload: { source: "cart", addressId: address.id, shippingMethod: "standard", paymentMode: "cod" },
  });
  assert.equal(placed.status, "placed");
  assert.equal(placed.payment.status, "unpaid");
  reservedVariantId = variant.id;
  reservedQuantity = 1;

  const orders = await listOrders({ accountId, filters: { page: 1, limit: 20 } });
  assert.equal(orders.pagination.total, 1);

  const order = await getOrder({ accountId, orderId: placed.orderId });
  assert.equal(order.orderNumber, placed.orderNumber);
  assert.equal(order.lines.length, 1);

  console.log(JSON.stringify({ status: "ok", cartItems: cart.summary.count, orderNumber: placed.orderNumber }, null, 2));
} finally {
  await cleanup();
  await disconnectDatabase();
}
