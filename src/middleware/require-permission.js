import { accountHasPermission } from "../modules/auth/auth.repository.js";

export function requirePermission(permissionCode) {
  return requirePermissionMiddleware(permissionCode, { standardResponse: false });
}

export function requirePermissionStandard(permissionCode) {
  return requirePermissionMiddleware(permissionCode, { standardResponse: true });
}

function requirePermissionMiddleware(permissionCode, { standardResponse }) {
  return async function permissionMiddleware(req, res, next) {
    try {
      if (!req.auth?.accountId) {
        if (standardResponse) {
          return res.status(401).json({
            success: false,
            data: null,
            message: "Authentication is required to access this resource.",
          });
        }

        return res.status(401).json({
          errorCode: "SESSION_CLOSED",

          messageKey: "errorUnauthorized",

          details: {
            retryable: false,

            reason: "missing_auth_context",
          },
        });
      }

      const allowed = await accountHasPermission(
        req.auth.accountId,
        permissionCode,
      );

      if (!allowed) {
        if (standardResponse) {
          return res.status(403).json({
            success: false,
            data: null,
            message: "You do not have permission to perform this action.",
          });
        }

        return res.status(403).json({
          errorCode: "FORBIDDEN",

          messageKey: "errorForbidden",

          details: {
            retryable: false,

            permission: permissionCode,
          },
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
