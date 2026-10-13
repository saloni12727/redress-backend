import { Router } from "express";

import { authenticateStandard } from "../../middleware/authenticate.js";

import { authenticateCartOwner } from "../../middleware/authenticate-cart-owner.js";

import { asyncHandler } from "../../utils/async-handler.js";

import * as controller from "./commerce.controller.js";

/*
|--------------------------------------------------------------------------
| Cart
|--------------------------------------------------------------------------
*/

export const cartRouter = Router();

/*
 * POST /cart/merge
 *
 * Requires:
 *
 * Authorization: Bearer <account token>
 * X-Guest-Token: <guest token>
 *
 * Must stay BEFORE cartRouter.use(authenticateCartOwner).
 */
cartRouter.post(
  "/merge",

  authenticateStandard,

  asyncHandler(controller.mergeGuestCartController),
);

/*
 * Normal Cart APIs support:
 *
 * Logged-in:
 * Authorization: Bearer ...
 *
 * OR
 *
 * Guest:
 * X-Guest-Token: ...
 */
cartRouter.use(authenticateCartOwner);

cartRouter.get(
  "/",

  asyncHandler(controller.getCartController),
);

cartRouter.post(
  "/items",

  asyncHandler(controller.addCartItemController),
);

cartRouter.patch(
  "/items/:id",

  asyncHandler(controller.updateCartItemController),
);

cartRouter.delete(
  "/items/:id",

  asyncHandler(controller.removeCartItemController),
);

/*
|--------------------------------------------------------------------------
| Addresses
|--------------------------------------------------------------------------
*/

export const addressesRouter = Router();

addressesRouter.use(authenticateStandard);

addressesRouter.get(
  "/",

  asyncHandler(controller.listAddressesController),
);

addressesRouter.post(
  "/",

  asyncHandler(controller.createAddressController),
);

addressesRouter.patch(
  "/:id",

  asyncHandler(controller.updateAddressController),
);

addressesRouter.delete(
  "/:id",

  asyncHandler(controller.removeAddressController),
);

/*
|--------------------------------------------------------------------------
| Checkout
|--------------------------------------------------------------------------
*/

export const checkoutRouter = Router();

checkoutRouter.use(authenticateStandard);

checkoutRouter.get(
  "/quote",

  asyncHandler(controller.quoteController),
);

checkoutRouter.post(
  "/",

  asyncHandler(controller.checkoutController),
);

/*
|--------------------------------------------------------------------------
| Orders
|--------------------------------------------------------------------------
*/

export const ordersRouter = Router();

ordersRouter.use(authenticateStandard);

ordersRouter.get(
  "/",

  asyncHandler(controller.listOrdersController),
);

ordersRouter.get(
  "/:id",

  asyncHandler(controller.getOrderController),
);

ordersRouter.get(
  "/:id/tracking",

  asyncHandler(controller.getOrderTrackingController),
);

ordersRouter.post(
  "/:id/cancel",

  asyncHandler(controller.cancelOrderController),
);

/*
|--------------------------------------------------------------------------
| Payments
|--------------------------------------------------------------------------
*/

export const paymentsRouter = Router();

paymentsRouter.use(authenticateStandard);

paymentsRouter.post(
  "/:id/confirm",

  asyncHandler(controller.confirmPaymentController),
);

/*
|--------------------------------------------------------------------------
| Returns
|--------------------------------------------------------------------------
*/

export const returnsRouter = Router();

returnsRouter.use(authenticateStandard);

returnsRouter.post(
  "/",

  asyncHandler(controller.createReturnRequestController),
);

returnsRouter.get(
  "/",

  asyncHandler(controller.listReturnsController),
);

returnsRouter.get(
  "/:id",

  asyncHandler(controller.getReturnController),
);

returnsRouter.post(
  "/:id/cancel",

  asyncHandler(controller.cancelReturnController),
);
