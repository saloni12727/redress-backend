import sharp from "sharp";

import {
  getImageUploadPolicy,
  isClaimedMimeTypeAllowed,
  normalizeMediaMimeType,
} from "../../config/media.config.js";

const FORMAT_BY_MIME_TYPE = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const ACCEPTED_INPUT_FORMATS = new Set(FORMAT_BY_MIME_TYPE.values());

export class MediaValidationError extends Error {
  constructor(reason, diagnostics = undefined) {
    super(reason);
    this.name = "MediaValidationError";
    this.reason = reason;
    this.diagnostics = diagnostics;
  }
}

function resolvePolicy(policy) {
  if (typeof policy === "string") {
    return getImageUploadPolicy(policy);
  }

  if (!policy || typeof policy !== "object") {
    throw new Error("An image upload policy is required.");
  }

  return policy;
}

function normalizedSharpFormat(format) {
  return format === "jpg" ? "jpeg" : format;
}

/*
|--------------------------------------------------------------------------
| Canonical image validation and optimization
|--------------------------------------------------------------------------
|
| MIME types are an inexpensive client hint only. Sharp must decode the
| bytes, and the decoded format must agree with an explicit JPEG/PNG/WebP
| claim before an object can be stored.
|
*/

export async function processImage({ buffer, claimedMimeType, policy }) {
  const resolvedPolicy = resolvePolicy(policy);
  const normalizedClaimedMimeType = normalizeMediaMimeType(claimedMimeType);
  const claimedFormat = FORMAT_BY_MIME_TYPE.get(normalizedClaimedMimeType);

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new MediaValidationError("media_file_required");
  }

  if (buffer.length > resolvedPolicy.maxBytes) {
    throw new MediaValidationError("media_file_too_large");
  }

  if (
    normalizedClaimedMimeType &&
    !isClaimedMimeTypeAllowed(resolvedPolicy, normalizedClaimedMimeType)
  ) {
    throw new MediaValidationError("unsupported_media_type", {
      claimedMimeType: normalizedClaimedMimeType,
    });
  }

  let image;
  let metadata;

  try {
    image = sharp(buffer, {
      animated: true,
      failOn: "error",
      limitInputPixels: resolvedPolicy.maxPixels,
    });
    metadata = await image.metadata();
  } catch {
    throw new MediaValidationError("invalid_media_file");
  }

  const actualFormat = normalizedSharpFormat(metadata.format);

  if (!actualFormat || !ACCEPTED_INPUT_FORMATS.has(actualFormat)) {
    throw new MediaValidationError("unsupported_media_type", {
      actualFormat: actualFormat ?? "unknown",
    });
  }

  if (claimedFormat && claimedFormat !== actualFormat) {
    throw new MediaValidationError("media_type_mismatch", {
      claimedMimeType: normalizedClaimedMimeType,
      actualFormat,
    });
  }

  if (!resolvedPolicy.allowAnimation && (metadata.pages ?? 1) !== 1) {
    throw new MediaValidationError("animated_media_not_allowed");
  }

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < resolvedPolicy.minWidth ||
    metadata.height < resolvedPolicy.minHeight
  ) {
    throw new MediaValidationError("media_dimensions_too_small", {
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    });
  }

  try {
    const result = await image
      .rotate()
      .resize({
        width: resolvedPolicy.maxWidth,
        height: resolvedPolicy.maxHeight,
        fit: resolvedPolicy.fit,
        withoutEnlargement: true,
      })
      .webp({
        quality: resolvedPolicy.quality,
        effort: 4,
      })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      contentType: "image/webp",
      extension: "webp",
      width: result.info.width,
      height: result.info.height,
      sizeBytes: result.info.size,
    };
  } catch {
    throw new MediaValidationError("invalid_media_file");
  }
}
