import { env } from "../config/env.js";

import { AppError } from "../utils/app-error.js";
import { safeErrorForLog } from "../utils/safe-error.js";
import {
  logUnhandledRequestError,
  shouldIgnoreRequestLog,
} from "./smart-request-logger.js";

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  /*
  |--------------------------------------------------------------------------
  | Invalid JSON
  |--------------------------------------------------------------------------
  */

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return new AppError({
      message: "Invalid JSON request body",

      statusCode: 400,

      errorCode: "VALIDATION",

      messageKey: "errorValidation",

      details: {
        retryable: false,

        fields: {
          body: "invalid_json",
        },
      },
    });
  }

  if (error?.type === "entity.too.large" || error?.status === 413) {
    return new AppError({
      message: "Request body is too large",
      statusCode: 413,
      errorCode: "PAYLOAD_TOO_LARGE",
      messageKey: "errorPayloadTooLarge",
      details: {
        retryable: false,
        reason: "profile_photo_too_large",
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Unexpected Error
  |--------------------------------------------------------------------------
  */

  return new AppError({
    message: "Unexpected server error",

    statusCode: 500,

    errorCode: "INTERNAL",

    messageKey: "errorGeneric",

    details: {
      retryable: true,
    },
  });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const normalizedError = normalizeError(error);

  if (!shouldIgnoreRequestLog(request)) {
    logUnhandledRequestError({
      request,
      response,
      normalizedError,
      safeError:
        normalizedError.statusCode >= 500
          ? safeErrorForLog(error, {
              includeStack: env.NODE_ENV !== "production",
            })
          : {
              name: normalizedError.name,
              message: normalizedError.message,
            },
    });
  }

  return response.status(normalizedError.statusCode).json({
    success: false,
    data: null,
    message:
      normalizedError.statusCode >= 500
        ? "An unexpected error occurred. Please try again later."
        : normalizedError.message,
  });
}
