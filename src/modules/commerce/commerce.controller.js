import { getGuestTokenFromRequest } from "../../middleware/authenticate-cart-owner.js";

import { clearGuestCookie } from "../guest/guest-cookie.service.js";

import * as service from "./commerce.service.js";

import { mergeGuestCart } from "./guest-cart.service.js";

import { CommerceError } from "./commerce.error.js";

import * as validation from "./commerce.validation.js";

function failed(response, status, message, { errorCode, details } = {}) {
  return response.status(status).json({
    success: false,
    data: null,
    message,
    ...(errorCode ? { errorCode } : {}),
    ...(details ? { details } : {}),
  });
}

function parse(schema, value, response, location = "request") {
  const parsed = schema.safeParse(value);

  if (parsed.success) {
    return parsed.data;
  }

  failed(
    response,

    location === "params" ? 400 : 422,

    `The ${location} contains invalid fields.`,
  );

  return null;
}

function handle(error, response, next) {
  if (error instanceof CommerceError) {
    return failed(response, error.statusCode, error.message, {
      errorCode: error.errorCode,
      details: error.details,
    });
  }

  return next(error);
}

function send(response, status, data, message) {
  return response.status(status).json({
    success: true,
    data,
    message,
  });
}

function actionFailure(response, status, message, { errorCode, details } = {}) {
  return response.status(status).json({
    success: false,
    data: null,
    message,
    ...(errorCode ? { errorCode } : {}),
    ...(details ? { details } : {}),
  });
}

function parseAction(schema, value, response, status = 422) {
  const parsed = schema.safeParse(value);

  if (parsed.success) {
    return parsed.data;
  }

  const fields = {};

  for (const issue of parsed.error.issues) {
    const field = issue.path.join(".") || "body";

    fields[field] = issue.code === "custom" ? "required" : "invalid";
  }

  const fieldNames = Object.keys(fields);

  actionFailure(
    response,
    status,
    `The request contains invalid fields: ${fieldNames.join(", ")}.`,
    {
      errorCode: "VALIDATION",
      details: { fields },
    },
  );

  return null;
}

function handleActionError(error, response, next) {
  if (!(error instanceof CommerceError)) {
    return next(error);
  }

  return actionFailure(
    response,

    error.statusCode,

    error.message,
    {
      errorCode: error.errorCode,
      details: error.details,
    },
  );
}

function cartOwner(request) {
  return {
    accountId: request.cartOwner?.accountId ?? null,

    guestSessionId: request.cartOwner?.guestSessionId ?? null,
  };
}

/*
|--------------------------------------------------------------------------
| Cart
|--------------------------------------------------------------------------
*/

