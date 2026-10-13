import { QueryTypes } from "sequelize";

import { sequelize } from "../../config/database.js";

/*
|--------------------------------------------------------------------------
| Find by Installation
|--------------------------------------------------------------------------
*/

export async function findActiveGuestByInstallationForUpdate({
  installationIdHash,
  platform,
  transaction,
}) {
  const rows = await sequelize.query(
    `
        SELECT *
        FROM guest_sessions

        WHERE installation_id_hash =
          :installationIdHash

          AND platform =
            :platform

          AND status =
            'active'

          AND expires_at >
            :now

        ORDER BY id DESC

        LIMIT 1

        FOR UPDATE
      `,
    {
      replacements: {
        installationIdHash,
        platform,
        now: new Date(),
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

/*
|--------------------------------------------------------------------------
| Create
|--------------------------------------------------------------------------
*/

export async function createGuestSession({
  sessionUuid,

  installationIdHash,

  tokenVersion,

  platform,
  appVersion,
  locale,

  expiresAt,

  transaction,
}) {
  const now = new Date();

  await sequelize.query(
    `
      INSERT INTO guest_sessions
      (
        session_uuid,
        installation_id_hash,
        token_version,

        platform,
        app_version,
        locale,

        status,
        converted_account_id,

        last_seen_at,
        expires_at,

        created_at,
        updated_at
      )
      VALUES
      (
        :sessionUuid,
        :installationIdHash,
        :tokenVersion,

        :platform,
        :appVersion,
        :locale,

        'active',
        NULL,

        :now,
        :expiresAt,

        :now,
        :now
      )
    `,
    {
      replacements: {
        sessionUuid,
        installationIdHash,
        tokenVersion,

        platform,

        appVersion: appVersion ?? null,

        locale,

        expiresAt,

        now,
      },

      transaction,
    },
  );
}

/*
|--------------------------------------------------------------------------
| Resume / Rotate Guest Token
|--------------------------------------------------------------------------
*/

export async function updateGuestSessionForResume({
  guestSessionId,

  tokenVersion,

  appVersion,
  locale,

  expiresAt,

  transaction,
}) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE guest_sessions

      SET
        token_version =
          :tokenVersion,

        app_version =
          :appVersion,

        locale =
          :locale,

        last_seen_at =
          :now,

        expires_at =
          :expiresAt,

        updated_at =
          :now

      WHERE id =
        :guestSessionId
    `,
    {
      replacements: {
        guestSessionId,

        tokenVersion,

        appVersion: appVersion ?? null,

        locale,

        expiresAt,

        now,
      },

      transaction,
    },
  );
}

/*
|--------------------------------------------------------------------------
| Find by Guest Session UUID
|--------------------------------------------------------------------------
*/

export async function findGuestSessionByUuid(sessionUuid) {
  const rows = await sequelize.query(
    `
        SELECT *
        FROM guest_sessions

        WHERE session_uuid =
          :sessionUuid

        LIMIT 1
      `,
    {
      replacements: {
        sessionUuid,
      },

      type: QueryTypes.SELECT,
    },
  );

  return rows[0] ?? null;
}

/*
|--------------------------------------------------------------------------
| Touch Existing Session
|--------------------------------------------------------------------------
*/

export async function touchGuestSession({ sessionUuid, appVersion, locale }) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE guest_sessions

      SET
        app_version =
          COALESCE(
            :appVersion,
            app_version
          ),

        locale =
          :locale,

        last_seen_at =
          :now,

        updated_at =
          :now

      WHERE session_uuid =
        :sessionUuid

        AND status =
          'active'
    `,
    {
      replacements: {
        sessionUuid,

        appVersion: appVersion ?? null,

        locale,

        now,
      },
    },
  );
}

/*
|--------------------------------------------------------------------------
| Convert Guest Later
|--------------------------------------------------------------------------
|
| This function will be used when Cart merge is implemented.
|
| DO NOT call it yet merely because login succeeded.
|
| Correct future flow:
|
| login/signup
| -> merge guest cart/data successfully
| -> mark guest converted
|
*/

export async function markGuestSessionConverted({
  sessionUuid,
  accountId,
  transaction,
}) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE guest_sessions

      SET
        status =
          'converted',

        converted_account_id =
          :accountId,

        updated_at =
          :now

      WHERE session_uuid =
        :sessionUuid

        AND status =
          'active'
    `,
    {
      replacements: {
        sessionUuid,
        accountId,
        now,
      },

      transaction,
    },
  );
}
