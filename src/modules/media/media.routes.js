import { Router } from "express";

import { getObject } from "../../services/s3.service.js";
import { resolveMediaUrlToken } from "../../services/media-url.service.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../utils/app-error.js";
import { safeErrorForLog } from "../../utils/safe-error.js";
import { authenticateStandard } from "../../middleware/authenticate.js";
import { createImageUploadMiddleware } from "../../middleware/media-upload.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { uploadBodyPhotoController } from "../shopper-fit/shopper-fit.controller.js";

const router = Router();
const allowedContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

router.post(
  "/",
  authenticateStandard,
  createImageUploadMiddleware("bodyPhoto"),
  asyncHandler(uploadBodyPhotoController),
);

function mediaNotFound() {
  return new AppError({
    message: "Media object not found",
    statusCode: 404,
    errorCode: "MEDIA_NOT_FOUND",
    messageKey: "errorNotFound",
    details: { retryable: false },
  });
}

function unsupportedMedia() {
  return new AppError({
    message: "Media content type is not supported",
    statusCode: 502,
    errorCode: "MEDIA_CONTENT_UNSUPPORTED",
    messageKey: "errorGeneric",
    details: { retryable: false },
  });
}

function mapStorageError(error) {
  if (
    error?.$metadata?.httpStatusCode === 404 ||
    error?.name === "NoSuchKey" ||
    error?.name === "NotFound"
  ) {
    return mediaNotFound();
  }

  logger.error(
    { error: safeErrorForLog(error) },
    [
      "[MEDIA STORAGE ERROR] ----------------------------------------",
      `Provider status : ${error?.$metadata?.httpStatusCode ?? "unknown"}`,
      `Provider request: ${error?.$metadata?.requestId ?? "unknown"}`,
      "Message         : The media object could not be retrieved.",
      "---------------------------------------------------------------",
    ].join("\n"),
  );

  return new AppError({
    message: "Media storage is temporarily unavailable",
    statusCode: 503,
    errorCode: "MEDIA_STORAGE_UNAVAILABLE",
    messageKey: "errorGeneric",
    details: { retryable: true },
  });
}

router.get("/:token", async (request, response, next) => {
  const storageKey = resolveMediaUrlToken(request.params.token);
  if (!storageKey) {
    return next(mediaNotFound());
  }

  let object;
  try {
    object = await getObject(storageKey);
  } catch (error) {
    return next(mapStorageError(error));
  }

  const contentType = object.ContentType?.toLowerCase();
  if (!allowedContentTypes.has(contentType)) {
    object.Body?.destroy?.();
    return next(unsupportedMedia());
  }

  if (!object.Body || typeof object.Body.pipe !== "function") {
    return next(
      new AppError({
        message: "Media response body is unavailable",
        statusCode: 502,
        errorCode: "MEDIA_STORAGE_INVALID_RESPONSE",
        messageKey: "errorGeneric",
        details: { retryable: true },
      }),
    );
  }

  response.set({
    "Content-Type": contentType,
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=300",
    /*
     * The web panel and API run on different origins in development (and may
     * do so in production). Media is an intentionally public-to-the-browser
     * representation of an opaque, time-limited URL, so it must be loadable
     * by an <img> element outside of the API origin.
     */
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
  });

  if (Number.isSafeInteger(object.ContentLength) && object.ContentLength >= 0) {
    response.set("Content-Length", String(object.ContentLength));
  }

  if (typeof object.ETag === "string") {
    response.set("ETag", object.ETag);
  }

  object.Body.once("error", (error) => {
    logger.error(
      { error: safeErrorForLog(error) },
      [
        "[MEDIA STREAM ERROR] -----------------------------------------",
        "Message: The media response stream failed after retrieval.",
        "---------------------------------------------------------------",
      ].join("\n"),
    );

    if (response.headersSent) {
      response.destroy();
      return;
    }

    next(mapStorageError(error));
  });

  response.once("close", () => {
    if (!response.writableEnded) {
      object.Body.destroy();
    }
  });

  object.Body.pipe(response);
});

export default router;
