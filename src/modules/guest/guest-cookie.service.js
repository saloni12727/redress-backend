import { getAuthConfig } from "../../config/auth.config.js";

import { env } from "../../config/env.js";

function guestCookiePath() {
  const prefix = env.API_PREFIX.replace(/\/+$/, "");

  return prefix || "/";
}

function guestCookieOptions() {
  const config = getAuthConfig();

  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: guestCookiePath(),
    maxAge: config.guestTtlSeconds * 1000,
  };
}

export function setGuestCookie(response, guestToken) {
  const config = getAuthConfig();

  response.cookie(config.guestCookieName, guestToken, guestCookieOptions());
}

export function clearGuestCookie(response) {
  const config = getAuthConfig();
  const options = guestCookieOptions();

  delete options.maxAge;

  response.clearCookie(config.guestCookieName, options);
}

export function getGuestCookie(request) {
  const config = getAuthConfig();

  return request.cookies?.[config.guestCookieName] ?? null;
}
