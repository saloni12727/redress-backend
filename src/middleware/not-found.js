import { AppError } from "../utils/app-error.js";

export function notFoundMiddleware(request, response, next) {
  return next(
    new AppError({
      message: "Route not found",

      statusCode: 404,

      errorCode: "NOT_FOUND",

      messageKey: "errorNotFound",

      details: {
        retryable: false,

        method: request.method,

        path: request.path,
      },
    }),
  );
}
