import { env } from "./env.js";

const WEB_IMAGE_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const GENERIC_BINARY_MIME_TYPES = Object.freeze([
  "",
  "application/octet-stream",
]);

function definePolicy(policy) {
  return Object.freeze({
    ...policy,
    allowedMimeTypes: Object.freeze([...policy.allowedMimeTypes]),
    acceptedClaimedMimeTypes: Object.freeze([
      ...policy.allowedMimeTypes,
      ...(policy.allowGenericBinaryMime ? GENERIC_BINARY_MIME_TYPES : []),
    ]),
  });
}

/*
|--------------------------------------------------------------------------
| Image upload policies
|--------------------------------------------------------------------------
|
| This module is deliberately about image rules, not routes or storage.
| Large videos and body-scan media must use direct/presigned uploads later;
| they must never be added to this memory-backed image upload path.
|
*/

export const IMAGE_UPLOAD_POLICIES = Object.freeze({
  profile: definePolicy({
    fieldName: "image",
    maxFiles: 1,
    maxBytes: env.PROFILE_PHOTO_MAX_BYTES,
    maxTotalBytes: env.PROFILE_PHOTO_MAX_BYTES,
    allowedMimeTypes: WEB_IMAGE_MIME_TYPES,
    allowGenericBinaryMime: true,
    minWidth: 128,
    minHeight: 128,
    maxWidth: 1024,
    maxHeight: 1024,
    maxPixels: 40_000_000,
    allowAnimation: false,
    outputFormat: "webp",
    quality: 82,
    fit: "inside",
  }),

  /* Stored privately for the body-profile editor and virtual try-on only. */
  bodyPhoto: definePolicy({
    fieldName: "file",
    maxFiles: 1,
    maxBytes: 8 * 1024 * 1024,
    maxTotalBytes: 8 * 1024 * 1024,
    allowedMimeTypes: WEB_IMAGE_MIME_TYPES,
    allowGenericBinaryMime: false,
    minWidth: 256,
    minHeight: 256,
    maxWidth: 2048,
    maxHeight: 2048,
    maxPixels: 40_000_000,
    allowAnimation: false,
    outputFormat: "webp",
    quality: 84,
    fit: "inside",
  }),

  /* These files are decoded in memory for estimation and are never stored. */
  bodyMeasurement: definePolicy({
    fieldName: "photo",
    maxFiles: 2,
    maxBytes: 8 * 1024 * 1024,
    maxTotalBytes: 16 * 1024 * 1024,
    allowedMimeTypes: WEB_IMAGE_MIME_TYPES,
    allowGenericBinaryMime: false,
    minWidth: 256,
    minHeight: 256,
    maxWidth: 2048,
    maxHeight: 2048,
    maxPixels: 40_000_000,
    allowAnimation: false,
    outputFormat: "webp",
    quality: 84,
    fit: "inside",
  }),

  product: definePolicy({
    fieldName: "images",
    maxFiles: 10,
    maxBytes: 15 * 1024 * 1024,
    /* Keep an array upload bounded even when every individual file is valid. */
    maxTotalBytes: 50 * 1024 * 1024,
    allowedMimeTypes: WEB_IMAGE_MIME_TYPES,
    allowGenericBinaryMime: false,
    minWidth: 500,
    minHeight: 500,
    maxWidth: 1600,
    maxHeight: 2000,
    maxPixels: 40_000_000,
    allowAnimation: false,
    outputFormat: "webp",
    quality: 85,
    fit: "inside",
  }),

  brandLogo: definePolicy({
    fieldName: "logo",
    maxFiles: 1,
    maxBytes: 5 * 1024 * 1024,
    maxTotalBytes: 5 * 1024 * 1024,
    allowedMimeTypes: WEB_IMAGE_MIME_TYPES,
    allowGenericBinaryMime: false,
    minWidth: 128,
    minHeight: 128,
    maxWidth: 1024,
    maxHeight: 1024,
    maxPixels: 40_000_000,
    allowAnimation: false,
    outputFormat: "webp",
    quality: 85,
    fit: "inside",
  }),

  homePlacement: definePolicy({
    fieldName: "image",
    maxFiles: 1,
    maxBytes: 15 * 1024 * 1024,
    maxTotalBytes: 15 * 1024 * 1024,
    allowedMimeTypes: WEB_IMAGE_MIME_TYPES,
    allowGenericBinaryMime: false,
    minWidth: 500,
    minHeight: 500,
    /*
     * The section-specific service validates the final aspect ratio and
     * minimum dimensions. These bounds must be large enough to retain the
     * 1080x1350 lookbook creative after WebP normalization.
     */
    maxWidth: 2400,
    maxHeight: 2400,
    maxPixels: 40_000_000,
    allowAnimation: false,
    outputFormat: "webp",
    quality: 85,
    fit: "inside",
  }),

  vendorLogo: definePolicy({
    fieldName: "logo",
    maxFiles: 1,
    maxBytes: 5 * 1024 * 1024,
    maxTotalBytes: 5 * 1024 * 1024,
    allowedMimeTypes: WEB_IMAGE_MIME_TYPES,
    allowGenericBinaryMime: false,
    minWidth: 128,
    minHeight: 128,
    maxWidth: 1024,
    maxHeight: 1024,
    maxPixels: 40_000_000,
    allowAnimation: false,
    outputFormat: "webp",
    quality: 85,
    fit: "inside",
  }),
});

export function getImageUploadPolicy(policyName) {
  const policy = IMAGE_UPLOAD_POLICIES[policyName];

  if (!policy) {
    throw new Error(`Unknown image upload policy: ${policyName}`);
  }

  return policy;
}

export function normalizeMediaMimeType(value) {
  return typeof value === "string"
    ? value.split(";", 1)[0].trim().toLowerCase()
    : "";
}

export function isClaimedMimeTypeAllowed(policy, claimedMimeType) {
  return policy.acceptedClaimedMimeTypes.includes(
    normalizeMediaMimeType(claimedMimeType),
  );
}
