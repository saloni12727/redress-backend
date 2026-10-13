import { QueryTypes } from "sequelize";

import { sequelize } from "../../config/database.js";

/*
|--------------------------------------------------------------------------
| Accounts
|--------------------------------------------------------------------------
*/

export async function findAccountByEmail(email, transaction = null) {
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

export async function findAccountByPhone(phone, transaction = null) {
  const rows = await sequelize.query(
    `
        SELECT *
        FROM accounts

        WHERE phone =
          :phone

        LIMIT 1
      `,
    {
      replacements: {
        phone,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function findAccountById(accountId, transaction = null) {
  const rows = await sequelize.query(
    `
        SELECT *
        FROM accounts

        WHERE id =
          :accountId

        LIMIT 1
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

export async function findAccountByIdForUpdate(accountId, transaction) {
  const rows = await sequelize.query(
    `
      SELECT *
      FROM accounts
      WHERE id = :accountId
      LIMIT 1
      FOR UPDATE
    `,
    {
      replacements: { accountId },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function createAccount(
  {
    email,
    passwordHash,
    firstName,
    lastName,
    displayName,
    phone,
    phoneVerifiedAt,
    emailVerifiedAt,
    photoUrl,
    consentPrivacyAcceptedAt = null,
    consentPrivacyVersion = null,
    consentChannel = null,
    locale,
    status = "active",
  },
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      INSERT INTO accounts
      (
        email,
        password_hash,

        first_name,
        last_name,
        display_name,

        phone,
        phone_verified_at,

        email_verified_at,
        photo_url,
        consent_privacy_accepted_at,
        consent_privacy_version,
        consent_channel,
        locale,

        status,
        last_login_at,

        created_at,
        updated_at
      )
      VALUES
      (
        :email,
        :passwordHash,

        :firstName,
        :lastName,
        :displayName,

        :phone,
        :phoneVerifiedAt,

        :emailVerifiedAt,
        :photoUrl,
        :consentPrivacyAcceptedAt,
        :consentPrivacyVersion,
        :consentChannel,
        :locale,

        :status,
        NULL,

        :now,
        :now
      )
    `,
    {
      replacements: {
        email,
        passwordHash,

        firstName,
        lastName,
        displayName,

        phone,
        phoneVerifiedAt,
        emailVerifiedAt,

        photoUrl: photoUrl ?? null,
        consentPrivacyAcceptedAt,
        consentPrivacyVersion,
        consentChannel,

        locale,
        status,
        now,
      },

      transaction,
    },
  );
}

export async function updateAccountEmailVerified({ accountId }, transaction) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE accounts
      SET
        email_verified_at = COALESCE(email_verified_at, :now),
        updated_at = :now
      WHERE id = :accountId
    `,
    {
      replacements: { accountId, now },
      transaction,
    },
  );
}

export async function updateAccountEmailVerifiedAddress(
  { accountId, email },
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE accounts
      SET
        email = :email,
        email_verified_at = :now,
        updated_at = :now
      WHERE id = :accountId
    `,
    {
      replacements: { accountId, email, now },
      transaction,
    },
  );
}

export async function updateAccountPhoneVerified(
  { accountId, phone },
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE accounts

      SET
        phone =
          :phone,

        phone_verified_at =
          :now,

        updated_at =
          :now

      WHERE id =
        :accountId
    `,
    {
      replacements: {
        accountId,
        phone,
        now,
      },

      transaction,
    },
  );
}

export async function updateAccountProfile(
  {
    accountId,
    firstName,
    lastName,
    displayName,
    photoUrl,
    profilePhotoStorageKey,
    locale,
  },
  transaction = null,
) {
  const assignments = [];

  const replacements = {
    accountId,

    now: new Date(),
  };

  if (firstName !== undefined) {
    assignments.push("first_name = :firstName");

    replacements.firstName = firstName;
  }

  if (lastName !== undefined) {
    assignments.push("last_name = :lastName");

    replacements.lastName = lastName;
  }

  if (displayName !== undefined) {
    assignments.push("display_name = :displayName");

    replacements.displayName = displayName;
  }

  if (photoUrl !== undefined) {
    assignments.push("photo_url = :photoUrl");

    replacements.photoUrl = photoUrl;
  }

  if (profilePhotoStorageKey !== undefined) {
    assignments.push("profile_photo_storage_key = :profilePhotoStorageKey");

    replacements.profilePhotoStorageKey = profilePhotoStorageKey;
  }

  if (locale !== undefined) {
    assignments.push("locale = :locale");

    replacements.locale = locale;
  }

  if (assignments.length === 0) {
    return;
  }

  assignments.push("updated_at = :now");

  await sequelize.query(
    `
      UPDATE accounts

      SET
        ${assignments.join(", ")}

      WHERE id =
        :accountId
    `,
    {
      replacements,

      transaction,
    },
  );
}

export async function updateAccountPrivacyConsent(
  { accountId, acceptedAt, version, channel },
  transaction = null,
) {
  await sequelize.query(
    `
      UPDATE accounts
      SET
        consent_privacy_accepted_at = :acceptedAt,
        consent_privacy_version = :version,
        consent_channel = :channel,
        updated_at = :now
      WHERE id = :accountId
    `,
    {
      replacements: {
        accountId,
        acceptedAt,
        version,
        channel,
        now: new Date(),
      },
      transaction,
    },
  );
}

export async function createUserPrivacyConsent(
  { accountId, version, acceptedAt, channel },
  transaction = null,
) {
  const now = new Date();
  await sequelize.query(
    `
      INSERT INTO user_consents
        (account_id, kind, version, accepted_at, channel, created_at)
      VALUES
        (:accountId, 'privacy', :version, :acceptedAt, :channel, :now)
    `,
    {
      replacements: { accountId, version, acceptedAt, channel, now },
      transaction,
    },
  );
}

export async function getCurrentPrivacyPolicyVersion() {
  const rows = await sequelize.query(
    `
      SELECT updated_at
      FROM content_policies
      WHERE id = 'privacy' AND is_published = TRUE
      LIMIT 1
    `,
    { type: QueryTypes.SELECT },
  );
  return rows[0]?.updated_at ? new Date(rows[0].updated_at).toISOString() : null;
}

export async function getAccountFitSetupSnapshot(accountId) {
  const rows = await sequelize.query(
    `
      SELECT
        id,
        height_cm,
        weight_kg,
        front_media_id,
        back_media_id,
        left_media_id,
        right_media_id
      FROM body_profiles
      WHERE account_id = :accountId
        AND relation = 'self'
        AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    { replacements: { accountId }, type: QueryTypes.SELECT },
  );
  return rows[0] ?? null;
}

export async function createSignupProof(
  {
    proofUuid,
    type,
    subject,
    email,
    displayName,
    photoUrl,
    tokenHash,
    tokenJti,
    expiresAt,
  },
  transaction,
) {
  const now = new Date();
  await sequelize.query(
    `
      INSERT INTO signup_proofs
        (proof_uuid, type, subject, email, display_name, photo_url, token_hash, token_jti, consumed_at, expires_at, created_at, updated_at)
      VALUES
        (:proofUuid, :type, :subject, :email, :displayName, :photoUrl, :tokenHash, :tokenJti, NULL, :expiresAt, :now, :now)
    `,
    {
      replacements: {
        proofUuid, type, subject, email, displayName, photoUrl,
        tokenHash, tokenJti, expiresAt, now,
      },
      transaction,
    },
  );
}

export async function findSignupProofForUpdate(proofUuid, transaction) {
  const rows = await sequelize.query(
    `SELECT * FROM signup_proofs WHERE proof_uuid = :proofUuid LIMIT 1 FOR UPDATE`,
    { replacements: { proofUuid }, type: QueryTypes.SELECT, transaction },
  );
  return rows[0] ?? null;
}

export async function markSignupProofConsumed(proofId, transaction) {
  const now = new Date();
  await sequelize.query(
    `
      UPDATE signup_proofs
      SET consumed_at = :now, updated_at = :now
      WHERE id = :proofId AND consumed_at IS NULL
    `,
    { replacements: { proofId, now }, transaction },
  );
}

export async function updateLastLoginAt(accountId, transaction = null) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE accounts

      SET
        last_login_at =
          :now,

        updated_at =
          :now

      WHERE id =
        :accountId
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

/*
|--------------------------------------------------------------------------
| Roles / Permissions
|--------------------------------------------------------------------------
*/

export async function getAccountRoles(accountId, transaction = null) {
  const rows = await sequelize.query(
    `
        SELECT DISTINCT
          r.code

        FROM account_roles ar

        INNER JOIN roles r
          ON r.id =
            ar.role_id

        WHERE ar.account_id =
          :accountId

          AND r.is_active =
            TRUE

          AND r.deleted_at
            IS NULL

        ORDER BY
          r.code ASC
      `,
    {
      replacements: {
        accountId,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows.map((row) => row.code);
}

export async function findRoleByCode(roleCode, transaction = null) {
  const rows = await sequelize.query(
    `
        SELECT
          id,
          code

        FROM roles

        WHERE code =
          :roleCode

          AND is_active =
            TRUE

          AND deleted_at
            IS NULL

        LIMIT 1
      `,
    {
      replacements: {
        roleCode,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function assignAccountRole({ accountId, roleId }, transaction) {
  const now = new Date();

  await sequelize.query(
    `
      INSERT INTO account_roles
      (
        account_id,
        role_id,

        created_at,
        updated_at
      )
      VALUES
      (
        :accountId,
        :roleId,

        :now,
        :now
      )
    `,
    {
      replacements: {
        accountId,
        roleId,
        now,
      },

      transaction,
    },
  );
}

export async function accountHasPermission(accountId, permissionCode) {
  const rows = await sequelize.query(
    `
        SELECT
          p.id

        FROM account_roles ar

        INNER JOIN roles r
          ON r.id =
            ar.role_id

        INNER JOIN role_permissions rp
          ON rp.role_id =
            r.id

        INNER JOIN permissions p
          ON p.id =
            rp.permission_id

        WHERE ar.account_id =
          :accountId

          AND p.code =
            :permissionCode

          AND r.is_active =
            TRUE

          AND r.deleted_at
            IS NULL

          AND p.is_active =
            TRUE

        LIMIT 1
      `,
    {
      replacements: {
        accountId,
        permissionCode,
      },

      type: QueryTypes.SELECT,
    },
  );

  return Boolean(rows[0]?.id);
}

/*
|--------------------------------------------------------------------------
| External identities
|--------------------------------------------------------------------------
*/

export async function findIdentityByProviderSubject(
  provider,
  providerSubject,
  transaction = null,
) {
  const rows = await sequelize.query(
    `
        SELECT *
        FROM account_identities

        WHERE provider =
          :provider

          AND provider_subject =
            :providerSubject

        LIMIT 1
      `,
    {
      replacements: {
        provider,
        providerSubject,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function createAccountIdentity(
  { accountId, provider, providerSubject, providerEmail },
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      INSERT INTO account_identities
      (
        account_id,

        provider,
        provider_subject,
        provider_email,

        created_at,
        updated_at
      )
      VALUES
      (
        :accountId,

        :provider,
        :providerSubject,
        :providerEmail,

        :now,
        :now
      )
    `,
    {
      replacements: {
        accountId,

        provider,
        providerSubject,

        providerEmail: providerEmail ?? null,

        now,
      },

      transaction,
    },
  );
}

export async function findIdentityByAccountProvider(
  accountId,
  provider,
  transaction = null,
) {
  const rows = await sequelize.query(
    `
      SELECT *
      FROM account_identities
      WHERE account_id = :accountId
        AND provider = :provider
      LIMIT 1
    `,
    {
      replacements: { accountId, provider },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function updateAccountIdentityProviderEmail(
  { identityId, providerEmail },
  transaction = null,
) {
  await sequelize.query(
    `
      UPDATE account_identities
      SET
        provider_email = :providerEmail,
        updated_at = :now
      WHERE id = :identityId
    `,
    {
      replacements: {
        identityId,
        providerEmail,
        now: new Date(),
      },
      transaction,
    },
  );
}

export async function fillAccountGoogleProfileIfMissing(
  { accountId, firstName, lastName, displayName, photoUrl },
  transaction = null,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE accounts
      SET
        first_name = CASE
          WHEN (first_name IS NULL OR TRIM(first_name) = '')
            THEN :firstName
          ELSE first_name
        END,
        last_name = CASE
          WHEN (last_name IS NULL OR TRIM(last_name) = '')
            THEN :lastName
          ELSE last_name
        END,
        display_name = CASE
          WHEN (display_name IS NULL OR TRIM(display_name) = '')
            THEN :displayName
          ELSE display_name
        END,
        photo_url = CASE
          WHEN (photo_url IS NULL OR TRIM(photo_url) = '')
            THEN :photoUrl
          ELSE photo_url
        END,
        updated_at = :now
      WHERE id = :accountId
    `,
    {
      replacements: {
        accountId,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        displayName: displayName ?? null,
        photoUrl: photoUrl ?? null,
        now,
      },
      transaction,
    },
  );
}

/*
|--------------------------------------------------------------------------
| Google identity linking attempts
|--------------------------------------------------------------------------
*/

export async function supersedePendingIdentityLinkAttempts(
  provider,
  providerSubject,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_identity_link_attempts

      SET
        status =
          'superseded',

        updated_at =
          :now

      WHERE provider =
        :provider

        AND provider_subject =
          :providerSubject

        AND status IN
          (
            'pending',
            'verified'
          )
    `,
    {
      replacements: {
        provider,
        providerSubject,
        now,
      },
    },
  );
}

export async function createIdentityLinkAttempt(
  {
    attemptUuid,

    provider,
    providerSubject,
    providerEmail,
    displayName,

    tokenHash,
    tokenJti,

    expiresAt,
  },
  transaction = null,
) {
  const now = new Date();

  await sequelize.query(
    `
      INSERT INTO auth_identity_link_attempts
      (
        attempt_uuid,

        provider,
        provider_subject,
        provider_email,
        display_name,

        token_hash,
        token_jti,

        status,

        verified_phone,
        verified_at,
        consumed_at,

        expires_at,

        created_at,
        updated_at
      )
      VALUES
      (
        :attemptUuid,

        :provider,
        :providerSubject,
        :providerEmail,
        :displayName,

        :tokenHash,
        :tokenJti,

        'pending',

        NULL,
        NULL,
        NULL,

        :expiresAt,

        :now,
        :now
      )
    `,
    {
      replacements: {
        attemptUuid,

        provider,
        providerSubject,

        providerEmail: providerEmail ?? null,

        displayName: displayName ?? null,

        tokenHash,
        tokenJti,
        expiresAt,
        now,
      },

      transaction,
    },
  );
}

export async function findIdentityLinkAttemptForUpdate(
  attemptUuid,
  transaction,
) {
  const rows = await sequelize.query(
    `
        SELECT *
        FROM auth_identity_link_attempts

        WHERE attempt_uuid =
          :attemptUuid

        LIMIT 1

        FOR UPDATE
      `,
    {
      replacements: {
        attemptUuid,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function markIdentityLinkVerified(
  { attemptId, phone },
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_identity_link_attempts

      SET
        status =
          'verified',

        verified_phone =
          :phone,

        verified_at =
          :now,

        updated_at =
          :now

      WHERE id =
        :attemptId

        AND status =
          'pending'
    `,
    {
      replacements: {
        attemptId,
        phone,
        now,
      },

      transaction,
    },
  );
}

export async function markIdentityLinkConsumed(attemptId, transaction) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_identity_link_attempts

      SET
        status =
          'consumed',

        consumed_at =
          :now,

        updated_at =
          :now

      WHERE id =
        :attemptId
    `,
    {
      replacements: {
        attemptId,
        now,
      },

      transaction,
    },
  );
}

/*
|--------------------------------------------------------------------------
| OTP
|--------------------------------------------------------------------------
*/

export async function getOtpSendStats(purpose, channel, destination) {
  const rows = await sequelize.query(
    `
      SELECT
        MAX(created_at) AS last_created_at,

        CASE
          WHEN MAX(created_at) IS NULL THEN NULL
          ELSE TIMESTAMPDIFF(
            SECOND,
            MAX(created_at),
            UTC_TIMESTAMP()
          )
        END AS seconds_since_last_send,

        SUM(
          CASE
            WHEN created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)
            THEN 1
            ELSE 0
          END
        ) AS sends_in_window

      FROM auth_otp_challenges

      WHERE purpose = :purpose
        AND channel = :channel
        AND destination = :destination
    `,
    {
      replacements: {
        purpose,
        channel,
        destination,
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

export async function supersedePendingOtpChallenges(
  purpose,
  channel,
  destination,
  accountId = null,
) {
  await sequelize.query(
    `
      UPDATE auth_otp_challenges

      SET
        status = 'superseded',
        updated_at = UTC_TIMESTAMP()

      WHERE purpose = :purpose
        AND channel = :channel
        AND destination = :destination
        AND account_id <=> :accountId
        AND status = 'pending'
    `,
    {
      replacements: {
        purpose,
        channel,
        destination,
        accountId,
      },
    },
  );
}

export async function createOtpChallenge({
  challengeUuid,
  purpose,
  channel,
  destination,
  accountId = null,
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
        account_id,
        purpose,
        channel,
        destination,
        phone,

        code_hash,
        attempts,
        max_attempts,
        status,
        locale,

        signup_token_hash,
        signup_jti,
        signup_expires_at,

        verified_at,
        consumed_at,
        expires_at,

        created_at,
        updated_at
      )
      VALUES
      (
        :challengeUuid,
        :accountId,
        :purpose,
        :channel,
        :destination,
        :legacyPhone,

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
        :expiresAt,

        UTC_TIMESTAMP(),
        UTC_TIMESTAMP()
      )
    `,
    {
      replacements: {
        challengeUuid,
        accountId,
        purpose,
        channel,
        destination,

        legacyPhone: channel === "sms" ? destination : null,

        codeHash,
        maxAttempts,
        locale,
        expiresAt,
      },
    },
  );
}

export async function markOtpDeliveryFailed(challengeUuid) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_otp_challenges
      SET status = 'delivery_failed', updated_at = :now
      WHERE challenge_uuid = :challengeUuid
    `,
    { replacements: { challengeUuid, now } },
  );
}

export async function findLatestPendingOtpForUpdate(
  purpose,
  channel,
  destination,
  transaction,
  accountId = null,
) {
  const rows = await sequelize.query(
    `
      SELECT *

      FROM auth_otp_challenges

      WHERE purpose = :purpose
        AND channel = :channel
        AND destination = :destination
        AND account_id <=> :accountId
        AND status = 'pending'

      ORDER BY id DESC

      LIMIT 1

      FOR UPDATE
    `,
    {
      replacements: {
        purpose,
        channel,
        destination,
        accountId,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

export async function registerFailedOtpAttempt(
  { challengeId, attempts, status },
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_otp_challenges
      SET attempts = :attempts, status = :status, updated_at = :now
      WHERE id = :challengeId
    `,
    {
      replacements: { challengeId, attempts, status, now },
      transaction,
    },
  );
}

export async function markOtpExpired(challengeId, transaction) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_otp_challenges
      SET status = 'expired', updated_at = :now
      WHERE id = :challengeId
    `,
    { replacements: { challengeId, now }, transaction },
  );
}

export async function markOtpVerifiedWithSignupToken(
  { challengeId, signupTokenHash, signupJti, signupExpiresAt },
  transaction,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_otp_challenges
      SET
        status = 'verified',
        verified_at = :now,
        signup_token_hash = :signupTokenHash,
        signup_jti = :signupJti,
        signup_expires_at = :signupExpiresAt,
        updated_at = :now
      WHERE id = :challengeId
    `,
    {
      replacements: {
        challengeId,
        signupTokenHash,
        signupJti,
        signupExpiresAt,
        now,
      },
      transaction,
    },
  );
}

export async function markOtpConsumed(challengeId, transaction) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_otp_challenges
      SET
        status = 'consumed',
        verified_at = COALESCE(verified_at, :now),
        consumed_at = :now,
        updated_at = :now
      WHERE id = :challengeId
    `,
    { replacements: { challengeId, now }, transaction },
  );
}

export async function findOtpChallengeByUuidForUpdate(
  challengeUuid,
  transaction,
) {
  const rows = await sequelize.query(
    `
      SELECT *
      FROM auth_otp_challenges
      WHERE challenge_uuid = :challengeUuid
      LIMIT 1
      FOR UPDATE
    `,
    {
      replacements: { challengeUuid },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return rows[0] ?? null;
}

/*
|--------------------------------------------------------------------------
| Account Sessions
|--------------------------------------------------------------------------
*/

export async function createAuthSession({
  sessionUuid,
  accountId,

  refreshTokenHash,
  refreshJti,

  authMethod,
  clientType,

  deviceType,
  deviceName,

  userAgent,
  ipAddress,

  expiresAt,

  transaction = null,
}) {
  const now = new Date();

  await sequelize.query(
    `
      INSERT INTO auth_sessions
      (
        session_uuid,
        account_id,

        refresh_token_hash,
        refresh_jti,

        previous_refresh_token_hash,
        previous_refresh_jti,
        previous_refresh_valid_until,

        status,
        auth_method,
        client_type,

        device_type,
        device_name,
        user_agent,
        ip_address,

        last_used_at,
        expires_at,

        revoked_at,
        revoke_reason,

        created_at,
        updated_at
      )
      VALUES
      (
        :sessionUuid,
        :accountId,

        :refreshTokenHash,
        :refreshJti,

        NULL,
        NULL,
        NULL,

        'active',
        :authMethod,
        :clientType,

        :deviceType,
        :deviceName,
        :userAgent,
        :ipAddress,

        :now,
        :expiresAt,

        NULL,
        NULL,

        :now,
        :now
      )
    `,
    {
      replacements: {
        sessionUuid,
        accountId,

        refreshTokenHash,
        refreshJti,

        authMethod,
        clientType,

        deviceType: deviceType ?? null,

        deviceName: deviceName ?? null,

        userAgent: userAgent ?? null,

        ipAddress: ipAddress ?? null,

        now,
        expiresAt,
      },

      transaction,
    },
  );
}

export async function findAuthContext(sessionUuid, accountId) {
  const rows = await sequelize.query(
    `
        SELECT
          s.session_uuid,

          s.status
            AS session_status,

          s.expires_at
            AS session_expires_at,

          s.auth_method,

          s.created_at
            AS authenticated_at,

          a.id
            AS account_id,

          a.status
            AS account_status

        FROM auth_sessions s

        INNER JOIN accounts a
          ON a.id =
            s.account_id

        WHERE s.session_uuid =
          :sessionUuid

          AND s.account_id =
            :accountId

        LIMIT 1
      `,
    {
      replacements: {
        sessionUuid,
        accountId,
      },

      type: QueryTypes.SELECT,
    },
  );

  return rows[0] ?? null;
}

export async function findAuthSessionForUpdate(
  sessionUuid,
  accountId,
  transaction,
) {
  const rows = await sequelize.query(
    `
        SELECT *
        FROM auth_sessions

        WHERE session_uuid =
          :sessionUuid

          AND account_id =
            :accountId

        LIMIT 1

        FOR UPDATE
      `,
    {
      replacements: {
        sessionUuid,
        accountId,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  return rows[0] ?? null;
}

/*
 * Refresh is rotating, but auth-session expiry is absolute.
 *
 * We deliberately DO NOT move expires_at on every refresh.
 */
export async function rotateSessionRefreshToken({
  sessionUuid,

  currentRefreshTokenHash,
  currentRefreshJti,

  newRefreshTokenHash,
  newRefreshJti,

  previousValidUntil,

  transaction,
}) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_sessions

      SET
        previous_refresh_token_hash =
          :currentRefreshTokenHash,

        previous_refresh_jti =
          :currentRefreshJti,

        previous_refresh_valid_until =
          :previousValidUntil,

        refresh_token_hash =
          :newRefreshTokenHash,

        refresh_jti =
          :newRefreshJti,

        last_used_at =
          :now,

        updated_at =
          :now

      WHERE session_uuid =
        :sessionUuid
    `,
    {
      replacements: {
        sessionUuid,

        currentRefreshTokenHash,
        currentRefreshJti,

        newRefreshTokenHash,
        newRefreshJti,

        previousValidUntil,

        now,
      },

      transaction,
    },
  );
}

export async function revokeAuthSession(
  sessionUuid,
  reason = "logout",
  transaction = null,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_sessions

      SET
        status =
          'revoked',

        revoked_at =
          :now,

        revoke_reason =
          :reason,

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
        reason,
        now,
      },

      transaction,
    },
  );
}

export async function revokeAllAccountSessions(
  accountId,
  reason = "logout_all",
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_sessions

      SET
        status =
          'revoked',

        revoked_at =
          :now,

        revoke_reason =
          :reason,

        updated_at =
          :now

      WHERE account_id =
        :accountId

        AND status =
          'active'
    `,
    {
      replacements: {
        accountId,
        reason,
        now,
      },
    },
  );
}

export async function revokeOtherAccountSessions(
  accountId,
  currentSessionUuid,
  reason = "contact_changed",
  transaction = null,
) {
  const now = new Date();

  await sequelize.query(
    `
      UPDATE auth_sessions
      SET
        status = 'revoked',
        revoked_at = :now,
        revoke_reason = :reason,
        updated_at = :now
      WHERE account_id = :accountId
        AND session_uuid <> :currentSessionUuid
        AND status = 'active'
    `,
    {
      replacements: {
        accountId,
        currentSessionUuid,
        reason,
        now,
      },
      transaction,
    },
  );
}
