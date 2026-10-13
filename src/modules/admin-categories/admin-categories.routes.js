import { Router } from "express";

import { authenticateStandard } from "../../middleware/authenticate.js";
import { requirePermissionStandard } from "../../middleware/require-permission.js";
import { logCaughtRouteError } from "../../middleware/smart-request-logger.js";
import { asyncHandler } from "../../utils/async-handler.js";

import {
  createCategoryController,
  deleteCategoryController,
  getCategoryController,
  listCategoriesController,
  updateCategoryController,
} from "./admin-categories.controller.js";

const router = Router();

router.use(authenticateStandard);

router.get(
  "/",
  requirePermissionStandard("platform.categories.view"),
  asyncHandler(listCategoriesController),
);

router.post(
  "/",
  requirePermissionStandard("platform.categories.create"),
  asyncHandler(createCategoryController),
);

router.get(
  "/:id",
  requirePermissionStandard("platform.categories.view"),
  asyncHandler(getCategoryController),
);

router.patch(
  "/:id",
  requirePermissionStandard("platform.categories.update"),
  asyncHandler(updateCategoryController),
);

router.delete(
  "/:id",
  requirePermissionStandard("platform.categories.delete"),
  asyncHandler(deleteCategoryController),
);

/*
 * Controllers return expected validation and business errors themselves.
 * Keep unexpected failures in the same public envelope as every category API.
 */
router.use((error, request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }

  logCaughtRouteError({
    request,
    response,
    error,
    component: "admin-categories",
  });

  return response.status(500).json({
    success: false,
    data: null,
    message: "An unexpected error occurred. Please try again later.",
  });
});

export default router;
