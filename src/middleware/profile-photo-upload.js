import express from "express";

import {
  getImageUploadPolicy,
  isClaimedMimeTypeAllowed,
  normalizeMediaMimeType,
} from "../config/media.config.js";
import { profileImageUpload } from "./media-upload.middleware.js";
import { AppError } from "../utils/app-error.js";

const profilePolicy = getImageUploadPolicy("profile");

const PROFILE_REASON_BY_MEDIA_REASON = Object.freeze({
  media_file_required: "profile_photo_required",
  media_file_too_large: "profile_photo_too_large",
  unsupported_media_type: "unsupported_profile_photo_type",
  invalid_media_field: "profile_photo_field_invalid",
  too_many_media_files: "profile_photo_multipart_limit_exceeded",
  media_files_total_too_large: "profile_photo_too_large",
  invalid_multipart_request: "profile_photo_multipart_invalid",
});

/*
|--------------------------------------------------------------------------
| Raw image compatibility
|--------------------------------------------------------------------------
|
| Multipart is the only documented Flutter/Postman format. This raw parser is
| deliberately retained for existing callers, while multipart parsing itself
| is delegated to the shared media middleware.
|
*/

const rawProfilePhoto = express.raw({
  type: () => true,
  limit: profilePolicy.maxBytes,
});

function profileUploadError(reason, statusCode = 422) {
  const isPayloadTooLarge = statusCode === 413;

  return new AppError({
    message: isPayloadTooLarge
      ? "Profile photo is too large"
      : "Invalid profile photo upload",
    statusCode,
    errorCode: isPayloadTooLarge ? "PAYLOAD_TOO_LARGE" : "UNPROCESSABLE",
    messageKey: isPayloadTooLarge
      ? "errorPayloadTooLarge"
      : "errorUnprocessable",
    details: {
      retryable: false,
      reason,
      fields: {
        photo: reason,
      },
    },
  });
}

function mapSharedUploadError(error) {
  if (error?.type === "entity.too.large" || error?.status === 413) {
    return profileUploadError("profile_photo_too_large", 413);
  }

  if (error instanceof AppError) {
    const reason = error.details?.reason;
    const profileReason = PROFILE_REASON_BY_MEDIA_REASON[reason];

    if (profileReason) {
      return profileUploadError(profileReason, error.statusCode);
    }
  }

  return error;
}

function baseContentType(request) {
  return normalizeMediaMimeType(request.get("content-type"));
}

function attachProfilePhoto(request) {
  request.profilePhoto = {
    buffer: request.mediaFile.buffer,
    contentType: request.mediaFile.claimedMimeType,
    originalName: request.mediaFile.originalName,
    sizeBytes: request.mediaFile.sizeBytes,
  };
}

/*
|--------------------------------------------------------------------------
| Backward-compatible profile route adapter
|--------------------------------------------------------------------------
|
| Keep req.profilePhoto and existing profile-specific validation reasons so
| the Auth service and current clients retain their contract. New routes can
| use profileImageUpload directly and receive req.mediaFile.
|
*/

export function profilePhotoUpload(request, response, next) {
  const contentType = baseContentType(request);

  if (contentType === "multipart/form-data") {
    if (!/boundary=/i.test(request.get("content-type") ?? "")) {
      return next(
        profileUploadError("profile_photo_multipart_boundary_missing"),
      );
    }

    return profileImageUpload(request, response, (error) => {
      if (error) {
        return next(mapSharedUploadError(error));
      }

      attachProfilePhoto(request);
      return next();
    });
  }

  if (request.get("content-length") === "0" && !contentType) {
    return next(profileUploadError("profile_photo_required"));
  }

  if (
    !contentType ||
    !isClaimedMimeTypeAllowed(profilePolicy, contentType)
  ) {
    return next(profileUploadError("unsupported_profile_photo_type"));
  }

  return rawProfilePhoto(request, response, (error) => {
    if (error) {
      return next(mapSharedUploadError(error));
    }

    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      return next(profileUploadError("profile_photo_required"));
    }

    request.profilePhoto = {
      buffer: request.body,
      contentType,
      originalName: null,
      sizeBytes: request.body.length,
    };

    return next();
  });
}
