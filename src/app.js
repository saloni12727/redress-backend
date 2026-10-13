import express from "express";

import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { isAllowedCorsOrigin } from "./config/cors.config.js";
import {
  logger,
  serializeRequestForLog,
  serializeResponseForLog,
} from "./config/logger.js";

import { requestIdMiddleware } from "./middleware/request-id.js";
import { apiRateLimiter } from "./middleware/rate-limit.js";
import { notFoundMiddleware } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createSmartRequestLogger } from "./middleware/smart-request-logger.js";

import apiRouter from "./routes/index.js";

import { AppError } from "./utils/app-error.js";
import { localeMiddleware } from "./middleware/locale.js";
const app = express();

app.set("trust proxy", env.TRUST_PROXY);

/*
|--------------------------------------------------------------------------
| Basic Security
|--------------------------------------------------------------------------
*/

app.disable("x-powered-by");

app.use(helmet());

/*
|--------------------------------------------------------------------------
| Request ID
|--------------------------------------------------------------------------
*/

app.use(requestIdMiddleware);

/*
|--------------------------------------------------------------------------
| Request Logging
|--------------------------------------------------------------------------
*/

app.use(
  pinoHttp({
    logger,

    /* Smart request logging below prevents routine traffic from flooding the console. */
    autoLogging: false,

    serializers: {
      req: serializeRequestForLog,
      res: serializeResponseForLog,
    },

    genReqId(request) {
      return request.id;
    },
  }),
);

app.use(createSmartRequestLogger());

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
|
| Flutter/native requests normally do not have a browser Origin header,
| so they are allowed.
|
| Next.js/browser requests must come from an explicitly allowed origin.
|
| credentials: true is required because Next.js will use:
|
| - HttpOnly refresh cookie
| - HttpOnly guest cookie
|
*/

app.use(
  cors({
    origin(origin, callback) {
      /*
       * No Origin:
       *
       * - Flutter
       * - Postman
       * - curl
       * - server-to-server
       */
      if (!origin) {
        return callback(null, true);
      }

      /*
       * Trusted browser origin.
       */
      if (isAllowedCorsOrigin(origin, env)) {
        return callback(null, true);
      }

      return callback(
        new AppError({
          message: "Origin is not allowed",

          statusCode: 403,

          errorCode: "CORS_ORIGIN_NOT_ALLOWED",

          messageKey: "errors.corsOriginNotAllowed",
        }),
      );
    },

    /*
     * Required for browser HttpOnly cookies.
     */
    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Accept-Language",
      "X-Request-Id",
      "X-Requested-With",
      "X-Client-Timezone",
      "X-App-Contract",

      /*
       * Flutter guest requests use this header.
       *
       * Browser guest requests use HttpOnly cookie instead.
       */
      "X-Guest-Token",
    ],

    exposedHeaders: ["X-Request-Id", "Content-Language"],
  }),
);

/*
|--------------------------------------------------------------------------
| Compression
|--------------------------------------------------------------------------
*/

app.use(compression());

/*
|--------------------------------------------------------------------------
| Cookies
|--------------------------------------------------------------------------
|
| Required for:
|
| Next.js refresh token:
| redress_refresh
|
| Next.js guest token:
| redress_guest
|
*/

app.use(cookieParser());
app.use(localeMiddleware);

/*
|--------------------------------------------------------------------------
| Request Body
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit: "2mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,

    limit: "2mb",
  }),
);

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
|
| Example:
|
| /api/v1/health
| /api/v1/auth/login
| /api/v1/auth/refresh
| /api/v1/guest/sessions
| /api/v1/catalog/products
|
*/

app.use(env.API_PREFIX, apiRateLimiter, apiRouter);

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use(notFoundMiddleware);

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
|
| Always keep this middleware last.
|
*/

app.use(errorHandler);

export default app;
