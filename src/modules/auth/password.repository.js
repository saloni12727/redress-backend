import { QueryTypes } from "sequelize";

import { sequelize } from "../../config/database.js";

/*
|--------------------------------------------------------------------------
| Password-reset OTP challenges
|--------------------------------------------------------------------------
*/

export async function getPasswordResetOtpSendStats(email) {
  const rows = await sequelize.query(
    `
        SELECT
          MAX(created_at)
            AS last_created_at,

          CASE
            WHEN MAX(created_at)
              IS NULL
            THEN NULL

            ELSE TIMESTAMPDIFF(
              SECOND,
              MAX(created_at),
              UTC_TIMESTAMP()
            )
          END
            AS seconds_since_last_send,

          SUM(
            CASE
              WHEN created_at >=
                DATE_SUB(
                  UTC_TIMESTAMP(),
                  INTERVAL 1 HOUR
                )
              THEN 1
              ELSE 0
            END
          )
            AS sends_in_window

        FROM auth_otp_challenges

        WHERE purpose =
          'password_reset'

          AND channel =
            'email'

          AND destination =
            :email
      `,
    {
      replacements: {
        email,
      },

      type: QueryTypes.SELECT,
    },
  );

  return {
    lastCreatedAt: rows[0]?.last_created_at ?? null,

    secondsSinceLastSend:
      rows[0]?.seconds_since_last_send === null
        ? null
        : Number(rows[0]?.seconds_since_last_send),

    sendsInWindow: Number(rows[0]?.sends_in_window ?? 0),
  };
}

/*
 * A newly issued reset code must invalidate any earlier usable code for the
 * same email address. This prevents two reset challenges from being valid at
 * the same time when a user requests another code.
 */
export async function supersedePendingPasswordResetChallenges(email) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_otp_challenges

      SET
        status = 'superseded',
        updated_at = :now

      WHERE purpose = 'password_reset'
        AND channel = 'email'
        AND destination = :email
        AND status = 'pending'
    `,
    {
      replacements: {
        email,
        now,
      },
    },
  );
}

export async function createPasswordResetOtpChallenge({
  challengeUuid,
  email,
  codeHash,
  maxAttempts,
  locale,
  expiresAt,
}) {
  await sequelize.query(
    `
      INSERT INTO auth_otp_challenges
      (
        challenge_uuid,
        channel,
        destination,
        phone,
        purpose,

        code_hash,
        attempts,
        max_attempts,
        status,
        locale,

        signup_token_hash,
        signup_jti,
        signup_expires_at,

        reset_token_hash,
        reset_expires_at,

        verified_at,
        consumed_at,
        expires_at,

        created_at,
        updated_at
      )
      VALUES
      (
        :challengeUuid,
        'email',
        :email,
        NULL,
        'password_reset',

        :codeHash,
        0,
        :maxAttempts,
        'pending',
        :locale,

        NULL,
        NULL,
        NULL,

        NULL,
        NULL,

        NULL,
        NULL,
        :expiresAt,

        UTC_TIMESTAMP(),
        UTC_TIMESTAMP()
      )
    `,
    {
      replacements: {
        challengeUuid,
        email,
        codeHash,
        maxAttempts,
        locale,
        expiresAt,
      },
    },
  );
}

export async function markPasswordResetOtpDeliveryFailed(challengeUuid) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_otp_challenges

      SET
        status = 'delivery_failed',
        updated_at = :now

      WHERE challenge_uuid = :challengeUuid
        AND purpose = 'password_reset'
    `,
    {
      replacements: {
        challengeUuid,
        now,
      },
    },
  );
}

