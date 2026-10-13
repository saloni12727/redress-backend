import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";

let s3Client = null;
const SAFE_OBJECT_KEY = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;

/*
|--------------------------------------------------------------------------
| AWS Configuration
|--------------------------------------------------------------------------
|
| AWS SDK automatically reads:
|
| AWS_ACCESS_KEY_ID
| AWS_SECRET_ACCESS_KEY
|
| from process.env.
|
| So credentials never need to be passed manually into code.
|
*/

function getS3Config() {
  return {
    region: env.AWS_REGION,
    bucketName: env.AWS_S3_BUCKET_NAME,
  };
}

function getS3Client() {
  if (s3Client) {
    return s3Client;
  }

  const { region } = getS3Config();

  /*
   * Do not manually pass access key and secret here.
   *
   * AWS SDK's default credential provider will automatically use
   * AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.
   *
   * Later in production this also allows us to move to IAM Roles
   * without changing application code.
   */
  s3Client = new S3Client({
    region,
    maxAttempts: 3,
  });

  return s3Client;
}

function validateObjectKey(key, expectedPrefix) {
  const normalizedPrefix =
    typeof expectedPrefix === "string"
      ? expectedPrefix.replace(/\/+$/, "")
      : "";

  if (
    typeof key !== "string" ||
    !SAFE_OBJECT_KEY.test(key) ||
    key.includes("..") ||
    key.startsWith("/") ||
    (normalizedPrefix &&
      key !== normalizedPrefix &&
      !key.startsWith(`${normalizedPrefix}/`))
  ) {
    throw new Error("S3 object key is invalid.");
  }

  return key;
}

/*
|--------------------------------------------------------------------------
| Key Helpers
|--------------------------------------------------------------------------
*/

function cleanPathSegment(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanKeyPrefix(value) {
  const segments = String(value)
    .split("/")
    .map(cleanPathSegment)
    .filter(Boolean);

  if (segments.length === 0) {
    throw new Error("A storage key prefix is required.");
  }

  return segments.join("/");
}

/*
|--------------------------------------------------------------------------
| Generic media-key helper
|--------------------------------------------------------------------------
|
| Features may keep their own public helper for compatibility, but permanent
| client uploads must use a generated ID rather than an original filename.
|
*/

export function buildMediaObjectKey({
  prefix,
  segments = [],
  mediaId = randomUUID(),
  extension = "webp",
}) {
  const normalizedPrefix = cleanKeyPrefix(prefix);
  const normalizedSegments = segments.map(cleanPathSegment).filter(Boolean);
  const normalizedMediaId = cleanPathSegment(mediaId);
  const normalizedExtension = cleanPathSegment(extension);

  if (!normalizedMediaId || !normalizedExtension) {
    throw new Error("A media ID and file extension are required.");
  }

  return [
    normalizedPrefix,
    ...normalizedSegments,
    `${normalizedMediaId}.${normalizedExtension}`,
  ].join("/");
}

export function buildProductImageKey(productCode, slot) {
  const safeProductCode = cleanPathSegment(productCode);

  const safeSlot = cleanPathSegment(slot);

  if (!safeProductCode || !safeSlot) {
    throw new Error("Product code and image slot are required.");
  }

  return [
    env.AWS_S3_PRODUCT_PREFIX,
    safeProductCode,
    `${safeSlot}.webp`,
  ].join("/");
}

export function buildProfilePhotoKey(accountId, photoId) {
  return buildMediaObjectKey({
    prefix: env.AWS_S3_PROFILE_PREFIX,
    segments: [accountId],
    mediaId: photoId,
  });
}

export function buildBodyPhotoKey(accountId, mediaId = randomUUID()) {
  return buildMediaObjectKey({
    prefix: env.AWS_S3_PROFILE_PREFIX,
    segments: [accountId, "body"],
    mediaId,
  });
}

export function buildProductUploadKey(productId, mediaId = randomUUID()) {
  return buildMediaObjectKey({
    prefix: env.AWS_S3_PRODUCT_PREFIX,
    segments: [productId],
    mediaId,
  });
}

export function buildProductVariantImageKey({
  productId,
  variantId,
  mediaId = randomUUID(),
}) {
  return buildMediaObjectKey({
    prefix: env.AWS_S3_PRODUCT_PREFIX,
    segments: [productId, "variants", variantId],
    mediaId,
  });
}

export function buildBrandLogoKey(brandId, mediaId = randomUUID()) {
  return buildMediaObjectKey({
    prefix: "brands",
    segments: [brandId],
    mediaId,
  });
}

export function buildVendorLogoKey(vendorId, mediaId = randomUUID()) {
  return buildMediaObjectKey({
    prefix: "vendors",
    segments: [vendorId],
    mediaId,
  });
}

/*
|--------------------------------------------------------------------------
| Bucket Access Check
|--------------------------------------------------------------------------
*/

export async function assertS3Access() {
  const { bucketName } = getS3Config();

  const client = getS3Client();

  await client.send(
    new HeadBucketCommand({
      Bucket: bucketName,
    }),
  );

  return true;
}

/*
|--------------------------------------------------------------------------
| Upload
|--------------------------------------------------------------------------
*/

export async function uploadObject({
  key,
  buffer,
  contentType,
  cacheControl,
  contentDisposition,
  metadata,
  serverSideEncryption,
  expectedPrefix,
}) {
  const objectKey = validateObjectKey(key, expectedPrefix);

  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Upload body must be a Buffer.");
  }

  const { bucketName } = getS3Config();

  const client = getS3Client();

  const result = await client.send(
    new PutObjectCommand({
      Bucket: bucketName,

      Key: objectKey,

      Body: buffer,

      ContentType: contentType,

      ContentDisposition: contentDisposition,

      /*
       * We intentionally do not use:
       *
       * ACL: "public-read"
       *
       * Bucket should stay private.
       */
      CacheControl: cacheControl ?? "private, no-store",

      Metadata: metadata,

      ServerSideEncryption: serverSideEncryption ?? "AES256",
    }),
  );

  return {
    key: objectKey,

    bucketName,

    etag: result.ETag ?? null,
  };
}

/* Existing callers use this name; retain it while new media code uses the
 * storage-neutral uploadObject name. */
export const uploadToS3 = uploadObject;

/*
|--------------------------------------------------------------------------
| Object Exists
|--------------------------------------------------------------------------
*/

export async function objectExists(key, { expectedPrefix } = {}) {
  const objectKey = validateObjectKey(key, expectedPrefix);
  const { bucketName } = getS3Config();

  const client = getS3Client();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucketName,

        Key: objectKey,
      }),
    );

    return true;
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode;

    if (statusCode === 404 || error?.name === "NotFound") {
      return false;
    }

    throw error;
  }
}

export const s3ObjectExists = objectExists;

export async function getObject(key, { expectedPrefix } = {}) {
  const objectKey = validateObjectKey(key, expectedPrefix);
  const { bucketName } = getS3Config();
  const client = getS3Client();

  return client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );
}

/*
|--------------------------------------------------------------------------
| Delete
|--------------------------------------------------------------------------
|
| Not used by our starter seed immediately,
| but required later by Admin/Vendor product media management.
|
*/

export async function deleteObject(key, { expectedPrefix } = {}) {
  const objectKey = validateObjectKey(key, expectedPrefix);
  const { bucketName } = getS3Config();

  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,

      Key: objectKey,
    }),
  );

  return true;
}

export const deleteFromS3 = deleteObject;
