import { rateLimit } from "express-rate-limit";

import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,

  limit: env.RATE_LIMIT_MAX,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  skip(request) {
    return !env.RATE_LIMIT_ENABLED || request.path.startsWith("/health");
  },

  handler(request, response, next) {
    return next(
      new AppError({
        message: "Too many requests",

        statusCode: 429,

        errorCode: "RATE_LIMITED",

        messageKey: "errorRateLimited",

        details: {
          retryable: true,

          retryAfter: response.getHeader("Retry-After") ?? null,
        },
      }),
    );
  },
});
