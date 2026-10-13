import { Router } from "express";
import { authenticateStandard } from "../../middleware/authenticate.js";
import { productImagesUpload } from "../../middleware/media-upload.middleware.js";
import { requirePermissionStandard } from "../../middleware/require-permission.js";
import { logCaughtRouteError } from "../../middleware/smart-request-logger.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";
import * as controller from "./vendor-products.controller.js";

const router = Router();
router.use(authenticateStandard);
router.get("/", requirePermissionStandard("vendor.products.view"), asyncHandler(controller.listProductsController));
router.post("/", requirePermissionStandard("vendor.products.create"), asyncHandler(controller.createProductController));
router.get("/:id", requirePermissionStandard("vendor.products.view"), asyncHandler(controller.getProductController));
router.patch("/:id", requirePermissionStandard("vendor.products.update"), asyncHandler(controller.updateProductController));
router.delete("/:id", requirePermissionStandard("vendor.products.delete"), asyncHandler(controller.deleteProductController));
router.put("/:id/categories", requirePermissionStandard("vendor.products.update"), asyncHandler(controller.replaceCategoriesController));
router.post("/:id/variants", requirePermissionStandard("vendor.products.update"), asyncHandler(controller.createVariantController));
router.patch("/:id/variants/:variantId", requirePermissionStandard("vendor.products.update"), asyncHandler(controller.updateVariantController));
router.delete("/:id/variants/:variantId", requirePermissionStandard("vendor.products.update"), asyncHandler(controller.deleteVariantController));
router.patch("/:id/variants/:variantId/inventory", requirePermissionStandard("vendor.inventory.update"), asyncHandler(controller.updateInventoryController));
router.get("/:id/size-chart", requirePermissionStandard("vendor.products.view"), asyncHandler(controller.getSizeChartController));
router.put("/:id/variants/:variantId/size-chart", requirePermissionStandard("vendor.products.update"), asyncHandler(controller.replaceSizeChartController));
router.get("/:id/attributes", requirePermissionStandard("vendor.products.view"), asyncHandler(controller.getProductAttributesController));
router.put("/:id/attributes", requirePermissionStandard("vendor.products.update"), asyncHandler(controller.replaceProductAttributesController));
router.put("/:id/variants/:variantId/attributes", requirePermissionStandard("vendor.products.update"), asyncHandler(controller.replaceVariantAttributesController));
router.post("/:id/media", requirePermissionStandard("vendor.products.update"), productImagesUpload, asyncHandler(controller.uploadMediaController));
router.patch("/:id/media/:mediaId", requirePermissionStandard("vendor.products.update"), asyncHandler(controller.updateMediaController));
router.delete("/:id/media/:mediaId", requirePermissionStandard("vendor.products.update"), asyncHandler(controller.deleteMediaController));
router.post("/:id/submit", requirePermissionStandard("vendor.products.update"), asyncHandler(controller.submitProductController));
router.use((caught, request, response, next) => {
  if (response.headersSent) return next(caught);
  if (caught instanceof AppError && caught.statusCode < 500) {
    const tooLarge = caught.statusCode === 413;
    return response.status(caught.statusCode).json({ success: false, data: null, message: tooLarge ? "The product image upload is too large." : "The product image upload is invalid." });
  }
  logCaughtRouteError({ request, response, error: caught, component: "vendor-products" });
  return response.status(500).json({ success: false, data: null, message: "An unexpected error occurred. Please try again later." });
});
export default router;
