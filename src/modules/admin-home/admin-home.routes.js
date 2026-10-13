import { Router } from "express";

import { authenticateStandard } from "../../middleware/authenticate.js";
import { createImageUploadMiddleware } from "../../middleware/media-upload.middleware.js";
import { requirePermissionStandard } from "../../middleware/require-permission.js";
import { logCaughtRouteError } from "../../middleware/smart-request-logger.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";

import {
  archivePlacementController,
  createPlacementController,
  deletePlacementController,
  getPlacementController,
  listPlacementsController,
  publishPlacementController,
  updatePlacementController,
} from "./admin-home.controller.js";

const router = Router();

/*
 * Home placement form currently contains 21 text fields.
 * Keep a small safe buffer so Swagger/browser multipart forms can submit
 * optional empty fields without Multer rejecting a valid request.
 */
const createImage = createImageUploadMiddleware("homePlacement", {
  maxFields: 25,
  maxFieldBytes: 8 * 1024,
});

const optionalImage = createImageUploadMiddleware("homePlacement", {
  required: false,
  maxFields: 25,
  maxFieldBytes: 8 * 1024,
});

router.use(authenticateStandard);

router.get(
  "/placements",
  requirePermissionStandard("platform.home_content.view"),
  asyncHandler(listPlacementsController),
);

router.post(
  "/placements",
  requirePermissionStandard("platform.home_content.create"),
  createImage,
  asyncHandler(createPlacementController),
);

router.get(
  "/placements/:id",
  requirePermissionStandard("platform.home_content.view"),
  asyncHandler(getPlacementController),
);

router.patch(
  "/placements/:id",
  requirePermissionStandard("platform.home_content.update"),
  optionalImage,
  asyncHandler(updatePlacementController),
);

router.post(
  "/placements/:id/publish",
  requirePermissionStandard("platform.home_content.publish"),
  asyncHandler(publishPlacementController),
);

router.post(
  "/placements/:id/archive",
  requirePermissionStandard("platform.home_content.publish"),
  asyncHandler(archivePlacementController),
);

router.delete(
  "/placements/:id",
  requirePermissionStandard("platform.home_content.delete"),
  asyncHandler(deletePlacementController),
);

router.use((error, request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }

  if (error instanceof AppError && error.statusCode < 500) {
    const reason = error?.details?.reason;

    const messageMap = {
      media_file_required: "Please select an image for the Home placement.",
      unsupported_media_type: "Only JPEG, PNG, and WebP images are allowed.",
      media_file_too_large: "The Home placement image is too large.",
      media_files_total_too_large: "The Home placement image is too large.",
      too_many_media_files:
        "Only one image can be uploaded for a Home placement.",
      invalid_media_field:
        "The image must be uploaded using the 'image' field.",
      invalid_multipart_request: "The multipart form-data request is invalid.",
    };

    return response.status(error.statusCode).json({
      success: false,
      data: null,
      message:
        messageMap[reason] ?? "The Home placement image upload is invalid.",
    });
  }

  logCaughtRouteError({
    request,
    response,
    error,
    component: "admin-home",
  });

  return response.status(500).json({
    success: false,
    data: null,
    message: "An unexpected error occurred. Please try again later.",
  });
});

export default router;
