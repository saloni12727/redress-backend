import { ForeignKeyConstraintError, Op } from "sequelize";

import { sequelize } from "../../config/database.js";

import { getMediaUrl } from "../../services/media/media-storage.service.js";

import {
  Address,
  Cart,
  CartItem,
  Color,
  Inventory,
  Order,
  OrderFulfillment,
  OrderItem,
  OrderReturn,
  OrderReturnItem,
  Payment,
  Product,
  ProductMedia,
  ProductVariant,
  Size,
} from "../../models/index.js";

import { CommerceError, commerceNotFound } from "./commerce.error.js";

const MAX_ITEM_QUANTITY = 10;

const SHIPPING = {
  standard: 590,
  express: 990,
};

const COD_FEE = 300;

const FREE_STANDARD_SHIPPING_AT = 10000;

const RETURN_WINDOW_DAYS = 14;

function cents(value) {
  return Math.round(Number(value) * 100);
}

function euros(value) {
  return Number((value / 100).toFixed(2));
}

function currentPrice(variant, now = new Date()) {
  const saleActive =
    variant.salePrice !== null &&
    variant.salePrice !== undefined &&
    (!variant.saleStartAt || new Date(variant.saleStartAt) <= now) &&
    (!variant.saleEndAt || new Date(variant.saleEndAt) >= now);

  return cents(
    saleActive
      ? Math.min(
          Number(variant.salePrice),

          Number(variant.regularPrice),
        )
      : variant.regularPrice,
  );
}

function availableQuantity(inventory) {
  if (!inventory) {
    return 0;
  }

  if (inventory.allowBackorder) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.max(
    0,

    Number(inventory.quantityOnHand) - Number(inventory.quantityReserved),
  );
}

function isPublicProduct(product) {
  return (
    product &&
    product.status === "published" &&
    product.approvalStatus === "approved" &&
    product.visibility === "public" &&
    product.publishedAt
  );
}

async function primaryImage(productId, transaction = null) {
  const media = await ProductMedia.findOne({
    where: {
      productId,

      mediaType: "image",

      moderationStatus: "approved",
    },

    order: [
      ["isPrimary", "DESC"],

      ["sortOrder", "ASC"],

      ["id", "ASC"],
    ],

    transaction,
  });

  return media?.storageKey ? getMediaUrl(media.storageKey) : null;
}

async function resolveVariant({
  productId,
  colorId,
  size,
  transaction = null,
  lock = false,
}) {
  const variant = await ProductVariant.findOne({
    where: {
      productId,
      isActive: true,
    },

    transaction,

    ...(lock
      ? {
          lock: transaction.LOCK.UPDATE,
        }
      : {}),

    include: [
      {
        model: Product,

        as: "product",

        required: true,
      },

      {
        model: Color,

        as: "color",

        required: true,

        where: {
          code: colorId,
          isActive: true,
        },
      },

      {
        model: Size,

        as: "size",

        required: true,

        where: {
          code: size,
          isActive: true,
        },
      },

      {
        model: Inventory,

        as: "inventory",

        required: false,
      },
    ],
  });

  if (!variant || !isPublicProduct(variant.product)) {
    throw new CommerceError(
      "The selected product variant is no longer available.",
    );
  }

  return variant;
}

/*
|--------------------------------------------------------------------------
| Cart-item availability
|--------------------------------------------------------------------------
|
| Guest cart lines can outlive a product publication or inventory change.
| Validate them again while holding the variant row lock before moving them
| into an authenticated cart.
|
*/

export async function lockAndValidateCartVariant({
  productVariantId,
  quantity,
  transaction,
}) {
  const variant = await ProductVariant.findOne({
    where: {
      id: productVariantId,

      isActive: true,
    },

    transaction,

    lock: transaction.LOCK.UPDATE,

    include: [
      {
        model: Product,

        as: "product",

        required: true,
      },

      {
        model: Inventory,

        as: "inventory",

        required: false,
      },
    ],
  });

  if (!variant || !isPublicProduct(variant.product)) {
    throw new CommerceError(
      "One or more shopping bag items are no longer available.",
    );
  }

  if (
    Number(quantity) > MAX_ITEM_QUANTITY ||
    Number(quantity) > availableQuantity(variant.inventory)
  ) {
    throw new CommerceError(
      "One or more shopping bag items are not available in the requested quantity.",
    );
  }

  return variant;
}

/*
|--------------------------------------------------------------------------
| Cart Ownership
|--------------------------------------------------------------------------
|
| Cart belongs to exactly one:
|
| - logged-in account
| OR
| - anonymous guest session
|
*/

function cartOwnerWhere({ accountId = null, guestSessionId = null }) {
  const hasAccount = accountId !== null && accountId !== undefined;

  const hasGuest = guestSessionId !== null && guestSessionId !== undefined;

  if (hasAccount === hasGuest) {
    throw new CommerceError("A shopping bag must have exactly one owner.");
  }

  return hasAccount
    ? {
        accountId,
      }
    : {
        guestSessionUuid: guestSessionId,
      };
}

