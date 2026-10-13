import { logger, redactUrl } from "../config/logger.js";
import { env } from "../config/env.js";
import { safeErrorForLog } from "../utils/safe-error.js";

const QUIET_SUCCESS_PATHS = ["/health", "/media/", "/docs"];
const IGNORED_REQUEST_PATHS = ["/favicon.ico"];

function elapsedMilliseconds(startedAt) {
  return Math.max(
    0,
    Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6),
  );
}

function requestPath(request) {
  const url = redactUrl(request.originalUrl ?? request.url ?? "/") ?? "/";

  return url.split("?")[0];
}

function compactText(value, maximumLength = 160) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[\r\n\t]+/g, " ").trim();

  return normalized ? normalized.slice(0, maximumLength) : null;
}

function responseSummary(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const fields = payload.details?.fields;

  return {
    message: compactText(payload.message),
    errorCode: compactText(payload.errorCode, 80),
    fieldNames:
      fields && typeof fields === "object" && !Array.isArray(fields)
        ? Object.keys(fields).slice(0, 12)
        : [],
  };
}

function pathIncludes(request, paths) {
  const path = requestPath(request);

  return paths.some((entry) => path.endsWith(entry) || path.includes(entry));
}

export function shouldIgnoreRequestLog(request) {
  return pathIncludes(request, IGNORED_REQUEST_PATHS);
}

function describeSuccess(request, summary) {
  if (request.method === "POST" && requestPath(request).endsWith("/auth/signup")) {
    const fullName = compactText(request.body?.fullName, 80);

    return fullName
      ? `Registration successful for ${fullName}.`
      : "Registration successful.";
  }

  return summary?.message ?? "Request completed successfully.";
}

function divider(title) {
  return `[${title}] ------------------------------------------------`;
}

function formatFailure({ request, response, summary, durationMs }) {
  const lines = [
    divider("API REJECTED"),
    `Status : ${response.statusCode} ${request.method} ${requestPath(request)} (${durationMs} ms)`,
    `Request: ${request.id ?? "unknown"}`,
    `Code   : ${summary?.errorCode ?? "HTTP_ERROR"}`,
    `Message: ${summary?.message ?? "The request was not completed."}`,
  ];

  if (summary?.fieldNames?.length) {
    lines.push(`Fields : ${summary.fieldNames.join(", ")}`);
  }

  lines.push("---------------------------------------------------------------");

  return lines.join("\n");
}

/* Only public response metadata is recorded; bodies, headers and tokens are not. */
export function createSmartRequestLogger({ log = logger } = {}) {
  return function smartRequestLogger(request, response, next) {
    const startedAt = process.hrtime.bigint();

    response.locals.requestStartedAt = startedAt;

    const originalJson = response.json.bind(response);

    response.json = function captureResponseSummary(payload) {
      response.locals.smartResponseSummary = responseSummary(payload);

      return originalJson(payload);
    };

    response.once("finish", () => {
      if (shouldIgnoreRequestLog(request)) {
        return;
      }

      const durationMs = elapsedMilliseconds(startedAt);
      const summary = response.locals.smartResponseSummary;

      if (response.statusCode >= 400) {
        if (!response.locals.smartErrorLogged) {
          log.warn(formatFailure({ request, response, summary, durationMs }));
        }

        return;
      }

      if (
        response.statusCode >= 200 &&
        response.statusCode < 400 &&
        request.method !== "OPTIONS" &&
        !pathIncludes(request, QUIET_SUCCESS_PATHS)
      ) {
        log.info(
          `OK ${response.statusCode} ${request.method} ${requestPath(request)} | ${describeSuccess(request, summary)} (${durationMs} ms)`,
        );
      }
    });

    next();
  };
}

export function logUnhandledRequestError({
  request,
  response,
  normalizedError,
  safeError,
}) {
  response.locals.smartErrorLogged = true;

  const startedAt = response.locals.requestStartedAt;
  const durationMs = startedAt ? elapsedMilliseconds(startedAt) : null;
  const isServerError = normalizedError.statusCode >= 500;
  const title = isServerError ? "API FAILED" : "API REJECTED";
  const message = [
    divider(title),
    `Status : ${normalizedError.statusCode} ${request.method} ${requestPath(request)}${durationMs === null ? "" : ` (${durationMs} ms)`}`,
    `Request: ${request.id ?? "unknown"}`,
    `Code   : ${normalizedError.errorCode}`,
    `Message: ${normalizedError.message}`,
    "---------------------------------------------------------------",
  ].join("\n");

  if (isServerError) {
    logger.error({ error: safeError }, message);
    return;
  }

  logger.warn(message);
}

export function logCaughtRouteError({ request, response, error, component }) {
  response.locals.smartErrorLogged = true;

  const startedAt = response.locals.requestStartedAt;
  const durationMs = startedAt ? elapsedMilliseconds(startedAt) : null;

  logger.error(
    {
      error: safeErrorForLog(error, {
        includeStack: env.NODE_ENV !== "production",
      }),
    },
    [
      divider("API FAILED"),
      `Status : 500 ${request.method} ${requestPath(request)}${durationMs === null ? "" : ` (${durationMs} ms)`}`,
      `Request: ${request.id ?? "unknown"}`,
      `Component: ${component}`,
      "Message: An unexpected route error occurred.",
      "---------------------------------------------------------------",
    ].join("\n"),
  );
}
