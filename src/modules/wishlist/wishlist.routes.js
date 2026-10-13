import { Router } from "express";

import { authenticateStandard } from "../../middleware/authenticate.js";

import { asyncHandler } from "../../utils/async-handler.js";

import * as controller from "./wishlist.controller.js";

const router = Router();

router.use(authenticateStandard);

router.get("/", asyncHandler(controller.listWishlistController));

router.put(
  "/:productId",
  asyncHandler(controller.addWishlistItemController),
);

router.delete(
  "/:productId",
  asyncHandler(controller.removeWishlistItemController),
);

export default router;
