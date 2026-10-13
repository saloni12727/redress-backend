import * as service from "./wishlist.service.js";

import { WishlistError } from "./wishlist.error.js";

import * as validation from "./wishlist.validation.js";

function failed(response, status, message) {
  return response.status(status).json({
    success: false,
    data: null,
    message,
  });
}

function send(response, status, data, message) {
  return response.status(status).json({
    success: true,
    data,
    message,
  });
}

function parse(schema, value, response, location) {
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
  if (error instanceof WishlistError) {
    return failed(response, error.statusCode, error.message);
  }

  return next(error);
}

export async function listWishlistController(request, response, next) {
  const query = parse(
    validation.listWishlistQuerySchema,
    request.query,
    response,
    "query",
  );

  if (!query) {
    return;
  }

  try {
    return send(
      response,
      200,
      await service.listWishlist({
        accountId: request.auth.accountId,
        query,
        locale: query.lang ?? request.locale,
      }),
      "Wishlist retrieved successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function addWishlistItemController(request, response, next) {
  const params = parse(
    validation.wishlistProductParamsSchema,
    request.params,
    response,
    "params",
  );

  if (!params) {
    return;
  }

  try {
    const item = await service.addWishlistItem({
      accountId: request.auth.accountId,
      productId: params.productId,
    });

    return send(
      response,
      200,
      item,
      item.created
        ? "Item added to the wishlist successfully."
        : "Item is already in the wishlist.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}

export async function removeWishlistItemController(request, response, next) {
  const params = parse(
    validation.wishlistProductParamsSchema,
    request.params,
    response,
    "params",
  );

  if (!params) {
    return;
  }

  try {
    await service.removeWishlistItem({
      accountId: request.auth.accountId,
      productId: params.productId,
    });

    return send(
      response,
      200,
      null,
      "Item removed from the wishlist successfully.",
    );
  } catch (error) {
    return handle(error, response, next);
  }
}
