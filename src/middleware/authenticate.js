import jwt from "jsonwebtoken";

import { verifyAccessToken } from "../modules/auth/token.service.js";

import { findAuthContext } from "../modules/auth/auth.repository.js";

function sendUnauthorized(res, { errorCode, reason }) {
  return res.status(401).json({
    errorCode,

    messageKey: "errorUnauthorized",

    details: {
      retryable: false,

      reason,
    },
  });
}

function sendStandardUnauthorized(res) {
  return res.status(401).json({
    success: false,
    data: null,
    message: "Authentication is required to access this resource.",
  });
}

function sendStandardForbidden(res) {
  return res.status(403).json({
    success: false,
    data: null,
    message: "You do not have permission to perform this action.",
  });
}

async function authenticateRequest(req, res, next, { standardResponse = false }) {
  const unauthorized = ({ errorCode, reason }) =>
    standardResponse
      ? sendStandardUnauthorized(res)
      : sendUnauthorized(res, { errorCode, reason });

  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return unauthorized({
        errorCode: "SESSION_CLOSED",

        reason: "missing_token",
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return unauthorized({
        errorCode: "SESSION_CLOSED",

        reason: "missing_token",
      });
    }

    let claims;

    try {
      claims = verifyAccessToken(token);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return unauthorized({
          errorCode: "SESSION_EXPIRED",

          reason: "access_token_expired",
        });
      }

      return unauthorized({
        errorCode: "SESSION_CLOSED",

        reason: "invalid_token",
      });
    }

    const accountId = claims.sub;

    const sessionUuid = claims.sid;

    /*
     * Signed JWT is not enough.
     *
     * Backend still checks the server session,
     * which makes logout/revocation immediate.
     */
    const authContext = await findAuthContext(sessionUuid, accountId);

    if (!authContext || authContext.session_status !== "active") {
      return unauthorized({
        errorCode: "SESSION_CLOSED",

        reason: "session_revoked",
      });
    }

    if (new Date(authContext.session_expires_at) <= new Date()) {
      return unauthorized({
        errorCode: "SESSION_CLOSED",

        reason: "session_expired",
      });
    }

    if (authContext.account_status !== "active") {
      return standardResponse
        ? sendStandardForbidden(res)
        : res.status(403).json({
            errorCode: "FORBIDDEN",

            messageKey: "errorForbidden",

            details: {
              retryable: false,

              reason: "account_not_active",
            },
          });
    }

    req.auth = {
      accountId: String(accountId),

      sessionUuid,

      authMethod: authContext.auth_method ?? "unknown",

      authenticatedAt: authContext.authenticated_at,

      roles: Array.isArray(claims.roles) ? claims.roles : [],
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

export async function authenticate(req, res, next) {
  return authenticateRequest(req, res, next, { standardResponse: false });
}

/*
 * New management modules use the project-wide { success, data, message }
 * contract. Existing public/auth routes retain their established legacy
 * envelope until they are migrated as a separately versioned change.
 */
export async function authenticateStandard(req, res, next) {
  return authenticateRequest(req, res, next, { standardResponse: true });
}
