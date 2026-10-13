import multer from "multer";

import {
  getImageUploadPolicy,
  isClaimedMimeTypeAllowed,
  normalizeMediaMimeType,
} from "../config/media.config.js";
import { AppError } from "../utils/app-error.js";

const MAX_FORM_FIELDS = 5;

function mediaUploadError({ reason, fieldName, statusCode = 422 }) {
  const isPayloadTooLarge = statusCode === 413;

  return new AppError({
    message: isPayloadTooLarge ? "Media file is too large" : "Invalid media upload",
    statusCode,
    errorCode: isPayloadTooLarge ? "PAYLOAD_TOO_LARGE" : "UNPROCESSABLE",
    messageKey: isPayloadTooLarge
      ? "errorPayloadTooLarge"
      : "errorUnprocessable",
    details: {
      retryable: false,
      reason,
      fields: {
        [fieldName]: reason,
      },
    },
  });
}

function baseContentType(request) {
  return normalizeMediaMimeType(request.get("content-type"));
}

function normalizeMulterError(error, policy) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return mediaUploadError({
        reason: "media_file_too_large",
        fieldName: policy.fieldName,
        statusCode: 413,
      });
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      return mediaUploadError({
        reason: "too_many_media_files",
        fieldName: policy.fieldName,
      });
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return mediaUploadError({
        reason:
          error.field === policy.fieldName
            ? "too_many_media_files"
            : "invalid_media_field",
        fieldName: policy.fieldName,
      });
    }

    if (
      error.code === "LIMIT_FIELD_COUNT" ||
      error.code === "LIMIT_PART_COUNT" ||
      error.code === "LIMIT_FIELD_VALUE"
    ) {
      return mediaUploadError({
        reason: "invalid_multipart_request",
        fieldName: policy.fieldName,
      });
    }
  }

  return mediaUploadError({
    reason: "invalid_multipart_request",
    fieldName: policy.fieldName,
  });
}

function normalizeFile(file) {
  return {
    buffer: file.buffer,
    originalName: file.originalname ?? null,
    claimedMimeType: normalizeMediaMimeType(file.mimetype),
    sizeBytes: file.size ?? file.buffer.length,
  };
}

/*
|--------------------------------------------------------------------------
| Reusable multipart image parser
|--------------------------------------------------------------------------
|
| This is intentionally only a parser and inexpensive request guard. It does
| not upload to S3; feature services own validation, storage, and database
| compensation so failed authorization or DB work cannot orphan objects.
|
*/

export function createImageUploadMiddleware(
  policyInput,
  {
    mode = "single",
    required = true,
    maxFields = MAX_FORM_FIELDS,
    maxFieldBytes = 1024,
  } = {},
) {
  const policy =
    typeof policyInput === "string"
      ? getImageUploadPolicy(policyInput)
      : policyInput;

  if (!policy || typeof policy !== "object") {
    throw new Error("An image upload policy is required.");
  }

  if (!new Set(["single", "array"]).has(mode)) {
    throw new Error(`Unsupported image upload mode: ${mode}`);
  }

  if (!Number.isInteger(maxFields) || maxFields < 0 || maxFields > 50) {
    throw new Error("maxFields must be an integer between 0 and 50.");
  }

  if (
    !Number.isInteger(maxFieldBytes) ||
    maxFieldBytes < 1 ||
    maxFieldBytes > 64 * 1024
  ) {
    throw new Error("maxFieldBytes must be an integer between 1 and 65536.");
  }

  const parser = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: policy.maxBytes,
      files: policy.maxFiles,
      fields: maxFields,
      parts: policy.maxFiles + maxFields,
      fieldSize: maxFieldBytes,
    },
    fileFilter(request, file, callback) {
      if (!isClaimedMimeTypeAllowed(policy, file.mimetype)) {
        callback(
          mediaUploadError({
            reason: "unsupported_media_type",
            fieldName: policy.fieldName,
          }),
        );
        return;
      }

      callback(null, true);
    },
  });

  const parse =
    mode === "single"
      ? parser.single(policy.fieldName)
      : parser.array(policy.fieldName, policy.maxFiles);

  return function imageUploadMiddleware(request, response, next) {
    const contentType = baseContentType(request);

    if (contentType !== "multipart/form-data") {
      return next(
        mediaUploadError({
          reason: "invalid_multipart_request",
          fieldName: policy.fieldName,
        }),
      );
    }

    if (!/boundary=/i.test(request.get("content-type") ?? "")) {
      return next(
        mediaUploadError({
          reason: "invalid_multipart_request",
          fieldName: policy.fieldName,
        }),
      );
    }

    return parse(request, response, (error) => {
      if (error) {
        return next(normalizeMulterError(error, policy));
      }

      const files = mode === "single" ? [request.file] : request.files ?? [];
      const presentFiles = files.filter(Boolean);

      if (required && presentFiles.length === 0) {
        return next(
          mediaUploadError({
            reason: "media_file_required",
            fieldName: policy.fieldName,
          }),
        );
      }

      if (presentFiles.length === 0) {
        return next();
      }

      const normalizedFiles = presentFiles.map(normalizeFile);
      const totalBytes = normalizedFiles.reduce(
        (total, file) => total + file.sizeBytes,
        0,
      );

      if (totalBytes > policy.maxTotalBytes) {
        return next(
          mediaUploadError({
            reason: "media_files_total_too_large",
            fieldName: policy.fieldName,
            statusCode: 413,
          }),
        );
      }

      if (mode === "single") {
        request.mediaFile = normalizedFiles[0];
      } else {
        request.mediaFiles = normalizedFiles;
      }

      return next();
    });
  };
}

export const profileImageUpload = createImageUploadMiddleware("profile");
export const productImagesUpload = createImageUploadMiddleware("product", {
  mode: "array",
});
export const brandLogoUpload = createImageUploadMiddleware("brandLogo");
export const vendorLogoUpload = createImageUploadMiddleware("vendorLogo");