export async function getCartController(request, response, next) {
  try {
    return send(
      response,
      200,

      await service.getCart(cartOwner(request)),

      "Shopping bag retrieved successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function addCartItemController(request, response, next) {
  const payload = parse(
    validation.addCartItemSchema,

    request.body ?? {},

    response,
  );

  if (!payload) {
    return;
  }

  try {
    return send(
      response,
      201,

      await service.addCartItem({
        ...cartOwner(request),
        payload,
      }),

      "Item added to the shopping bag successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function updateCartItemController(request, response, next) {
  const params = parse(
    validation.cartItemParamsSchema,

    request.params,

    response,

    "params",
  );

  const payload = parse(
    validation.updateCartItemSchema,

    request.body ?? {},

    response,
  );

  if (!params || !payload) {
    return;
  }

  try {
    return send(
      response,
      200,

      await service.updateCartItem({
        ...cartOwner(request),

        itemId: params.id,

        payload,
      }),

      "Shopping bag updated successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function removeCartItemController(request, response, next) {
  const params = parse(
    validation.cartItemParamsSchema,

    request.params,

    response,

    "params",
  );

  if (!params) {
    return;
  }

  try {
    return send(
      response,
      200,

      await service.removeCartItem({
        ...cartOwner(request),

        itemId: params.id,
      }),

      "Item removed from the shopping bag successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function mergeGuestCartController(request, response, next) {
  try {
    const data = await mergeGuestCart({
      accountId: request.auth.accountId,

      guestToken: getGuestTokenFromRequest(request),
    });

    /*
     * A browser guest token is HttpOnly, so client JavaScript cannot remove
     * it. Expire it only after the transaction has completed successfully.
     */
    clearGuestCookie(response);

    return send(
      response,
      200,

      data,

      "Guest shopping bag merged successfully.",
    );
  } catch (error) {
    return handleActionError(error, response, next);
  }
}

/*
|--------------------------------------------------------------------------
| Addresses
|--------------------------------------------------------------------------
*/

export async function listAddressesController(request, response, next) {
  try {
    return send(
      response,
      200,

      await service.listAddresses({
        accountId: request.auth.accountId,
      }),

      "Addresses retrieved successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function createAddressController(request, response, next) {
  const payload = parse(
    validation.createAddressSchema,

    request.body ?? {},

    response,
  );

  if (!payload) {
    return;
  }

  try {
    return send(
      response,
      201,

      await service.createAddress({
        accountId: request.auth.accountId,

        payload,
      }),

      "Address created successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function updateAddressController(request, response, next) {
  const params = parse(
    validation.addressParamsSchema,

    request.params,

    response,

    "params",
  );

  const payload = parse(
    validation.updateAddressSchema,

    request.body ?? {},

    response,
  );

  if (!params || !payload) {
    return;
  }

  try {
    return send(
      response,
      200,

      await service.updateAddress({
        accountId: request.auth.accountId,

        addressId: params.id,

        payload,
      }),

      "Address updated successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function removeAddressController(request, response, next) {
  const params = parse(
    validation.addressParamsSchema,

    request.params,

    response,

    "params",
  );

  if (!params) {
    return;
  }

  try {
    await service.removeAddress({
      accountId: request.auth.accountId,

      addressId: params.id,
    });

    return send(response, 200, null, "Address deleted successfully.");
  } catch (error) {
    return handle(error, response, next);
  }
}

/*
|--------------------------------------------------------------------------
| Checkout
|--------------------------------------------------------------------------
*/

export async function quoteController(request, response, next) {
  const payload = parse(
    validation.quoteSchema,

    request.query,

    response,

    "query",
  );

  if (!payload) {
    return;
  }

  try {
    return send(
      response,
      200,

      await service.getQuote({
        accountId: request.auth.accountId,

        payload,
      }),

      "Checkout quote retrieved successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function checkoutController(request, response, next) {
  const payload = parse(
    validation.checkoutSchema,

    request.body ?? {},

    response,
  );

  if (!payload) {
    return;
  }

  try {
    return send(
      response,
      201,

      await service.checkout({
        accountId: request.auth.accountId,

        payload,
      }),

      "Order placed successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

/*
|--------------------------------------------------------------------------
| Orders
|--------------------------------------------------------------------------
*/

export async function listOrdersController(request, response, next) {
  const filters = parse(
    validation.listOrdersSchema,

    request.query,

    response,

    "query",
  );

  if (!filters) {
    return;
  }

  try {
    return send(
      response,
      200,

      await service.listOrders({
        accountId: request.auth.accountId,

        filters,
      }),

      "Orders retrieved successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function getOrderController(request, response, next) {
  const params = parse(
    validation.orderParamsSchema,

    request.params,

    response,

    "params",
  );

  if (!params) {
    return;
  }

  try {
    return send(
      response,
      200,

      await service.getOrder({
        accountId: request.auth.accountId,

        orderId: params.id,
      }),

      "Order retrieved successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function cancelOrderController(request, response, next) {
  const params = parseAction(
    validation.orderParamsSchema,

    request.params,

    response,

    400,
  );

  const payload = parseAction(
    validation.cancelOrderSchema,

    request.body ?? {},

    response,
  );

  if (!params || !payload) {
    return;
  }

  try {
    return send(
      response,
      200,

      await service.cancelOrder({
        accountId: request.auth.accountId,

        orderId: params.id,

        payload,
      }),

      "Order cancelled successfully.",
    );
  } catch (error) {
    return handleActionError(error, response, next);
  }
}

/*
|--------------------------------------------------------------------------
| Returns
|--------------------------------------------------------------------------
*/

export async function createReturnRequestController(request, response, next) {
  const payload = parseAction(
    validation.createReturnRequestSchema,

    request.body ?? {},

    response,
  );

  if (!payload) {
    return;
  }

  try {
    return send(
      response,
      201,

      await service.createReturnRequest({
        accountId: request.auth.accountId,

        orderId: payload.orderId,

        payload,
      }),

      "Return request created successfully.",
    );
  } catch (error) {
    return handleActionError(error, response, next);
  }
}

export async function listReturnsController(request, response, next) {
  const filters = parse(validation.listReturnsSchema, request.query, response, "query");
  if (!filters) return;

  try {
    return send(
      response,
      200,
      await service.listReturnRequests({ accountId: request.auth.accountId, filters }),
      "Returns retrieved successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function getReturnController(request, response, next) {
  const params = parse(validation.returnParamsSchema, request.params, response, "params");
  if (!params) return;

  try {
    return send(
      response,
      200,
      await service.getReturnRequest({ accountId: request.auth.accountId, returnId: params.id }),
      "Return retrieved successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function cancelReturnController(request, response, next) {
  const params = parseAction(validation.returnParamsSchema, request.params, response, 400);
  const payload = parseAction(validation.cancelReturnSchema, request.body ?? {}, response);
  if (!params || !payload) return;

  try {
    return send(
      response,
      200,
      await service.cancelReturnRequest({ accountId: request.auth.accountId, returnId: params.id }),
      "Return cancelled successfully.",
    );
  } catch (error) {
    return handleActionError(error, response, next);
  }
}

export async function getOrderTrackingController(request, response, next) {
  const params = parse(validation.orderParamsSchema, request.params, response, "params");
  if (!params) return;

  try {
    return send(
      response,
      200,
      await service.getOrderTracking({ accountId: request.auth.accountId, orderId: params.id }),
      "Order tracking retrieved successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

/*
|--------------------------------------------------------------------------
| Payments
|--------------------------------------------------------------------------
*/

export async function confirmPaymentController(request, response, next) {
  const params = parse(
    validation.orderParamsSchema,

    request.params,

    response,

    "params",
  );

  const payload = parse(
    validation.confirmPaymentSchema,

    request.body ?? {},

    response,
  );

  if (!params || !payload) {
    return;
  }

  try {
    return send(
      response,
      200,

      await service.confirmPayment({
        accountId: request.auth.accountId,

        paymentId: params.id,

        providerPaymentId: payload.providerPaymentId,
      }),

      "Payment confirmed successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}
