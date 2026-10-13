import { getAuthConfig } from "../config/auth.config.js";

import {
  GuestServiceError,
  validateGuestSessionToken,
} from "../modules/guest/guest.service.js";

function getGuestToken(req) {
  const config = getAuthConfig();

  /*
   * Flutter
   */
  const headerToken = req.get("x-guest-token");

  if (headerToken) {
    return headerToken;
  }

  /*
   * Next.js browser
   */
  return req.cookies?.[config.guestCookieName] ?? null;
}

export async function authenticateGuest(req, res, next) {
  try {
    const guestToken = getGuestToken(req);

    if (!guestToken) {
      return res.status(401).json({
        errorCode: "GUEST_SESSION_CLOSED",

        messageKey: "errorUnauthorized",

        details: {
          retryable: true,

          reason: "missing_guest_token",
        },
      });
    }

    const guest = await validateGuestSessionToken({
      guestToken,

      touch: false,
    });

    req.guest = {
      sessionUuid: guest.guestSessionId,

      platform: guest.platform,

      locale: guest.locale,
    };

    return next();
  } catch (error) {
    if (error instanceof GuestServiceError) {
      return res.status(error.statusCode).json({
        errorCode: error.errorCode,

        messageKey: error.messageKey,

        details: error.details,
      });
    }

    return next(error);
  }
}
