import { getAuthConfig } from "../config/auth.config.js";

export function requireRecentAuthentication(req, res, next) {
  const authenticatedAt = req.auth?.authenticatedAt
    ? new Date(req.auth.authenticatedAt)
    : null;

  const authenticatedAtMs = authenticatedAt?.getTime();
  const maxAgeMs = getAuthConfig().sensitiveActionTtlSeconds * 1000;

  if (
    !Number.isFinite(authenticatedAtMs) ||
    Date.now() - authenticatedAtMs > maxAgeMs
  ) {
    return res.status(403).json({
      errorCode: "REAUTHENTICATION_REQUIRED",
      messageKey: "errorReauthenticationRequired",
      details: {
        retryable: false,
        reason: "recent_authentication_required",
      },
    });
  }

  return next();
}
