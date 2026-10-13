import { Router } from "express";
import { authenticateStandard } from "../../middleware/authenticate.js";
import { requirePermissionStandard } from "../../middleware/require-permission.js";
import { logCaughtRouteError } from "../../middleware/smart-request-logger.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./admin-vendors.controller.js";

const router = Router();
router.use(authenticateStandard);
router.get("/onboarding", requirePermissionStandard("platform.vendors.view"), asyncHandler(controller.listOnboardingController));
router.get("/:id", requirePermissionStandard("platform.vendors.view"), asyncHandler(controller.getVendorController));
router.post("/:id/approve", requirePermissionStandard("platform.vendors.approve"), asyncHandler(controller.approveVendorController));
router.post("/:id/reject", requirePermissionStandard("platform.vendors.approve"), asyncHandler(controller.rejectVendorController));
router.patch("/:id/status", requirePermissionStandard("platform.vendors.manage_status"), asyncHandler(controller.updateVendorStatusController));
router.use((caught, request, response, next) => { if (response.headersSent) return next(caught); logCaughtRouteError({ request, response, error: caught, component: "admin-vendors" }); return response.status(500).json({ success: false, data: null, message: "An unexpected error occurred. Please try again later." }); });
export default router;