async function lockCartOwner({ accountId, guestSessionId }, transaction) {
  if (!transaction) {
    return;
  }

  if (accountId !== null && accountId !== undefined) {
    const [rows] = await sequelize.query(
      `
        SELECT id
        FROM accounts
        WHERE id = :accountId
        LIMIT 1
        FOR UPDATE
      `,
      {
        replacements: { accountId },
        transaction,
      },
    );

    if (!rows[0]) {
      throw new CommerceError("The authenticated account could not be found.", {
        statusCode: 401,
      });
    }

    return;
  }

  const [rows] = await sequelize.query(
    `
      SELECT session_uuid
      FROM guest_sessions
      WHERE session_uuid = :guestSessionId
      LIMIT 1
      FOR UPDATE
    `,
    {
      replacements: { guestSessionId },
      transaction,
    },
  );

  if (!rows[0]) {
    throw new CommerceError("The guest session is invalid or has expired.", {
      statusCode: 401,
    });
  }
}

async function cartFor(
  { accountId = null, guestSessionId = null },

  transaction = null,

  lock = false,
) {
  const where = cartOwnerWhere({
    accountId,
    guestSessionId,
  });

  /*
   * A cart may not exist yet. Lock the stable owner record first so two
   * simultaneous first cart writes cannot race the unique owner constraint.
   */
  await lockCartOwner(
    {
      accountId,
      guestSessionId,
    },
    transaction,
  );

  let cart = await Cart.findOne({
    where,

    transaction,

    ...(lock
      ? {
          lock: transaction.LOCK.UPDATE,
        }
      : {}),
  });

  if (!cart) {
    cart = await Cart.create(
      {
        accountId: accountId ?? null,

        guestSessionUuid: guestSessionId ?? null,
      },

      {
        transaction,
      },
    );
  }

  return cart;
}

async function cartRows(cartId, transaction = null) {
  return CartItem.findAll({
    where: {
      cartId,
    },

    order: [
      ["created_at", "ASC"],

      ["id", "ASC"],
    ],

    transaction,

    include: [
      {
        model: ProductVariant,

        as: "variant",

        required: true,

        include: [
          {
            model: Product,

            as: "product",

            required: true,
          },

          {
            model: Color,

            as: "color",

            required: false,
          },

          {
            model: Size,

            as: "size",

            required: false,
          },

          {
            model: Inventory,

            as: "inventory",

            required: false,
          },
        ],
      },
    ],
  });
}

async function cartItemDto(item, transaction = null) {
  const variant = item.variant;

  const price = currentPrice(variant);

  return {
    id: String(item.id),

    productId: String(variant.productId),

    slug: variant.product.slug,

    variantId: String(variant.id),

    brand: null,

    title: variant.product.code,

    colorId: variant.color?.code ?? null,

    size: variant.size?.code ?? null,

    qty: Number(item.quantity),

    unitPrice: euros(price),

    mrp: euros(cents(variant.regularPrice)),

    imageUrl: await primaryImage(variant.productId, transaction),

    inStock: availableQuantity(variant.inventory) >= Number(item.quantity),

    maxQty: Math.min(
      MAX_ITEM_QUANTITY,

      availableQuantity(variant.inventory),
    ),
  };
}

async function cartDto(cart, transaction = null) {
  const rows = await cartRows(cart.id, transaction);

  const items = await Promise.all(
    rows.map((row) => cartItemDto(row, transaction)),
  );

  const subtotal = items.reduce(
    (total, item) => total + Math.round(item.unitPrice * 100) * item.qty,

    0,
  );

  return {
    items,

    summary: {
      count: items.reduce(
        (total, item) => total + item.qty,

        0,
      ),

      subtotal: euros(subtotal),

      currency: cart.currencyCode,
    },
  };
}

/*
|--------------------------------------------------------------------------
| Checkout Quote
|--------------------------------------------------------------------------
|
| Checkout remains account-only.
|
*/

async function quoteFor({ accountId, payload, transaction = null }) {
  const cart = await cartFor(
    {
      accountId,
    },

    transaction,
  );

  const rows = await cartRows(cart.id, transaction);

  if (!rows.length) {
    throw new CommerceError("Your shopping bag is empty.");
  }

  const address = payload.addressId
    ? await Address.findOne({
        where: {
          id: payload.addressId,

          accountId,
        },

        transaction,
      })
    : null;

  if (payload.addressId && !address) {
    throw commerceNotFound("The selected delivery address could not be found.");
  }

  const items = await Promise.all(
    rows.map((row) => cartItemDto(row, transaction)),
  );

  for (const item of items) {
    if (!item.inStock || item.qty > item.maxQty) {
      throw new CommerceError(
        "One or more bag items are no longer available in the requested quantity.",
      );
    }
  }

  const subtotal = items.reduce(
    (total, item) => total + Math.round(item.unitPrice * 100) * item.qty,

    0,
  );

  const listTotal = items.reduce(
    (total, item) => total + Math.round(item.mrp * 100) * item.qty,

    0,
  );

  const shippingFee =
    payload.shippingMethod === "standard" &&
    subtotal >= FREE_STANDARD_SHIPPING_AT
      ? 0
      : SHIPPING[payload.shippingMethod];

  const codFee = payload.paymentMode === "cod" ? COD_FEE : 0;

  const total = subtotal + shippingFee + codFee;

  return {
    cart,
    rows,
    address,

    quote: {
      currency: "EUR",

      source: "cart",

      itemCount: items.reduce(
        (totalCount, item) => totalCount + item.qty,

        0,
      ),

      items,

      subtotal: euros(subtotal),

      listTotal: euros(listTotal),

      discount: 0,

      shippingMethod: payload.shippingMethod,

      shippingFee: euros(shippingFee),

      freeShipping: shippingFee === 0,

      freeShippingRemaining: euros(
        Math.max(
          0,

          FREE_STANDARD_SHIPPING_AT - subtotal,
        ),
      ),

      codFee: euros(codFee),

      total: euros(total),

      vatIncluded: euros(Math.round((total * 22) / 122)),

      paymentModes: [
        {
          mode: "cod",
          available: true,
        },

        {
          mode: "card",
          available: false,
        },
      ],
    },
  };
}

