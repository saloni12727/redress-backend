import pino from "pino";
import pinoHttp from "pino-http";

import { env } from "./env.js";

const apiPrefixPattern = env.API_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mediaTokenPattern = new RegExp(
  `(${apiPrefixPattern}/media/)[^/?#]+(?=$|[?#])`,
  "g",
);

export function redactUrl(url) {
  return url?.replace(mediaTokenPattern, "$1[REDACTED]") ?? null;
}

export function serializeRequestForLog(request) {
  const serialized = pinoHttp.stdSerializers.req(request);

  /*
   * Request headers are intentionally excluded from routine access logs. They
   * create noisy multi-line output and can contain identifiers introduced by
   * proxies, devices, or future clients. Authentication failures still carry
   * the request ID needed to inspect the corresponding structured error.
   */
  return {
    id: serialized.id,
    method: serialized.method,
    url: redactUrl(serialized.url),
  };
}

export function serializeResponseForLog(response) {
  return {
    statusCode: response.statusCode,
  };
}

const usePrettyTransport =
  env.NODE_ENV !== "production" && env.LOG_LEVEL !== "silent";

const transport =
  !usePrettyTransport
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: Boolean(process.stdout.isTTY),
          singleLine: false,
          translateTime: "SYS:standard",
          ignore: "pid,hostname,application,environment",
        },
      };

export const logger = pino({
  level: env.LOG_LEVEL,

  ...(transport ? { transport } : {}),

  base: {
    application: env.APP_NAME,
    environment: env.NODE_ENV,
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  redact: {
    paths: [
      "password",
      "*.password",
      "*.*.password",

      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "req.params.token",
      "request.headers.authorization",
      "request.headers.cookie",
      "request.headers['x-api-key']",

      "req.body",
      "request.body",

      "accessToken",
      "*.accessToken",
      "*.*.accessToken",

      "refreshToken",
      "*.refreshToken",
      "*.*.refreshToken",

      "apiKey",
      "*.apiKey",
      "*.*.apiKey",

      "secret",
      "*.secret",
      "*.*.secret",
    ],

    censor: "[REDACTED]",
  },
});
