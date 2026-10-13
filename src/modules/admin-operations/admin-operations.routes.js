import { Router } from "express";

import { authenticateStandard } from "../../middleware/authenticate.js";
import { requirePermissionStandard } from "../../middleware/require-permission.js";
import { logCaughtRouteError } from "../../middleware/smart-request-logger.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./admin-operations.controller.js";

const router = Router();

router.use(authenticateStandard);

router.get("/dashboard/overview", requirePermissionStandard("platform.dashboard.view"), asyncHandler(controller.dashboardOverviewController));

router.get("/orders", requirePermissionStandard("platform.orders.view"), asyncHandler(controller.listOrdersController));
router.get("/orders/:id", requirePermissionStandard("platform.orders.view"), asyncHandler(controller.getOrderController));
router.patch("/orders/:id/status", requirePermissionStandard("platform.orders.update"), asyncHandler(controller.updateOrderStatusController));
router.patch("/orders/:id/tracking", requirePermissionStandard("platform.orders.update"), asyncHandler(controller.updateOrderTrackingController));

router.get("/returns", requirePermissionStandard("platform.returns.view"), asyncHandler(controller.listReturnsController));
router.get("/returns/:id", requirePermissionStandard("platform.returns.view"), asyncHandler(controller.getReturnController));
router.post("/returns/:id/approve", requirePermissionStandard("platform.returns.update"), asyncHandler(controller.approveReturnController));
router.post("/returns/:id/reject", requirePermissionStandard("platform.returns.update"), asyncHandler(controller.rejectReturnController));
router.post("/returns/:id/receive", requirePermissionStandard("platform.returns.update"), asyncHandler(controller.receiveReturnController));
router.post("/returns/:id/refund", requirePermissionStandard("platform.returns.update"), asyncHandler(controller.refundReturnController));

router.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  logCaughtRouteError({ request, response, error, component: "admin-operations" });
  return response.status(500).json({ success: false, data: null, message: "An unexpected error occurred. Please try again later." });
});

export default router;
