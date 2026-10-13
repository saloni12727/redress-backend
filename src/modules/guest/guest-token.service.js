import jwt from "jsonwebtoken";

import { getAuthConfig } from "../../config/auth.config.js";

/*
|--------------------------------------------------------------------------
| Create Guest JWT
|--------------------------------------------------------------------------
|
| Guest token is completely separate from:
|
| - account access token
| - account refresh token
|
| typ = guest
|
*/

export function createGuestToken({ sessionUuid, tokenVersion }) {
  const config = getAuthConfig();

  const token = jwt.sign(
    {
      sid: sessionUuid,

      typ: "guest",

      ver: tokenVersion,
    },

    config.guestSecret,

    {
      algorithm: "HS256",

      subject: sessionUuid,

      issuer: config.issuer,

      audience: config.guestAudience,

      expiresIn: config.guestTtlSeconds,
    },
  );

  return {
    token,

    expiresAt: new Date(Date.now() + config.guestTtlSeconds * 1000),
  };
}

/*
|--------------------------------------------------------------------------
| Verify Guest JWT
|--------------------------------------------------------------------------
*/

export function verifyGuestToken(token) {
  const config = getAuthConfig();

  const payload = jwt.verify(token, config.guestSecret, {
    algorithms: ["HS256"],

    issuer: config.issuer,

    audience: config.guestAudience,
  });

  if (
    typeof payload !== "object" ||
    payload.typ !== "guest" ||
    !payload.sid ||
    !payload.sub ||
    !Number.isInteger(payload.ver)
  ) {
    throw new Error("Invalid guest token.");
  }

  return payload;
}
