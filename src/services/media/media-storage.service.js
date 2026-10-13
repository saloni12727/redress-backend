import { getImageUploadPolicy } from "../../config/media.config.js";
import {
  deleteObject,
  uploadObject,
} from "../s3.service.js";
import { processImage } from "./image-processor.service.js";
import { createMediaUrl } from "../media-url.service.js";

function resolveFileInput(file) {
  return {
    buffer: file?.buffer,
    claimedMimeType: file?.claimedMimeType ?? file?.contentType,
  };
}

export async function uploadProcessedImage({
  processedImage,
  storageKey,
  cacheControl,
  contentDisposition,
  metadata,
  serverSideEncryption,
}) {
  const uploadResult = await uploadObject({
    key: storageKey,
    buffer: processedImage.buffer,
    contentType: processedImage.contentType,
    cacheControl,
    contentDisposition,
    metadata,
    serverSideEncryption,
  });

  return {
    storageKey,
    contentType: processedImage.contentType,
    extension: processedImage.extension,
    width: processedImage.width,
    height: processedImage.height,
    sizeBytes: processedImage.sizeBytes,
    etag: uploadResult.etag,
  };
}

/*
|--------------------------------------------------------------------------
| Common image-to-private-storage pipeline
|--------------------------------------------------------------------------
|
| Feature services call this only after authorization and business checks.
| They remain responsible for recording the returned storage key and for
| compensating if their database transaction cannot be completed.
|
*/

export async function processAndUploadImage({
  file,
  policyName,
  policy,
  storageKey,
  cacheControl,
  contentDisposition,
  metadata,
  serverSideEncryption,
}) {
  const resolvedPolicy = policy ?? getImageUploadPolicy(policyName);
  const { buffer, claimedMimeType } = resolveFileInput(file);
  const processedImage = await processImage({
    buffer,
    claimedMimeType,
    policy: resolvedPolicy,
  });

  return uploadProcessedImage({
    processedImage,
    storageKey,
    cacheControl,
    contentDisposition,
    metadata,
    serverSideEncryption,
  });
}

export async function deleteStoredMedia(storageKey) {
  if (!storageKey) {
    return false;
  }

  await deleteObject(storageKey);
  return true;
}

export function getMediaUrl(storageKey) {
  return createMediaUrl(storageKey);
}
