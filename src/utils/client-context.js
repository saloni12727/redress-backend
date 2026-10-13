import { env } from "../config/env.js";
import { isAllowedCorsOrigin } from "../config/cors.config.js";

export class UntrustedOriginError extends Error {
  constructor(origin) {
    super("Untrusted web origin.");

    this.name = "UntrustedOriginError";

    this.origin = origin;
  }
}

/*
|--------------------------------------------------------------------------
| Browser vs Native
|--------------------------------------------------------------------------
|
| Browser:
|   sends Origin header.
|
| Flutter/native:
|   normally has no browser Origin header.
|
| IMPORTANT:
| client type is used only for token transport:
|
| web    -> HttpOnly cookies
| native -> JSON refresh/guest token
|
| It is NOT used as an authorization decision.
|
*/

export function resolveClientType(req) {
  const origin = req.get("origin");

  if (!origin) {
    return "native";
  }

  if (isAllowedCorsOrigin(origin, env)) {
    return "web";
  }

  throw new UntrustedOriginError(origin);
}
