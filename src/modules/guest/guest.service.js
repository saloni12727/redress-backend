import { createHash, randomUUID } from "node:crypto";

import { sequelize } from "../../config/database.js";

import { createGuestToken, verifyGuestToken } from "./guest-token.service.js";

import {
  createGuestSession,
  findActiveGuestByInstallationForUpdate,
  findGuestSessionByUuid,
  touchGuestSession,
  updateGuestSessionForResume,
} from "./guest.repository.js";

/*
|--------------------------------------------------------------------------
| Error
|--------------------------------------------------------------------------
*/

export class GuestServiceError extends Error {
  constructor({ statusCode, errorCode, messageKey, details }) {
    super(errorCode);

    this.name = "GuestServiceError";

    this.statusCode = statusCode;

    this.errorCode = errorCode;

    this.messageKey = messageKey;

    this.details = details ?? {
      retryable: false,
    };
  }
}

function guestClosed(reason) {
  return new GuestServiceError({
    statusCode: 401,

    errorCode: "GUEST_SESSION_CLOSED",

    messageKey: "errorUnauthorized",

    details: {
      retryable: true,

      reason,
    },
  });
}

/*
|--------------------------------------------------------------------------
| Installation Hash
|--------------------------------------------------------------------------
*/

function hashInstallationId(installationId) {
  return createHash("sha256").update(installationId).digest("hex");
}

/*
|--------------------------------------------------------------------------
| Create / Resume
|--------------------------------------------------------------------------
*/

export async function createOrResumeGuestSession({
  installationId,

  platform,
  appVersion,
  locale,
}) {
  const installationIdHash = hashInstallationId(installationId);

  const transaction = await sequelize.transaction();

  try {
    const existing = await findActiveGuestByInstallationForUpdate({
      installationIdHash,

      platform,

      transaction,
    });

    /*
     * Same Flutter installation exists but guest token
     * has been lost/expired.
     *
     * Reissue a new guest token and increment token version,
     * invalidating old guest tokens.
     */
    if (existing) {
      const nextTokenVersion = Number(existing.token_version) + 1;

      const guestToken = createGuestToken({
        sessionUuid: existing.session_uuid,

        tokenVersion: nextTokenVersion,
      });

      await updateGuestSessionForResume({
        guestSessionId: existing.id,

        tokenVersion: nextTokenVersion,

        appVersion,

        locale,

        expiresAt: guestToken.expiresAt,

        transaction,
      });

      await transaction.commit();

      return {
        guestSessionId: existing.session_uuid,

        guestToken: guestToken.token,

        expiresAt: guestToken.expiresAt,
      };
    }

    /*
     * Brand-new installation.
     */
    const sessionUuid = randomUUID();

    const tokenVersion = 1;

    const guestToken = createGuestToken({
      sessionUuid,

      tokenVersion,
    });

    await createGuestSession({
      sessionUuid,

      installationIdHash,

      tokenVersion,

      platform,
      appVersion,
      locale,

      expiresAt: guestToken.expiresAt,

      transaction,
    });

    await transaction.commit();

    return {
      guestSessionId: sessionUuid,

      guestToken: guestToken.token,

      expiresAt: guestToken.expiresAt,
    };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Validate Existing Guest Token
|--------------------------------------------------------------------------
*/

export async function validateGuestSessionToken({
  guestToken,
  appVersion = null,
  locale = "it",
  touch = false,
}) {
  let claims;

  try {
    claims = verifyGuestToken(guestToken);
  } catch {
    throw guestClosed("invalid_guest_token");
  }

  const session = await findGuestSessionByUuid(claims.sid);

  if (!session) {
    throw guestClosed("guest_session_missing");
  }

  if (session.status !== "active") {
    throw guestClosed("guest_session_inactive");
  }

  if (new Date(session.expires_at) <= new Date()) {
    throw guestClosed("guest_session_expired");
  }

  if (Number(session.token_version) !== Number(claims.ver)) {
    throw guestClosed("guest_token_replaced");
  }

  if (touch) {
    await touchGuestSession({
      sessionUuid: session.session_uuid,

      appVersion,

      locale,
    });
  }

  return {
    guestSessionId: session.session_uuid,

    platform: session.platform,

    locale: session.locale,

    expiresAt: session.expires_at,
  };
}
