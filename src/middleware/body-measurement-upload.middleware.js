import multer from "multer";

import {
  getImageUploadPolicy,
  isClaimedMimeTypeAllowed,
  normalizeMediaMimeType,
} from "../config/media.config.js";
import { AppError } from "../utils/app-error.js";

const policy = getImageUploadPolicy("bodyMeasurement");

function invalidMeasurementUpload(reason, fields) {
  return new AppError({
    message: "The measurement photos are invalid.",
    statusCode: 422,
    errorCode: "UNPROCESSABLE",
    messageKey: "errorUnprocessable",
    details: { retryable: false, reason, fields },
  });
}

const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: policy.maxBytes,
    files: 2,
    fields: 3,
    parts: 5,
    fieldSize: 1024,
  },
  fileFilter(_request, file, callback) {
    if (!isClaimedMimeTypeAllowed(policy, file.mimetype)) {
      callback(invalidMeasurementUpload("unsupported_type", { [file.fieldname]: "unsupported_type" }));
      return;
    }
    callback(null, true);
  },
}).fields([
  { name: "front", maxCount: 1 },
  { name: "side", maxCount: 1 },
]);

function normalizedFile(file) {
  return {
    buffer: file.buffer,
    claimedMimeType: normalizeMediaMimeType(file.mimetype),
    sizeBytes: file.size ?? file.buffer.length,
  };
}

export function bodyMeasurementUpload(request, response, next) {
  const contentType = normalizeMediaMimeType(request.get("content-type"));
  if (contentType !== "multipart/form-data" || !/boundary=/i.test(request.get("content-type") ?? "")) {
    return next(invalidMeasurementUpload("invalid_multipart_request", { front: "required", side: "required" }));
  }
  return parser(request, response, (error) => {
    if (error) {
      const field = error.field === "side" ? "side" : "front";
      const reason = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? "too_large" : "invalid";
      return next(invalidMeasurementUpload(reason, { [field]: reason }));
    }
    const front = request.files?.front?.[0];
    const side = request.files?.side?.[0];
    const totalBytes = (front?.size ?? 0) + (side?.size ?? 0);
    if (totalBytes > policy.maxTotalBytes) {
      return next(invalidMeasurementUpload("too_large", { front: "too_large", side: "too_large" }));
    }
    request.measurementFiles = {
      ...(front ? { front: normalizedFile(front) } : {}),
      ...(side ? { side: normalizedFile(side) } : {}),
    };
    return next();
  });
}