export async function findLatestPendingPasswordResetOtpForUpdate(
  email,
  transaction,
) {
  const rows = await sequelize.query(
    `
      SELECT *

      FROM auth_otp_challenges

      WHERE purpose = 'password_reset'
        AND channel = 'email'
        AND destination = :email
        AND status = 'pending'

      ORDER BY id DESC

      LIMIT 1

      FOR UPDATE
    `,
    {
      replacements: {
        email,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function registerFailedPasswordResetOtpAttempt(
  { challengeId, attempts, status },
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_otp_challenges

      SET
        attempts = :attempts,
        status = :status,
        updated_at = :now

      WHERE id = :challengeId
        AND purpose = 'password_reset'
    `,
    {
      replacements: {
        challengeId,
        attempts,
        status,
        now,
      },

      transaction,
    },
  );
}

export async function markPasswordResetOtpExpired(challengeId, transaction) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_otp_challenges

      SET
        status = 'expired',
        updated_at = :now

      WHERE id = :challengeId
        AND purpose = 'password_reset'
    `,
    {
      replacements: {
        challengeId,
        now,
      },

      transaction,
    },
  );
}

export async function markPasswordResetOtpVerified(
  { challengeId, resetTokenHash, resetExpiresAt },
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_otp_challenges

      SET
        status = 'verified',

        verified_at = :now,

        reset_token_hash =
          :resetTokenHash,

        reset_expires_at =
          :resetExpiresAt,

        updated_at = :now

      WHERE id = :challengeId
        AND purpose = 'password_reset'
        AND status = 'pending'
    `,
    {
      replacements: {
        challengeId,

        resetTokenHash,

        resetExpiresAt,

        now,
      },

      transaction,
    },
  );
}

export async function findPasswordResetChallengeByTokenHashForUpdate(
  resetTokenHash,
  transaction,
) {
  const rows = await sequelize.query(
    `
      SELECT *

      FROM auth_otp_challenges

      WHERE purpose = 'password_reset'

        AND reset_token_hash =
          :resetTokenHash

        AND status = 'verified'

      LIMIT 1

      FOR UPDATE
    `,
    {
      replacements: {
        resetTokenHash,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function consumePasswordResetChallenge(challengeId, transaction) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_otp_challenges

      SET
        status = 'consumed',

        consumed_at = :now,

        reset_token_hash = NULL,

        reset_expires_at = NULL,

        updated_at = :now

      WHERE id = :challengeId
        AND purpose = 'password_reset'
        AND status = 'verified'
    `,
    {
      replacements: {
        challengeId,
        now,
      },

      transaction,
    },
  );
}

/*
|--------------------------------------------------------------------------
| Accounts used by password flows
|--------------------------------------------------------------------------
*/

export async function findPasswordAccountByEmail(email, transaction = null) {
  const rows = await sequelize.query(
    `
      SELECT *

      FROM accounts

      WHERE LOWER(email) =
        LOWER(:email)

      LIMIT 1
    `,
    {
      replacements: {
        email,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function findPasswordAccountByEmailForUpdate(email, transaction) {
  const rows = await sequelize.query(
    `
      SELECT *

      FROM accounts

      WHERE LOWER(email) =
        LOWER(:email)

      LIMIT 1

      FOR UPDATE
    `,
    {
      replacements: {
        email,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function findPasswordAccountByIdForUpdate(accountId, transaction) {
  const rows = await sequelize.query(
    `
      SELECT *

      FROM accounts

      WHERE id = :accountId

      LIMIT 1

      FOR UPDATE
    `,
    {
      replacements: {
        accountId,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function updateAccountPassword(
  { accountId, passwordHash },
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE accounts

      SET
        password_hash =
          :passwordHash,

        updated_at = :now

      WHERE id =
        :accountId
    `,
    {
      replacements: {
        accountId,
        passwordHash,
        now,
      },

      transaction,
    },
  );
}

/*
|--------------------------------------------------------------------------
| Sessions
|--------------------------------------------------------------------------
*/

export async function revokeAllAccountSessionsForPasswordReset(
  accountId,
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_sessions

      SET
        status = 'revoked',

        revoked_at = :now,

        revoke_reason =
          'password_reset',

        updated_at = :now

      WHERE account_id =
        :accountId

        AND status =
          'active'
    `,
    {
      replacements: {
        accountId,
        now,
      },

      transaction,
    },
  );
}

export async function revokeOtherAccountSessionsForPasswordChange(
  accountId,
  currentSessionUuid,
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_sessions

      SET
        status = 'revoked',

        revoked_at = :now,

        revoke_reason =
          'password_changed',

        updated_at = :now

      WHERE account_id =
        :accountId

        AND session_uuid <>
          :currentSessionUuid

        AND status =
          'active'
    `,
    {
      replacements: {
        accountId,

        currentSessionUuid,

        now,
      },

      transaction,
    },
  );
}
