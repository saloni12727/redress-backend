import { randomUUID } from "node:crypto";

import {
  resolveClientType,
  UntrustedOriginError,
} from "../../utils/client-context.js";

import {
  clearGuestCookie,
  getGuestCookie,
  setGuestCookie,
} from "./guest-cookie.service.js";

import { guestSessionSchema } from "./guest.validation.js";

import {
  createOrResumeGuestSession,
  GuestServiceError,
  validateGuestSessionToken,
} from "./guest.service.js";

/*
|--------------------------------------------------------------------------
| Errors
|--------------------------------------------------------------------------
*/

function failed(response, status, message) {
  return response.status(status).json({
    success: false,
    data: null,
    message,
  });
}

function succeeded(response, status, data, message) {
  return response.status(status).json({
    success: true,
    data,
    message,
  });
}

function sendValidationError(res, validationError) {
  const fields = Object.keys(validationError.flatten().fieldErrors);

  return failed(
    res,
    400,
    `The request contains invalid fields: ${fields.join(", ") || "body"}.`,
  );
}

function handleGuestError(error, res, next) {
  if (error instanceof UntrustedOriginError) {
    return failed(res, 403, "The request origin is not allowed.");
  }

  if (error instanceof GuestServiceError) {
    return failed(
      res,
      error.statusCode,
      "Your guest session is invalid or has expired.",
    );
  }

  return next(error);
}

/*
|--------------------------------------------------------------------------
| POST /guest/sessions
|--------------------------------------------------------------------------
*/

export async function createGuestSessionController(req, res, next) {
  const parsed = guestSessionSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const clientType = resolveClientType(req);

    const {
      installationId,
      platform,
      appVersion,
      locale: requestedLocale,
    } = parsed.data;

    const locale = requestedLocale ?? req.locale;
    /*
    |--------------------------------------------------------------------------
    | NEXT.JS WEB
    |--------------------------------------------------------------------------
    */

    if (clientType === "web") {
      const existingGuestToken = getGuestCookie(req);

      /*
       * Browser already has a guest cookie.
       */
      if (existingGuestToken) {
        try {
          const existing = await validateGuestSessionToken({
            guestToken: existingGuestToken,

            appVersion,

            locale,

            touch: true,
          });

          return succeeded(
            res,
            200,
            {
              guestSessionId: existing.guestSessionId,

              expiresAt: existing.expiresAt,
            },
            "Guest session resumed successfully.",
          );
        } catch {
          /*
           * Invalid/expired/replaced guest cookie.
           */
          clearGuestCookie(res);
        }
      }

      /*
       * Browser doesn't need to know its raw installation UUID.
       *
       * Backend creates one internally.
       */
      const webInstallationId = randomUUID();

      const result = await createOrResumeGuestSession({
        installationId: webInstallationId,

        platform: "web",

        appVersion,

        locale,
      });

      setGuestCookie(res, result.guestToken);

      /*
       * Guest JWT is deliberately not exposed
       * to browser JavaScript.
       */
      return succeeded(
        res,
        201,
        {
          guestSessionId: result.guestSessionId,

          expiresAt: result.expiresAt,
        },
        "Guest session created successfully.",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | FLUTTER / NATIVE
    |--------------------------------------------------------------------------
    */

    if (!installationId) {
      return failed(
        res,
        400,
        "The request contains an invalid field: installationId.",
      );
    }

    if (platform !== "android" && platform !== "ios") {
      return failed(
        res,
        400,
        "The request contains an invalid field: platform.",
      );
    }

    /*
     * Flutter should normally reuse its stored guestToken.
     *
     * If it sends a current token here, simply reuse it.
     */
    const existingGuestToken = req.get("x-guest-token");

    if (existingGuestToken) {
      try {
        const existing = await validateGuestSessionToken({
          guestToken: existingGuestToken,

          appVersion,

          locale,

          touch: true,
        });

        return succeeded(
          res,
          200,
          {
            guestSessionId: existing.guestSessionId,

            guestToken: existingGuestToken,

            expiresAt: existing.expiresAt,
          },
          "Guest session resumed successfully.",
        );
      } catch {
        /*
         * Invalid/lost/replaced token.
         *
         * Recover using the installation UUID.
         */
      }
    }

    const result = await createOrResumeGuestSession({
      installationId,

      platform,

      appVersion,

      locale,
    });

    return succeeded(
      res,
      201,
      {
        guestSessionId: result.guestSessionId,

        guestToken: result.guestToken,

        expiresAt: result.expiresAt,
      },
      "Guest session created successfully.",
    );
  } catch (error) {
    return handleGuestError(error, res, next);
  }
}
