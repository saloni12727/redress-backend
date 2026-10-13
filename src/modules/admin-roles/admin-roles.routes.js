import { Router } from "express";
import { authenticateStandard } from "../../middleware/authenticate.js";
import { requirePermissionStandard } from "../../middleware/require-permission.js";
import { logCaughtRouteError } from "../../middleware/smart-request-logger.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./admin-roles.controller.js";

const router = Router();
router.use(authenticateStandard);
router.get("/", requirePermissionStandard("platform.roles.view"), asyncHandler(controller.listRolesController));
router.get("/permissions", requirePermissionStandard("platform.roles.view"), asyncHandler(controller.listPermissionsController));
router.post("/", requirePermissionStandard("platform.roles.create"), requirePermissionStandard("platform.roles.assign_permissions"), asyncHandler(controller.createRoleController));
router.patch("/:id", requirePermissionStandard("platform.roles.update"), requirePermissionStandard("platform.roles.assign_permissions"), asyncHandler(controller.updateRoleController));
router.delete("/:id", requirePermissionStandard("platform.roles.delete"), asyncHandler(controller.deleteRoleController));
router.use((error, request, response, next) => { if (response.headersSent) return next(error); logCaughtRouteError({ request, response, error, component: "admin-roles" }); return response.status(500).json({ success: false, data: null, message: "An unexpected error occurred. Please try again later." }); });
export default router;
