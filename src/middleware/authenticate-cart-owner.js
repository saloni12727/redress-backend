import { getAuthConfig } from "../config/auth.config.js";

import {
  GuestServiceError,
  validateGuestSessionToken,
} from "../modules/guest/guest.service.js";

import { authenticateStandard } from "./authenticate.js";

export function getGuestTokenFromRequest(req) {
  const config = getAuthConfig();

  return (
    req.get("x-guest-token") ?? req.cookies?.[config.guestCookieName] ?? null
  );
}

function hasBearerToken(req) {
  const authorization = req.get("authorization");

  return (
    typeof authorization === "string" && /^Bearer\s+\S+/i.test(authorization)
  );
}

function sendGuestUnauthorized(
  res,
) {
  return res.status(401).json({
    success: false,
    data: null,
    message: "Your guest session is invalid or has expired.",
  });
}

export function authenticateCartOwner(req, res, next) {
  /*
   * Logged-in customer.
   *
   * If Authorization Bearer exists, account identity always wins.
   */
  if (hasBearerToken(req)) {
    return authenticateStandard(req, res, (error) => {
      if (error) {
        return next(error);
      }

      req.cartOwner = {
        accountId: req.auth.accountId,
        guestSessionId: null,
      };

      return next();
    });
  }

  /*
   * Anonymous guest.
   */
  const guestToken = getGuestTokenFromRequest(req);

  if (!guestToken) {
    return sendGuestUnauthorized(res);
  }

  return validateGuestSessionToken({
    guestToken,
    touch: false,
  })
    .then((guest) => {
      req.cartOwner = {
        accountId: null,
        guestSessionId: guest.guestSessionId,
      };

      return next();
    })
    .catch((error) => {
      if (error instanceof GuestServiceError) {
        return sendGuestUnauthorized(res);
      }

      return next(error);
    });
}
