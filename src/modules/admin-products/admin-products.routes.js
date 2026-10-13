import { Router } from "express";
import { authenticateStandard } from "../../middleware/authenticate.js";
import { requirePermissionStandard } from "../../middleware/require-permission.js";
import { logCaughtRouteError } from "../../middleware/smart-request-logger.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./admin-products.controller.js";

const router = Router();
router.use(authenticateStandard);
router.get("/submissions", requirePermissionStandard("platform.products.view"), asyncHandler(controller.listSubmissionsController));
router.get("/:id", requirePermissionStandard("platform.products.view"), asyncHandler(controller.getProductController));
router.post("/:id/approve", requirePermissionStandard("platform.products.update"), asyncHandler(controller.approveProductController));
router.post("/:id/reject", requirePermissionStandard("platform.products.update"), asyncHandler(controller.rejectProductController));
router.post("/:id/publish", requirePermissionStandard("platform.products.manage_status"), asyncHandler(controller.publishProductController));
router.post("/:id/unpublish", requirePermissionStandard("platform.products.manage_status"), asyncHandler(controller.unpublishProductController));
router.use((caught, request, response, next) => { if (response.headersSent) return next(caught); logCaughtRouteError({ request, response, error: caught, component: "admin-products" }); return response.status(500).json({ success: false, data: null, message: "An unexpected error occurred. Please try again later." }); });
export default router;
