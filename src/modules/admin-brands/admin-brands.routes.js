import { Router } from "express";

import { authenticateStandard } from "../../middleware/authenticate.js";
import { createImageUploadMiddleware } from "../../middleware/media-upload.middleware.js";
import { requirePermissionStandard } from "../../middleware/require-permission.js";
import { logCaughtRouteError } from "../../middleware/smart-request-logger.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AppError } from "../../utils/app-error.js";

import {
  createBrandController,
  deleteBrandController,
  getBrandController,
  listBrandsController,
  updateBrandController,
} from "./admin-brands.controller.js";

const router = Router();
const optionalLogoUpload = createImageUploadMiddleware("brandLogo", {
  required: false,
  maxFields: 10,
  maxFieldBytes: 8 * 1024,
});

function parseOptionalLogo(request, response, next) {
  if (!request.is("multipart/form-data")) {
    return next();
  }

  return optionalLogoUpload(request, response, next);
}

router.use(authenticateStandard);

router.get(
  "/",
  requirePermissionStandard("platform.brands.view"),
  asyncHandler(listBrandsController),
);

router.post(
  "/",
  requirePermissionStandard("platform.brands.create"),
  parseOptionalLogo,
  asyncHandler(createBrandController),
);

router.get(
  "/:id",
  requirePermissionStandard("platform.brands.view"),
  asyncHandler(getBrandController),
);

router.patch(
  "/:id",
  requirePermissionStandard("platform.brands.update"),
  parseOptionalLogo,
  asyncHandler(updateBrandController),
);

router.delete(
  "/:id",
  requirePermissionStandard("platform.brands.delete"),
  asyncHandler(deleteBrandController),
);

router.use((error, request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }

  if (error instanceof AppError && error.statusCode < 500) {
    const reason = error?.details?.reason;
    const messageByReason = {
      media_file_required: "Please select a brand logo image.",
      unsupported_media_type: "Only JPEG, PNG, and WebP logo images are allowed.",
      media_file_too_large: "The brand logo image is too large.",
      media_files_total_too_large: "The brand logo image is too large.",
      too_many_media_files: "Only one brand logo image can be uploaded.",
      invalid_media_field: "The logo must be uploaded using the 'logo' field.",
      invalid_multipart_request: "The brand logo upload request is invalid.",
    };

    return response.status(error.statusCode).json({
      success: false,
      data: null,
      message: messageByReason[reason] ?? "The brand logo upload is invalid.",
    });
  }

  logCaughtRouteError({
    request,
    response,
    error,
    component: "admin-brands",
  });

  return response.status(500).json({
    success: false,
    data: null,
    message: "An unexpected error occurred. Please try again later.",
  });
});

export default router;