/*
|--------------------------------------------------------------------------
| Cart CRUD
|--------------------------------------------------------------------------
*/

export async function getCart({ accountId = null, guestSessionId = null }) {
  const cart = await Cart.findOne({
    where: cartOwnerWhere({
      accountId,
      guestSessionId,
    }),
  });

  if (!cart) {
    return {
      items: [],

      summary: {
        count: 0,

        subtotal: 0,

        currency: "EUR",
      },
    };
  }

  return cartDto(cart);
}

export async function addCartItem({
  accountId = null,
  guestSessionId = null,
  payload,
}) {
  const transaction = await sequelize.transaction();

  try {
    const cart = await cartFor(
      {
        accountId,
        guestSessionId,
      },

      transaction,

      true,
    );

    const variant = await resolveVariant({
      ...payload,

      transaction,

      lock: true,
    });

    const existing = await CartItem.findOne({
      where: {
        cartId: cart.id,

        productVariantId: variant.id,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    const quantity = (existing ? Number(existing.quantity) : 0) + payload.qty;

    if (
      quantity > MAX_ITEM_QUANTITY ||
      quantity > availableQuantity(variant.inventory)
    ) {
      throw new CommerceError("The requested quantity is not available.");
    }

    if (existing) {
      await existing.update(
        {
          quantity,
        },

        {
          transaction,
        },
      );
    } else {
      await CartItem.create(
        {
          cartId: cart.id,

          productVariantId: variant.id,

          quantity: payload.qty,
        },

        {
          transaction,
        },
      );
    }

    const data = await cartDto(cart, transaction);

    await transaction.commit();

    return data;
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}

export async function updateCartItem({
  accountId = null,
  guestSessionId = null,
  itemId,
  payload,
}) {
  const transaction = await sequelize.transaction();

  try {
    const cart = await cartFor(
      {
        accountId,
        guestSessionId,
      },

      transaction,

      true,
    );

    const item = await CartItem.findOne({
      where: {
        id: itemId,

        cartId: cart.id,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!item) {
      throw commerceNotFound("The requested bag item could not be found.");
    }

    if (payload.qty === 0) {
      await item.destroy({
        transaction,
      });
    } else {
      const variant = await ProductVariant.findByPk(item.productVariantId, {
        transaction,

        lock: transaction.LOCK.UPDATE,

        include: [
          {
            model: Inventory,

            as: "inventory",

            required: false,
          },
        ],
      });

      if (
        !variant ||
        payload.qty > MAX_ITEM_QUANTITY ||
        payload.qty > availableQuantity(variant.inventory)
      ) {
        throw new CommerceError("The requested quantity is not available.");
      }

      await item.update(
        {
          quantity: payload.qty,
        },

        {
          transaction,
        },
      );
    }

    const data = await cartDto(cart, transaction);

    await transaction.commit();

    return data;
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}

export async function removeCartItem({
  accountId = null,
  guestSessionId = null,
  itemId,
}) {
  const cart = await cartFor({
    accountId,
    guestSessionId,
  });

  const item = await CartItem.findOne({
    where: {
      id: itemId,
      cartId: cart.id,
    },
  });

  if (!item) {
    throw commerceNotFound("The requested bag item could not be found.");
  }

  await item.destroy();

  return cartDto(cart);
}

/*
|--------------------------------------------------------------------------
| Addresses
|--------------------------------------------------------------------------
*/

function addressDto(address) {
  const value = address.get
    ? address.get({
        plain: true,
      })
    : address;

  return {
    id: String(value.id),

    label: value.label,

    fullName: value.fullName,

    phone: value.phone,

    line1: value.line1,

    line2: value.line2 ?? "",

    city: value.city,

    state: value.state ?? "",

    postalCode: value.postalCode,

    country: value.country,

    isDefault: Boolean(value.isDefault),
  };
}

async function ensureDefaultAddress(accountId, addressId, transaction) {
  await Address.update(
    {
      isDefault: false,
    },

    {
      where: {
        accountId,

        id: {
          [Op.ne]: addressId,
        },
      },

      transaction,
    },
  );

  await Address.update(
    {
      isDefault: true,
    },

    {
      where: {
        accountId,
        id: addressId,
      },

      transaction,
    },
  );
}

export async function listAddresses({ accountId }) {
  const addresses = await Address.findAll({
    where: {
      accountId,
    },

    order: [
      ["is_default", "DESC"],

      ["updated_at", "DESC"],
    ],
  });

  return addresses.map(addressDto);
}

export async function createAddress({ accountId, payload }) {
  const transaction = await sequelize.transaction();

  try {
    const count = await Address.count({
      where: {
        accountId,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    const address = await Address.create(
      {
        ...payload,

        accountId,

        isDefault: count === 0 || payload.isDefault === true,
      },

      {
        transaction,
      },
    );

    if (address.isDefault) {
      await ensureDefaultAddress(accountId, address.id, transaction);
    }

    await transaction.commit();

    return addressDto(address);
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}

export async function updateAddress({ accountId, addressId, payload }) {
  const transaction = await sequelize.transaction();

  try {
    const address = await Address.findOne({
      where: {
        id: addressId,

        accountId,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!address) {
      throw commerceNotFound("The requested address could not be found.");
    }

    await address.update(
      payload,

      {
        transaction,
      },
    );

    if (payload.isDefault === true) {
      await ensureDefaultAddress(accountId, address.id, transaction);
    }

    await transaction.commit();

    return addressDto(address);
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}

export async function removeAddress({ accountId, addressId }) {
  const transaction = await sequelize.transaction();

  try {
    const address = await Address.findOne({
      where: {
        id: addressId,

        accountId,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!address) {
      throw commerceNotFound("The requested address could not be found.");
    }

    const wasDefault =
      address.isDefault === true || Number(address.isDefault) === 1;

    const deletedCount = await Address.destroy({
      where: {
        id: addressId,

        accountId,
      },

      transaction,
    });

    if (deletedCount !== 1) {
      throw commerceNotFound("The requested address could not be found.");
    }

    if (wasDefault) {
      const replacement = await Address.findOne({
        where: {
          accountId,
        },

        order: [
          ["updated_at", "DESC"],

          ["id", "DESC"],
        ],

        transaction,

        lock: transaction.LOCK.UPDATE,
      });

      if (replacement) {
        await Address.update(
          {
            isDefault: true,
          },

          {
            where: {
              id: replacement.id,

              accountId,
            },

            transaction,
          },
        );
      }
    }

    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    const databaseCode = error?.parent?.code ?? error?.original?.code;

    if (
      error instanceof ForeignKeyConstraintError ||
      databaseCode === "ER_ROW_IS_REFERENCED" ||
      databaseCode === "ER_ROW_IS_REFERENCED_2"
    ) {
      throw new CommerceError(
        "This address is retained by an existing order and cannot be deleted.",
        { statusCode: 409 },
      );
    }

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Orders
|--------------------------------------------------------------------------
*/

function orderNumber() {
  return (
    `RG-${Date.now()}-` + Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

function orderDto(order, { detailed = false, returnableByItem = new Map() } = {}) {
  const value = order.get
    ? order.get({
        plain: true,
      })
    : order;

  const result = {
    id: String(value.id),

    orderNumber: value.orderNumber,

    status: value.status,

    paymentMode: value.paymentMode,

    currency: value.currencyCode,

    itemCount: value.items?.length ?? undefined,

    subtotal: euros(cents(value.subtotal)),

    discount: euros(cents(value.discount)),

    shippingFee: euros(cents(value.shippingFee)),

    codFee: euros(cents(value.codFee)),

    total: euros(cents(value.total)),

    vatIncluded: euros(cents(value.vatIncluded)),

    createdAt: new Date(value.createdAt ?? value.created_at).toISOString(),
  };

  if (detailed) {
    result.lines = (value.items ?? []).map((line) => ({
      orderItemId: String(line.id),

      ...line.productSnapshot,

      qty: Number(line.quantity),

      returnableQty: Math.max(
        0,
        Number(line.quantity) - (returnableByItem.get(String(line.id)) ?? 0),
      ),

      unitPrice: euros(cents(line.unitPrice)),

      lineTotal: euros(cents(line.lineTotal)),
    }));

    result.address = value.addressSnapshot;

    result.shippingMethod = value.shippingMethod;

    result.payment = value.payment
      ? {
          id: String(value.payment.id),

          status: value.payment.status,

          mode: value.payment.mode,
        }
      : null;

    result.actions = {
      canCancel: ["placed", "confirmed"].includes(value.status),

      canTrack: ["shipped", "outForDelivery", "delivered"].includes(
        value.status,
      ),

      canReturn:
        value.status === "delivered" &&
        returnDeadline(value) !== null &&
        new Date() < new Date(returnDeadline(value)) &&
        result.lines.some((line) => line.returnableQty > 0),
    };

    result.returnDeadlineAt = returnDeadline(value);
  }

  return result;
}

export async function getQuote({ accountId, payload }) {
  const result = await quoteFor({
    accountId,
    payload,
  });

  return result.quote;
}

export async function checkout({ accountId, payload }) {
  if (payload.paymentMode === "card") {
    throw new CommerceError(
      "Card payments are not available yet. Please choose cash on delivery.",
      {
        statusCode: 503,
      },
    );
  }

  const transaction = await sequelize.transaction();

  try {
    const { cart, rows, address, quote } = await quoteFor({
      accountId,
      payload,
      transaction,
    });

    if (!address) {
      throw new CommerceError("A delivery address is required.");
    }

    const locked = [];

    for (const row of rows) {
      const variant = await ProductVariant.findByPk(row.productVariantId, {
        transaction,

        lock: transaction.LOCK.UPDATE,

        include: [
          {
            model: Inventory,

            as: "inventory",

            required: false,
          },

          {
            model: Product,

            as: "product",

            required: true,
          },

          {
            model: Color,

            as: "color",

            required: false,
          },

          {
            model: Size,

            as: "size",

            required: false,
          },
        ],
      });

      if (
        !variant ||
        !isPublicProduct(variant.product) ||
        Number(row.quantity) > availableQuantity(variant.inventory)
      ) {
        throw new CommerceError(
          "One or more bag items are no longer available in the requested quantity.",
        );
      }

      locked.push({
        row,
        variant,
      });
    }

    const order = await Order.create(
      {
        accountId,

        orderNumber: orderNumber(),

        paymentMode: "cod",

        subtotal: quote.subtotal,

        discount: quote.discount,

        shippingFee: quote.shippingFee,

        codFee: quote.codFee,

        total: quote.total,

        vatIncluded: quote.vatIncluded,

        shippingMethod: payload.shippingMethod,

        addressSnapshot: addressDto(address),
      },

      {
        transaction,
      },
    );

    for (const { row, variant } of locked) {
      const unitPrice = currentPrice(variant);

      const imageUrl = await primaryImage(variant.productId, transaction);

      await OrderItem.create(
        {
          orderId: order.id,

          productId: variant.productId,

          productVariantId: variant.id,

          productSnapshot: {
            productId: String(variant.productId),

            slug: variant.product.slug,

            title: variant.product.code,

            colorId: variant.color?.code ?? null,

            size: variant.size?.code ?? null,

            imageUrl,
          },

          quantity: row.quantity,

          unitPrice: euros(unitPrice),

          regularPrice: euros(cents(variant.regularPrice)),

          lineTotal: euros(unitPrice * Number(row.quantity)),
        },

        {
          transaction,
        },
      );

      await variant.inventory.increment("quantityReserved", {
        by: Number(row.quantity),

        transaction,
      });
    }

    const payment = await Payment.create(
      {
        orderId: order.id,

        mode: "cod",

        provider: "cash_on_delivery",

        status: "unpaid",
      },

      {
        transaction,
      },
    );

    await CartItem.destroy({
      where: {
        cartId: cart.id,
      },

      transaction,
    });

    await transaction.commit();

    return {
      orderId: String(order.id),

      orderNumber: order.orderNumber,

      status: order.status,

      paymentMode: order.paymentMode,

      total: Number(order.total),

      currency: order.currencyCode,

      payment: {
        id: String(payment.id),

        status: payment.status,

        mode: payment.mode,

        provider: payment.provider,
      },
    };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}

export async function listOrders({ accountId, filters }) {
  const { count, rows } = await Order.findAndCountAll({
    where: {
      accountId,
    },

    distinct: true,

    col: "id",

    limit: filters.limit,

    offset: (filters.page - 1) * filters.limit,

    order: [["created_at", "DESC"]],

    include: [
      {
        model: OrderItem,

        as: "items",

        required: false,
      },
    ],
  });

  return {
    items: rows.map((order) => orderDto(order)),

    pagination: {
      page: filters.page,

      limit: filters.limit,

      total: count,

      totalPages: count ? Math.ceil(count / filters.limit) : 0,
    },
  };
}

export async function getOrder({ accountId, orderId }) {
  const order = await Order.findOne({
    where: {
      id: orderId,

      accountId,
    },

    include: [
      {
        model: OrderItem,

        as: "items",
      },

      {
        model: Payment,

        as: "payment",
      },
      {
        model: OrderReturn,

        as: "returns",

        required: false,

        include: [{ model: OrderReturnItem, as: "items", required: false }],
      },
    ],
  });

  if (!order) {
    throw commerceNotFound("The requested order could not be found.");
  }

  return orderDto(order, {
    detailed: true,
    returnableByItem: returnedQuantities(order),
  });
}

function plain(value) {
  return value?.get
    ? value.get({
        plain: true,
      })
    : value;
}

function returnItemDto(item) {
  const value = plain(item);

  return {
    orderItemId: String(value.orderItemId),

    product: value.productSnapshot,

    quantity: Number(value.quantity),

    reason: value.reason,

    note: value.note ?? null,

    unitPrice: euros(cents(value.unitPrice)),

    lineTotal: euros(cents(value.lineTotal)),
  };
}

function isoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function returnDeadline(order) {
  const deliveredAt = order?.deliveredAt;
  if (!deliveredAt) return null;
  const delivered = new Date(deliveredAt);
  if (Number.isNaN(delivered.getTime())) return null;
  delivered.setUTCDate(delivered.getUTCDate() + RETURN_WINDOW_DAYS);
  return delivered.toISOString();
}

function returnedQuantities(order) {
  const result = new Map();
  const value = plain(order);
  for (const request of value.returns ?? []) {
    if (["rejected", "cancelled"].includes(request.status)) continue;
    for (const item of request.items ?? []) {
      const key = String(item.orderItemId);
      result.set(key, (result.get(key) ?? 0) + Number(item.quantity));
    }
  }
  return result;
}

function returnNumber(value) {
  return `RT-${String(value.id).padStart(6, "0")}`;
}

function returnStatusLabel(status) {
  return {
    requested: "Requested",
    approved: "Approved",
    inTransit: "In transit",
    received: "Received",
    refundPending: "Refund pending",
    refunded: "Refunded",
    rejected: "Rejected",
    cancelled: "Cancelled",
  }[status] ?? status;
}

function returnTimeline(value) {
  if (value.status === "rejected" || value.status === "cancelled") {
    return [
      { status: "requested", label: "Requested", description: null, at: isoDate(value.createdAt ?? value.created_at), done: true },
      { status: value.status, label: returnStatusLabel(value.status), description: null, at: isoDate(value.updatedAt ?? value.updated_at), done: true },
    ];
  }

  const statuses = ["requested", "approved", "inTransit", "refundPending", "refunded"];
  const currentIndex = Math.max(0, statuses.indexOf(value.status));
  return statuses.map((status, index) => ({
    status,
    label: returnStatusLabel(status),
    description: null,
    at: index === 0 ? isoDate(value.createdAt ?? value.created_at) : index === currentIndex ? isoDate(value.updatedAt ?? value.updated_at) : null,
    done: index <= currentIndex,
  }));
}

function returnRequestDto(returnRequest, items = null, { detailed = false } = {}) {
  const value = plain(returnRequest);
  const returnItems = items ?? value.items ?? [];
  const refundAmount = returnItems.reduce((sum, item) => sum + euros(cents(item.lineTotal)), 0);

  const result = {
    id: String(value.id),

    returnNumber: returnNumber(value),

    orderId: String(value.orderId),

    orderNumber: value.order?.orderNumber ?? null,

    status: value.status,

    statusLabel: returnStatusLabel(value.status),

    refundStatus: value.refundStatus,

    refundAmount,

    currency: value.order?.currencyCode ?? "EUR",

    itemCount: returnItems.length,

    previewImageUrl: returnItems[0]?.productSnapshot?.imageUrl ?? null,

    requestedAt: isoDate(value.createdAt ?? value.created_at),

    updatedAt: isoDate(value.updatedAt ?? value.updated_at),
  };

  if (!detailed) return result;

  return {
    ...result,
    returnDeadlineAt: returnDeadline(value.order),
    rejectionReason: null,
    items: returnItems.map(returnItemDto),
    refund: {
      status: value.refundStatus,
      amount: refundAmount,
      currency: value.order?.currencyCode ?? "EUR",
      method: value.refundMethod ?? null,
      refundedAt: value.status === "refunded" ? isoDate(value.updatedAt ?? value.updated_at) : null,
    },
    shipment: null,
    timeline: returnTimeline(value),
    actions: { canCancel: value.status === "requested" },
  };
}

const returnIncludes = (detailed = false) => [
  { model: Order, as: "order", required: true },
  ...(detailed ? [{ model: OrderReturnItem, as: "items", required: false }] : []),
];

async function ownedReturn({ accountId, returnId, transaction = null, lock = false, detailed = true }) {
  const returnRequest = await OrderReturn.findOne({
    where: { id: returnId, accountId },
    transaction,
    lock: lock ? transaction.LOCK.UPDATE : undefined,
    include: returnIncludes(detailed),
  });

  if (!returnRequest) {
    throw commerceNotFound("The requested return could not be found.");
  }

  return returnRequest;
}

export async function listReturnRequests({ accountId, filters }) {
  const where = { accountId };
  if (filters.status?.length) where.status = { [Op.in]: filters.status };
  if (filters.orderId) where.orderId = filters.orderId;

  const { count, rows } = await OrderReturn.findAndCountAll({
    where,
    distinct: true,
    col: "id",
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
    order: [["created_at", "DESC"]],
    include: returnIncludes(true),
  });

  return {
    items: rows.map((item) => returnRequestDto(item)),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: count,
      totalPages: count ? Math.ceil(count / filters.limit) : 0,
    },
  };
}

export async function getReturnRequest({ accountId, returnId }) {
  return returnRequestDto(
    await ownedReturn({ accountId, returnId, detailed: true }),
    null,
    { detailed: true },
  );
}

export async function cancelReturnRequest({ accountId, returnId }) {
  const transaction = await sequelize.transaction();

  try {
    const returnRequest = await ownedReturn({
      accountId,
      returnId,
      transaction,
      lock: true,
      detailed: true,
    });

    if (returnRequest.status !== "requested") {
      throw new CommerceError("This return can no longer be cancelled.", {
        statusCode: 409,
        errorCode: "RETURN_NOT_CANCELLABLE",
        details: { retryable: false, fields: { status: "not_cancellable" } },
      });
    }

    await returnRequest.update({ status: "cancelled" }, { transaction });
    await transaction.commit();

    return returnRequestDto(returnRequest, null, { detailed: true });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

function orderStatusLabel(status) {
  return {
    placed: "Placed",
    confirmed: "Confirmed",
    packed: "Packed",
    shipped: "Shipped",
    outForDelivery: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  }[status] ?? status;
}

function orderTimeline(order) {
  const value = plain(order);
  if (value.status === "cancelled") {
    return [
      { code: "placed", label: "Placed", at: isoDate(value.createdAt ?? value.created_at), done: true },
      { code: "cancelled", label: "Cancelled", at: isoDate(value.cancelledAt ?? value.updatedAt ?? value.updated_at), done: true },
    ];
  }

  const statuses = ["placed", "confirmed", "packed", "shipped", "outForDelivery", "delivered"];
  const currentIndex = Math.max(0, statuses.indexOf(value.status));
  const fulfillment = plain(value.fulfillment);
  return statuses.map((code, index) => ({
    code,
    label: orderStatusLabel(code),
    at:
      index === 0
        ? isoDate(value.createdAt ?? value.created_at)
        : code === "shipped"
          ? isoDate(fulfillment?.shippedAt)
          : code === "delivered"
            ? isoDate(value.deliveredAt)
            : index === currentIndex
              ? isoDate(value.updatedAt ?? value.updated_at)
              : null,
    done: index <= currentIndex,
  }));
}

export async function getOrderTracking({ accountId, orderId }) {
  const order = await Order.findOne({
    where: { id: orderId, accountId },
    include: [
      { model: OrderItem, as: "items", required: false },
      { model: OrderFulfillment, as: "fulfillment", required: false },
    ],
  });

  if (!order) {
    throw commerceNotFound("The requested order could not be found.");
  }

  const value = plain(order);
  const fulfillment = plain(value.fulfillment);
  const address = value.addressSnapshot ?? {};
  const shipments = fulfillment
    ? [{
        id: String(fulfillment.id),
        orderItemIds: (value.items ?? []).map((item) => String(item.id)),
        carrier: { code: fulfillment.carrier, name: fulfillment.carrier, phone: null },
        trackingNumber: fulfillment.trackingNumber,
        trackingUrl: fulfillment.trackingUrl ?? null,
        status: ["outForDelivery", "delivered"].includes(value.status) ? value.status : "inTransit",
        statusLabel: orderStatusLabel(value.status === "shipped" ? "shipped" : value.status),
        shippedAt: isoDate(fulfillment.shippedAt),
        estimatedDelivery: null,
        events: [],
      }]
    : [];

  return {
    orderId: String(value.id),
    orderNumber: value.orderNumber,
    status: value.status,
    statusLabel: orderStatusLabel(value.status),
    estimatedDelivery: null,
    deliveredAt: isoDate(value.deliveredAt),
    address: {
      fullName: address.fullName ?? null,
      city: address.city ?? null,
      postalCode: address.postalCode ?? null,
      country: address.country ?? null,
    },
    timeline: orderTimeline(value),
    shipments,
  };
}

export async function cancelOrder({ accountId, orderId, payload }) {
  const transaction = await sequelize.transaction();

  try {
    const order = await Order.findOne({
      where: {
        id: orderId,

        accountId,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      throw commerceNotFound("The requested order could not be found.");
    }

    if (order.status === "cancelled") {
      await transaction.commit();

      return {
        orderId: String(order.id),

        orderNumber: order.orderNumber,

        status: order.status,

        reason: order.cancelReason ?? null,

        note: order.cancelNote ?? null,

        cancelledAt: order.cancelledAt
          ? new Date(order.cancelledAt).toISOString()
          : new Date(order.updatedAt ?? order.updated_at).toISOString(),
      };
    }

    if (!["placed", "confirmed"].includes(order.status)) {
      throw new CommerceError("This order can no longer be cancelled.", {
        statusCode: 409,

        details: {
          retryable: false,

          fields: {
            status: "not_cancellable",
          },
        },
      });
    }

    const items = await OrderItem.findAll({
      where: {
        orderId: order.id,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    for (const item of items) {
      if (!item.productVariantId) {
        continue;
      }

      const inventory = await Inventory.findOne({
        where: {
          variantId: item.productVariantId,
        },

        transaction,

        lock: transaction.LOCK.UPDATE,
      });

      if (
        !inventory ||
        Number(inventory.quantityReserved) < Number(item.quantity)
      ) {
        throw new CommerceError(
          "The order inventory reservation could not be released safely.",
          {
            statusCode: 409,

            details: {
              retryable: false,

              fields: {
                inventory: "reservation_inconsistent",
              },
            },
          },
        );
      }

      await inventory.decrement("quantityReserved", {
        by: Number(item.quantity),

        transaction,
      });
    }

    const cancelledAt = new Date();

    await order.update(
      {
        status: "cancelled",

        cancelReason: payload.reason,

        cancelNote: payload.note ?? null,

        cancelledAt,
      },

      {
        transaction,
      },
    );

    await transaction.commit();

    return {
      orderId: String(order.id),

      orderNumber: order.orderNumber,

      status: order.status,

      reason: order.cancelReason,

      note: order.cancelNote,

      cancelledAt: cancelledAt.toISOString(),
    };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}

export async function createReturnRequest({
  accountId,
  orderId,
  payload,
  now = new Date(),
}) {
  const transaction = await sequelize.transaction();

  try {
    const order = await Order.findOne({
      where: {
        id: orderId,

        accountId,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      throw commerceNotFound("The requested order could not be found.");
    }

    if (order.status !== "delivered") {
      throw new CommerceError(
        "Returns can only be requested for delivered orders.",
        {
          statusCode: 422,

          details: {
            retryable: false,

            fields: {
              orderId: "not_delivered",
            },
          },
        },
      );
    }

    if (!order.deliveredAt) {
      throw new CommerceError(
        "The delivery date is not available for this order.",
        {
          statusCode: 422,

          details: {
            retryable: false,

            fields: {
              orderId: "delivery_date_unavailable",
            },
          },
        },
      );
    }

    const deliveredAt = new Date(order.deliveredAt);

    const deadline = new Date(deliveredAt);

    deadline.setUTCDate(deadline.getUTCDate() + RETURN_WINDOW_DAYS);

    if (
      Number.isNaN(deliveredAt.getTime()) ||
      now.getTime() > deadline.getTime()
    ) {
      throw new CommerceError(
        "The 14-day return window for this order has expired.",
        {
          statusCode: 422,

          details: {
            retryable: false,

            fields: {
              orderId: "return_window_expired",
            },
          },
        },
      );
    }

    const orderItems = await OrderItem.findAll({
      where: {
        orderId: order.id,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    const itemsById = new Map(
      orderItems.map((item) => [String(item.id), item]),
    );

    const existingRequests = await OrderReturn.findAll({
      where: {
        orderId: order.id,
      },

      include: [
        {
          model: OrderReturnItem,

          as: "items",

          required: false,
        },
      ],

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    const previouslyRequested = new Map();

    for (const request of existingRequests) {
      const requestValue = plain(request);

      if (["rejected", "cancelled"].includes(requestValue.status)) {
        continue;
      }

      for (const item of requestValue.items ?? []) {
        const key = String(item.orderItemId);

        previouslyRequested.set(
          key,

          (previouslyRequested.get(key) ?? 0) + Number(item.quantity),
        );
      }
    }

    /*
     * Validate every requested line before creating the return header. This
     * keeps the operation side-effect free when a later line is invalid and
     * also prevents duplicate payload lines from exceeding the eligible
     * quantity in aggregate.
     */
    const requestedByOrderItem = new Map();

    const validatedItems = payload.items.map((requested, index) => {
      const orderItem = itemsById.get(String(requested.orderItemId));

      if (!orderItem) {
        throw commerceNotFound("A selected order item could not be found.");
      }

      const key = String(orderItem.id);
      const remainingQuantity =
        Number(orderItem.quantity) - (previouslyRequested.get(key) ?? 0);
      const requestedQuantity =
        (requestedByOrderItem.get(key) ?? 0) + Number(requested.quantity);

      if (requestedQuantity > remainingQuantity) {
        throw new CommerceError(
          "The requested return quantity exceeds the quantity still eligible for return.",
          {
            statusCode: 422,

            details: {
              retryable: false,

              fields: {
                [`items.${index}.quantity`]: "exceeds_returnable_quantity",
              },
            },
          },
        );
      }

      requestedByOrderItem.set(key, requestedQuantity);

      return {
        requested,
        orderItem,
      };
    });

    const returnRequest = await OrderReturn.create(
      {
        orderId: order.id,

        accountId,

        status: "requested",

        refundStatus: "not_started",
      },

      {
        transaction,
      },
    );

    const returnItems = [];

    for (const { requested, orderItem } of validatedItems) {

      const unitPrice = euros(cents(orderItem.unitPrice));

      const returnItem = await OrderReturnItem.create(
        {
          orderReturnId: returnRequest.id,

          orderItemId: orderItem.id,

          productSnapshot: orderItem.productSnapshot,

          quantity: requested.quantity,

          reason: requested.reason,

          note: requested.note ?? null,

          unitPrice,

          lineTotal: euros(cents(unitPrice) * requested.quantity),
        },

        {
          transaction,
        },
      );

      returnItems.push(returnItem);
    }

    await transaction.commit();

    return returnRequestDto(
      {
        ...plain(returnRequest),
        order: plain(order),
        items: returnItems,
      },
      returnItems,
      { detailed: true },
    );
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}

export async function confirmPayment({ accountId, paymentId }) {
  const payment = await Payment.findOne({
    where: {
      id: paymentId,
    },

    include: [
      {
        model: Order,

        as: "order",

        required: true,

        where: {
          accountId,
        },
      },
    ],
  });

  if (!payment) {
    throw commerceNotFound("The requested payment could not be found.");
  }

  throw new CommerceError(
    "Card payment confirmation is not available yet. Please use cash on delivery.",
    {
      statusCode: 503,
    },
  );
}
