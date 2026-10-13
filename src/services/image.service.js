import fs from "node:fs/promises";
import path from "node:path";

import { buildProductImageKey } from "./s3.service.js";
import { processImage } from "./media/image-processor.service.js";
import { uploadProcessedImage } from "./media/media-storage.service.js";

const MIME_BY_EXTENSION = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

function mimeTypeForFilePath(filePath) {
  return MIME_BY_EXTENSION.get(path.extname(filePath).toLowerCase()) ?? "";
}

/*
|--------------------------------------------------------------------------
| Starter product image compatibility facade
|--------------------------------------------------------------------------
|
| Product image CRUD does not exist yet. The starter script continues to
| accept local files and deterministic code/slot keys, but all image decoding
| and WebP output now comes from the canonical processor.
|
*/

export async function optimizeProductImage(filePath) {
  const stats = await fs.stat(filePath);

  if (!stats.isFile()) {
    throw new Error(`Product image is not a valid file: ${filePath}`);
  }

  const buffer = await fs.readFile(filePath);

  const processed = await processImage({
    buffer,
    claimedMimeType: mimeTypeForFilePath(filePath),
    policy: "product",
  });

  return {
    ...processed,
    /* Preserve the historical return property used by the starter script. */
    mimeType: processed.contentType,
  };
}

export async function uploadProductImage({ filePath, productCode, slot }) {
  const optimized = await optimizeProductImage(filePath);
  const storageKey = buildProductImageKey(productCode, slot);

  const uploadResult = await uploadProcessedImage({
    processedImage: optimized,
    storageKey,

    /*
     * Starter paths are deterministic and may be replaced in development, so
     * they are cacheable but intentionally not immutable.
     */
    cacheControl: "public, max-age=86400",
    metadata: {
      "product-code": String(productCode),
      "image-slot": String(slot),
    },
  });

  return {
    storageKey: uploadResult.storageKey,
    width: uploadResult.width,
    height: uploadResult.height,
    sizeBytes: uploadResult.sizeBytes,
    mimeType: uploadResult.contentType,
    etag: uploadResult.etag,
  };
}
