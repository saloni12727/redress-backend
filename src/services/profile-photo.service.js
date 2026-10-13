import { env } from "../config/env.js";
import {
  getImageUploadPolicy,
  isClaimedMimeTypeAllowed,
} from "../config/media.config.js";
import { uploadObject } from "./s3.service.js";
import {
  MediaValidationError,
  processImage,
} from "./media/image-processor.service.js";

const PROFILE_REASON_BY_MEDIA_REASON = Object.freeze({
  media_file_required: "profile_photo_required",
  media_file_too_large: "profile_photo_too_large",
  invalid_media_file: "profile_photo_invalid",
  unsupported_media_type: "unsupported_profile_photo_type",
  media_type_mismatch: "profile_photo_type_mismatch",
  media_dimensions_too_small: "profile_photo_too_small",
  animated_media_not_allowed: "animated_profile_photo_not_allowed",
});

/*
|--------------------------------------------------------------------------
| Backward-compatible profile-photo facade
|--------------------------------------------------------------------------
|
| Auth still exposes the established profile-specific error reasons, while
| all Sharp decoding, validation, EXIF handling, and WebP conversion live in
| the canonical image processor.
|
*/

export class ProfilePhotoValidationError extends Error {
  constructor(reason, diagnostics = undefined) {
    super(reason);
    this.name = "ProfilePhotoValidationError";
    this.reason = reason;
    this.diagnostics = diagnostics;
  }
}

export function isSupportedProfilePhotoContentType(contentType) {
  return isClaimedMimeTypeAllowed(
    getImageUploadPolicy("profile"),
    contentType,
  );
}

export async function optimizeProfilePhoto({ buffer, contentType }) {
  try {
    return await processImage({
      buffer,
      claimedMimeType: contentType,
      policy: "profile",
    });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      throw new ProfilePhotoValidationError(
        PROFILE_REASON_BY_MEDIA_REASON[error.reason] ??
          "profile_photo_invalid",
        error.diagnostics,
      );
    }

    throw error;
  }
}

export function uploadProfilePhoto({
  storageKey,
  accountId,
  optimizedImage,
}) {
  return uploadObject({
    key: storageKey,
    expectedPrefix: env.AWS_S3_PROFILE_PREFIX,
    buffer: optimizedImage.buffer,
    contentType: optimizedImage.contentType,
    contentDisposition: "inline",
    cacheControl: "private, max-age=300",
    serverSideEncryption: "AES256",
    metadata: {
      "account-id": String(accountId),
      width: String(optimizedImage.width),
      height: String(optimizedImage.height),
    },
  });
}
