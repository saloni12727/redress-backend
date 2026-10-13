import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";

import { sequelize } from "../../config/database.js";
import { getAuthConfig } from "../../config/auth.config.js";
import { logger } from "../../config/logger.js";
import { safeErrorForLog } from "../../utils/safe-error.js";
import {
  buildProfilePhotoKey,
  deleteFromS3,
} from "../../services/s3.service.js";
import {
  optimizeProfilePhoto,
  ProfilePhotoValidationError,
  uploadProfilePhoto,
} from "../../services/profile-photo.service.js";
import { createMediaUrl } from "../../services/media-url.service.js";

import {
  createGoogleSignupToken,
  createSignupToken,
  createTokenPair,
  hashToken,
  tokenHashesEqual,
  verifyRefreshToken,
  verifySignupToken,
} from "./token.service.js";

import { generateOtpCode, hashOtpCode, otpHashMatches } from "./otp.service.js";
import { sendAuthOtp } from "./otp.provider.js";

import {
  GoogleAuthConfigurationError,
  verifyGoogleIdToken,
} from "./google.service.js";

import {
  assignAccountRole,
  createAccount,
  createAccountIdentity,
  createAuthSession,
  createOtpChallenge,
  createSignupProof,
  createUserPrivacyConsent,
  fillAccountGoogleProfileIfMissing,
  findAccountByEmail,
  findAccountById,
  findAccountByIdForUpdate,
  findAccountByPhone,
  findAuthSessionForUpdate,
  findIdentityByAccountProvider,
  findIdentityByProviderSubject,
  findLatestPendingOtpForUpdate,
  findOtpChallengeByUuidForUpdate,
  findSignupProofForUpdate,
  findRoleByCode,
  getAccountRoles,
  getAccountFitSetupSnapshot,
  getCurrentPrivacyPolicyVersion,
  getOtpSendStats,
  markOtpConsumed,
  markOtpDeliveryFailed,
  markOtpExpired,
  markOtpVerifiedWithSignupToken,
  markSignupProofConsumed,
  registerFailedOtpAttempt,
  revokeAllAccountSessions,
  revokeAuthSession,
  revokeOtherAccountSessions,
  rotateSessionRefreshToken,
  supersedePendingOtpChallenges,
  updateAccountEmailVerified,
  updateAccountEmailVerifiedAddress,
  updateAccountIdentityProviderEmail,
  updateAccountPhoneVerified,
  updateAccountProfile,
  updateAccountPrivacyConsent,
  updateLastLoginAt,
} from "./auth.repository.js";
import { strongPasswordSchema } from "./auth.validation.js";

export class AuthServiceError extends Error {
  constructor({ statusCode, errorCode, messageKey, details }) {
    super(errorCode);
    this.name = "AuthServiceError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.messageKey = messageKey;
    this.details = details ?? { retryable: false };
  }
}

function invalidCredentials(reason = null) {
  return new AuthServiceError({
    statusCode: 422,
    errorCode: "INVALID_CREDENTIALS",
    messageKey: "errorUnprocessable",
    details: {
      retryable: false,
      ...(reason ? { reason } : {}),
    },
  });
}

function unprocessable(reason, fields = undefined) {
  return new AuthServiceError({
    statusCode: 422,
    errorCode: "UNPROCESSABLE",
    messageKey: "errorUnprocessable",
    details: {
      retryable: false,
      reason,
      ...(fields ? { fields } : {}),
    },
  });
}

function forbidden(reason) {
  return new AuthServiceError({
    statusCode: 403,
    errorCode: "FORBIDDEN",
    messageKey: "errorForbidden",
    details: {
      retryable: false,
      reason,
    },
  });
}

function conflict(reason, fields = undefined) {
  return new AuthServiceError({
    statusCode: 409,
    errorCode: "CONFLICT",
    messageKey: "errorConflict",
    details: {
      retryable: false,
      reason,
      ...(fields ? { fields } : {}),
    },
  });
}

function rateLimited(reason, retryAfter) {
  return new AuthServiceError({
    statusCode: 429,
    errorCode: "RATE_LIMITED",
    messageKey: "errorRateLimited",
    details: {
      retryable: true,
      reason,
      retryAfter,
    },
  });
}

function internalError(reason) {
  return new AuthServiceError({
    statusCode: 500,
    errorCode: "INTERNAL",
    messageKey: "errorGeneric",
    details: {
      retryable: true,
      reason,
    },
  });
}

function serviceUnavailable(reason) {
  return new AuthServiceError({
    statusCode: 503,
    errorCode: "SERVICE_UNAVAILABLE",
    messageKey: "errorServiceUnavailable",
    details: {
      retryable: true,
      reason,
    },
  });
}

function sessionClosed(reason) {
  return new AuthServiceError({
    statusCode: 401,
    errorCode: "SESSION_CLOSED",
    messageKey: "errorUnauthorized",
    details: {
      retryable: false,
      reason,
    },
  });
}

function accountIsActive(account) {
  return Boolean(account && account.status === "active");
}

function isDuplicateEntryError(error) {
  return (
    error?.original?.code === "ER_DUP_ENTRY" ||
    error?.parent?.code === "ER_DUP_ENTRY" ||
    error?.code === "ER_DUP_ENTRY"
  );
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function getOtpDestination({ channel, phone, email }) {
  return channel === "sms" ? phone : normalizeEmail(email);
}

function toPublicRoles(internalRoles) {
  const roles = new Set();

  for (const role of internalRoles) {
    if (role === "customer") {
      roles.add("customer");
    } else if (role === "vendor_owner" || role === "vendor_staff") {
      roles.add("seller");
    } else if (role === "admin") {
      roles.add("admin");
    } else if (role === "super_admin") {
      roles.add("super_admin");
    }
  }

  return [...roles];
}

async function buildUser(account, internalRoles, googleIdentity) {
  const canonicalDisplayName = [account.first_name, account.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  let photoUrl = account.photo_url ?? null;

  if (account.profile_photo_storage_key) {
    photoUrl = createMediaUrl(account.profile_photo_storage_key);
  }

  const [currentPolicyVersion, selfProfile] = await Promise.all([
    getCurrentPrivacyPolicyVersion(),
    getAccountFitSetupSnapshot(account.id),
  ]);
  const fitSetup = fitSetupFromSnapshot(
    selfProfile,
    account.fit_setup_skipped_at ?? null,
  );
  const hasConsent = Boolean(
    account.consent_privacy_accepted_at && account.consent_privacy_version,
  );

  return {
    id: String(account.id),
    firstName: account.first_name ?? null,
    lastName: account.last_name ?? null,
    phone: account.phone ?? null,
    phoneVerified: Boolean(account.phone_verified_at),
    email: account.email ?? null,
    emailVerified: Boolean(account.email_verified_at),
    displayName: canonicalDisplayName || account.display_name?.trim() || null,
    photoUrl,
    locale: account.locale ?? "it",
    roles: toPublicRoles(internalRoles),
    googleLinked: Boolean(googleIdentity),
    googleEmail: googleIdentity?.provider_email ?? null,
    hasPassword: Boolean(account.password_hash),
    consent: hasConsent
      ? {
          privacyAcceptedAt: new Date(
            account.consent_privacy_accepted_at,
          ).toISOString(),
          privacyVersion: account.consent_privacy_version,
          current:
            Boolean(currentPolicyVersion) &&
            account.consent_privacy_version === currentPolicyVersion,
        }
      : null,
    fitSetup,
  };
}

function splitFullName(fullName) {
  const parts = fullName.trim().replace(/\s+/g, " ").split(" ");
  const firstName = parts.shift()?.slice(0, 100) || null;
  const lastName = parts.length > 0 ? parts.join(" ").slice(0, 100) : null;

  return {
    firstName,
    lastName,
  };
}

function normalizedSignupName(fullName) {
  return fullName.trim().replace(/\s+/g, " ");
}

async function validatePrivacyConsent({ consent, required }) {
  if (!required) return null;

  if (!consent || consent.privacyAccepted !== true) {
    throw unprocessable("consent_required", { consent: "required" });
  }

  const currentVersion = await getCurrentPrivacyPolicyVersion();
  if (!currentVersion) {
    throw serviceUnavailable("privacy_policy_unavailable");
  }

  if (consent.privacyVersion !== currentVersion) {
    throw unprocessable("consent_stale", { consent: "stale" });
  }

  return currentVersion;
}

async function recordPrivacyConsent({
  accountId,
  version,
  channel,
  transaction,
}) {
  const acceptedAt = new Date();
  await createUserPrivacyConsent(
    { accountId, version, acceptedAt, channel },
    transaction,
  );
  await updateAccountPrivacyConsent(
    { accountId, acceptedAt, version, channel },
    transaction,
  );
  return acceptedAt;
}

function fitSetupFromSnapshot(profile, skippedAt) {
  if (!profile) {
    return {
      status: skippedAt ? "skipped" : "pending",
      selfProfileId: null,
      capabilities: { sizeAdviceReady: false, virtualTryOnReady: false },
    };
  }
  const sizeAdviceReady =
    profile.height_cm !== null &&
    profile.height_cm !== undefined &&
    profile.weight_kg !== null &&
    profile.weight_kg !== undefined;
  const virtualTryOnReady = [
    profile.front_media_id,
    profile.back_media_id,
    profile.left_media_id,
    profile.right_media_id,
  ].some((mediaId) => mediaId !== null && mediaId !== undefined);
  return {
    /* A fit setup is only complete when the base measurements and at least
     * one private profile photo have both been saved. */
    status:
      sizeAdviceReady && virtualTryOnReady
        ? "ready"
        : skippedAt
          ? "skipped"
          : "partial",
    selfProfileId: String(profile.id),
    capabilities: {
      sizeAdviceReady,
      virtualTryOnReady,
    },
  };
}

function getGoogleNames(googleIdentity) {
  if (googleIdentity.firstName || googleIdentity.lastName) {
    return {
      firstName: googleIdentity.firstName,
      lastName: googleIdentity.lastName,
    };
  }

  if (googleIdentity.displayName) {
    return splitFullName(googleIdentity.displayName);
  }

  return {
    firstName: null,
    lastName: null,
  };
}

async function createAuthenticatedSession({
  account,
  authMethod,
  clientType,
  deviceType,
  deviceName,
  userAgent,
  ipAddress,
  transaction = null,
}) {
  const internalRoles = await getAccountRoles(account.id, transaction);

  if (internalRoles.length === 0) {
    throw forbidden("account_has_no_active_role");
  }

  const googleIdentity = await findIdentityByAccountProvider(
    account.id,
    "google",
    transaction,
  );

  const publicRoles = toPublicRoles(internalRoles);
  const sessionUuid = randomUUID();

  const tokens = createTokenPair({
    accountId: account.id,
    sessionUuid,
    roles: publicRoles,
  });

  await createAuthSession({
    sessionUuid,
    accountId: account.id,
    refreshTokenHash: tokens.refreshTokenHash,
    refreshJti: tokens.refreshJti,
    authMethod,
    clientType,
    deviceType,
    deviceName,
    userAgent,
    ipAddress,
    expiresAt: tokens.refreshExpiresAt,
    transaction,
  });

  await updateLastLoginAt(account.id, transaction);

  return {
    status: "authenticated",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    user: await buildUser(account, internalRoles, googleIdentity),
  };
}

async function issueOtp({
  purpose,
  channel,
  destination,
  locale,
  accountId = null,
  requestId,
}) {
  const config = getAuthConfig();
  const stats = await getOtpSendStats(purpose, channel, destination);
  const now = Date.now();

  if (stats.secondsSinceLastSend !== null) {
    const secondsSinceLastSend = Math.max(0, stats.secondsSinceLastSend);

    if (secondsSinceLastSend < config.otpResendSeconds) {
      throw rateLimited(
        "otp_resend_too_soon",
        config.otpResendSeconds - secondsSinceLastSend,
      );
    }
  }

  if (stats.sendsInWindow >= config.otpMaxSendsPerHour) {
    throw rateLimited("otp_send_limit", 60 * 60);
  }

  const challengeUuid = randomUUID();
  const code = generateOtpCode();
  const codeHash = hashOtpCode({
    purpose,
    channel,
    destination,
    code,
  });
  const expiresAt = new Date(now + config.otpTtlSeconds * 1000);

  await supersedePendingOtpChallenges(purpose, channel, destination, accountId);

  await createOtpChallenge({
    challengeUuid,
    accountId,
    purpose,
    channel,
    destination,
    codeHash,
    maxAttempts: config.otpMaxAttempts,
    locale,
    expiresAt,
  });

  try {
    await sendAuthOtp({
      purpose,
      channel,
      destination,
      code,
      locale,
      expiresIn: config.otpTtlSeconds,
    });

    /*
     * Successful delivery is represented by the single concise API-success
     * line emitted by the request logger. Do not duplicate it here.
     */
  } catch (error) {
    logger.error(
      {
        requestId,
        event: "otp_delivery_failed",
        purpose,
        channel,
        error: safeErrorForLog(error),
      },
      "OTP delivery failed",
    );

    await markOtpDeliveryFailed(challengeUuid);
    throw internalError("otp_delivery_failed");
  }

  return {
    expiresIn: config.otpTtlSeconds,
    resendIn: config.otpResendSeconds,
  };
}

/*
|--------------------------------------------------------------------------
| POST /auth/otp/send
|--------------------------------------------------------------------------
*/

export async function sendOtp({
  purpose = "auth",
  channel,
  phone,
  email,
  locale,
  accountId = null,
  requestId,
}) {
  const destination = getOtpDestination({
    channel,
    phone,
    email,
  });

  /*
  |--------------------------------------------------------------------------
  | PHONE LINK
  |--------------------------------------------------------------------------
  |
  | phone_link is NOT public authentication.
  |
  | Only an already authenticated Redress user
  | can request this OTP.
  |
  */

  if (purpose === "phone_link") {
    if (!accountId) {
      throw forbidden("authentication_required_for_phone_link");
    }

    const account = await findAccountById(accountId);

    if (!accountIsActive(account)) {
      throw forbidden("account_not_active");
    }

    const phoneOwner = await findAccountByPhone(destination);

    if (phoneOwner && String(phoneOwner.id) !== String(account.id)) {
      throw conflict("phone_already_in_use", {
        phone: "taken",
      });
    }

    if (
      phoneOwner &&
      String(phoneOwner.id) === String(account.id) &&
      phoneOwner.phone_verified_at
    ) {
      throw conflict("phone_already_verified", {
        phone: "already_verified",
      });
    }
  }

  return issueOtp({
    purpose,
    channel,
    destination,
    locale,
    accountId,
    requestId,
  });
}

/*
|--------------------------------------------------------------------------
| POST /auth/otp/verify
|--------------------------------------------------------------------------
*/

export async function verifyOtp({
  channel,
  phone,
  email,
  otp,
  clientType,
  deviceType,
  deviceName,
  userAgent,
  ipAddress,
  locale,
}) {
  /*
   * Public OTP verification can ONLY consume
   * purpose=auth challenges.
   */
  const purpose = "auth";

  const destination = getOtpDestination({
    channel,
    phone,
    email,
  });

  const transaction = await sequelize.transaction();

  try {
    const challenge = await findLatestPendingOtpForUpdate(
      purpose,
      channel,
      destination,
      transaction,
    );

    if (!challenge) {
      throw invalidCredentials("otp_invalid_or_expired");
    }

    const now = new Date();

    if (new Date(challenge.expires_at) <= now) {
      await markOtpExpired(challenge.id, transaction);

      await transaction.commit();

      throw invalidCredentials("otp_invalid_or_expired");
    }

    if (Number(challenge.attempts) >= Number(challenge.max_attempts)) {
      throw invalidCredentials("otp_attempts_exceeded");
    }

    const validOtp = otpHashMatches({
      purpose,
      channel,
      destination,

      code: otp,

      expectedHash: challenge.code_hash,
    });

    if (!validOtp) {
      const attempts = Number(challenge.attempts) + 1;

      const status =
        attempts >= Number(challenge.max_attempts) ? "locked" : "pending";

      await registerFailedOtpAttempt(
        {
          challengeId: challenge.id,

          attempts,
          status,
        },

        transaction,
      );

      await transaction.commit();

      throw invalidCredentials("otp_invalid_or_expired");
    }

    /*
    |--------------------------------------------------------------------------
    | PHONE OTP
    |--------------------------------------------------------------------------
    */

    if (channel === "sms") {
      let account = await findAccountByPhone(destination, transaction);

      /*
       * Existing phone account.
       */
      if (account) {
        if (!accountIsActive(account)) {
          throw forbidden("account_not_active");
        }

        /*
         * Customer-facing OTP must NOT become
         * an admin authentication method.
         */
        const roles = await getAccountRoles(account.id, transaction);

        if (roles.some((role) => role === "admin" || role === "super_admin")) {
          /*
           * OTP was valid.
           * Consume it before refusing login.
           */
          await markOtpConsumed(challenge.id, transaction);

          await transaction.commit();

          throw forbidden("otp_login_not_allowed_for_privileged_account");
        }

        if (!account.phone_verified_at) {
          await updateAccountPhoneVerified(
            {
              accountId: account.id,

              phone: destination,
            },

            transaction,
          );

          account = await findAccountById(account.id, transaction);
        }

        await markOtpConsumed(challenge.id, transaction);

        const result = await createAuthenticatedSession({
          account,

          /*
           * IMPORTANT:
           * A session authenticated through SMS OTP
           * is explicitly recorded as phone_otp.
           */
          authMethod: "phone_otp",

          clientType,
          deviceType,
          deviceName,
          userAgent,
          ipAddress,
          transaction,
        });

        await transaction.commit();

        return result;
      }

      /*
       * New phone.
       */
      const signupTokenData = createSignupToken({
        challengeUuid: challenge.challenge_uuid,

        channel,

        destination,

        locale,
      });

      await markOtpVerifiedWithSignupToken(
        {
          challengeId: challenge.id,

          signupTokenHash: signupTokenData.tokenHash,

          signupJti: signupTokenData.signupJti,

          signupExpiresAt: signupTokenData.expiresAt,
        },

        transaction,
      );

      await transaction.commit();

      return {
        status: "signup_required",

        signupToken: signupTokenData.token,

        phone: destination,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | EMAIL OTP
    |--------------------------------------------------------------------------
    */

    let account = await findAccountByEmail(destination, transaction);

    if (account) {
      if (!accountIsActive(account)) {
        throw forbidden("account_not_active");
      }

      if (!account.email_verified_at) {
        await updateAccountEmailVerified(
          {
            accountId: account.id,
          },

          transaction,
        );

        account = await findAccountById(account.id, transaction);
      }

      await markOtpConsumed(challenge.id, transaction);

      /*
       * Existing email/password account.
       *
       * IMPORTANT:
       * Email OTP here verifies/discovers the email.
       * It does NOT create an authenticated session.
       *
       * The actual session is created only after
       * POST /auth/login succeeds with password.
       */
      if (account.password_hash) {
        await transaction.commit();

        return {
          status: "login_with_password",

          email: destination,
        };
      }

      /*
       * Existing Google-only account.
       */
      const googleIdentity = await findIdentityByAccountProvider(
        account.id,
        "google",
        transaction,
      );

      await transaction.commit();

      return {
        status: googleIdentity ? "login_with_google" : "account_exists",

        email: destination,
      };
    }

    /*
     * New email.
     *
     * No authenticated session yet.
     * The signup token proves this email OTP was verified.
     */
    const signupTokenData = createSignupToken({
      challengeUuid: challenge.challenge_uuid,

      channel,

      destination,

      locale,
    });

    await markOtpVerifiedWithSignupToken(
      {
        challengeId: challenge.id,

        signupTokenHash: signupTokenData.tokenHash,

        signupJti: signupTokenData.signupJti,

        signupExpiresAt: signupTokenData.expiresAt,
      },

      transaction,
    );

    await transaction.commit();

    return {
      status: "signup_required",

      signupToken: signupTokenData.token,

      email: destination,
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
| POST /auth/signup
|--------------------------------------------------------------------------
*/

export async function signup({
  signupToken,
  fullName,
  password,
  consent,
  enforceSignupConsent = false,
  locale,
  clientType,
  deviceType,
  deviceName,
  userAgent,
  ipAddress,
}) {
  let claims;

  try {
    claims = verifySignupToken(signupToken);
  } catch {
    throw unprocessable("signup_token_invalid");
  }

  const transaction = await sequelize.transaction();

  try {
    const isGoogleSignup = claims.typ === "google_signup";
    const channel = isGoogleSignup ? "google" : claims.ch;
    let destination = claims.sub;
    let googleProof = null;
    let challenge = null;

    if (isGoogleSignup) {
      googleProof = await findSignupProofForUpdate(claims.pid, transaction);
      if (
        !googleProof ||
        googleProof.type !== "google_signup" ||
        googleProof.consumed_at ||
        googleProof.subject !== claims.sub ||
        googleProof.email !== claims.email ||
        googleProof.token_jti !== claims.jti ||
        !tokenHashesEqual(hashToken(signupToken), googleProof.token_hash) ||
        new Date(googleProof.expires_at) <= new Date()
      ) {
        throw unprocessable("signup_token_invalid");
      }
      destination = googleProof.email;
    } else {
      challenge = await findOtpChallengeByUuidForUpdate(claims.cid, transaction);
      if (
        !challenge ||
        challenge.status !== "verified" ||
        challenge.purpose !== "auth" ||
        challenge.channel !== channel ||
        challenge.destination !== destination ||
        challenge.signup_jti !== claims.jti ||
        !tokenHashesEqual(hashToken(signupToken), challenge.signup_token_hash) ||
        !challenge.signup_expires_at ||
        new Date(challenge.signup_expires_at) <= new Date()
      ) {
        throw unprocessable("signup_token_invalid");
      }
    }

    const normalizedName = normalizedSignupName(fullName);
    const maximumNameLength = enforceSignupConsent ? 80 : 200;
    if (
      [...normalizedName].length < 2 ||
      [...normalizedName].length > maximumNameLength
    ) {
      throw unprocessable("full_name_invalid", { fullName: "invalid" });
    }

    const privacyVersion = await validatePrivacyConsent({
      consent,
      required: enforceSignupConsent,
    });

    if (channel === "email" && !password) {
      throw unprocessable("password_required", { password: "required" });
    }
    if (
      enforceSignupConsent &&
      (channel === "sms" || channel === "google") &&
      password !== undefined
    ) {
      throw unprocessable("password_not_allowed", { password: "not_allowed" });
    }
    if (channel === "email" && !strongPasswordSchema.safeParse(password).success) {
      throw unprocessable("password_weak", { password: "weak" });
    }

    /*
     * Final duplicate protection.
     */
    if (channel === "sms") {
      const existingPhone = await findAccountByPhone(destination, transaction);

      if (existingPhone) {
        throw conflict("phone_already_in_use", {
          phone: "taken",
        });
      }
    } else {
      const existingEmail = await findAccountByEmail(destination, transaction);

      if (existingEmail) {
        throw conflict("email_already_in_use", {
          email: "taken",
        });
      }
    }

    const customerRole = await findRoleByCode("customer", transaction);

    if (!customerRole) {
      throw internalError("customer_role_missing");
    }

    const { firstName, lastName } = splitFullName(normalizedName);

    const now = new Date();

    const passwordHash =
      channel === "email" ? await bcrypt.hash(password, 12) : null;

    await createAccount(
      {
        email: channel === "email" || channel === "google" ? destination : null,

        passwordHash,

        firstName,
        lastName,

        displayName: normalizedName,

        phone: channel === "sms" ? destination : null,

        phoneVerifiedAt: channel === "sms" ? now : null,

        emailVerifiedAt:
          channel === "email" || channel === "google" ? now : null,

        photoUrl: channel === "google" ? googleProof.photo_url ?? null : null,

        locale: claims.locale ?? locale,
      },

      transaction,
    );

    const account = channel === "sms"
      ? await findAccountByPhone(destination, transaction)
      : await findAccountByEmail(destination, transaction);

    if (!account) {
      throw internalError("account_create_failed");
    }

    await assignAccountRole(
      {
        accountId: account.id,

        roleId: customerRole.id,
      },

      transaction,
    );

    if (channel === "google") {
      await createAccountIdentity(
        {
          accountId: account.id,
          provider: "google",
          providerSubject: googleProof.subject,
          providerEmail: googleProof.email,
        },
        transaction,
      );
    }

    if (privacyVersion) {
      const acceptedAt = await recordPrivacyConsent({
        accountId: account.id,
        version: privacyVersion,
        channel,
        transaction,
      });
      Object.assign(account, {
        consent_privacy_accepted_at: acceptedAt,
        consent_privacy_version: privacyVersion,
        consent_channel: channel,
      });
    }

    if (challenge) {
      await markOtpConsumed(challenge.id, transaction);
    } else {
      await markSignupProofConsumed(googleProof.id, transaction);
    }

    /*
     * The initial signup session records the verified
     * authentication channel that established the account.
     *
     * Email signup:
     * Email OTP was verified before account creation.
     *
     * Phone signup:
     * SMS OTP was verified before account creation.
     */
    const result = await createAuthenticatedSession({
      account,

       authMethod:
         channel === "email"
           ? "email_otp"
           : channel === "google"
             ? "google"
             : "phone_otp",

      clientType,
      deviceType,
      deviceName,
      userAgent,
      ipAddress,
      transaction,
    });

    await transaction.commit();

    return result;
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    if (isDuplicateEntryError(error)) {
      throw conflict("email_or_phone_already_in_use");
    }

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/login
|--------------------------------------------------------------------------
*/

export async function login({
  email,
  password,
  clientType,
  deviceType,
  deviceName,
  userAgent,
  ipAddress,
}) {
  const normalizedEmail = normalizeEmail(email);

  const account = await findAccountByEmail(normalizedEmail);

  /*
   * Same response for:
   * - unknown email
   * - wrong password
   * - Google-only account
   *
   * This prevents useful account enumeration.
   */
  if (!account || !account.password_hash || !account.email_verified_at) {
    throw invalidCredentials();
  }

  const passwordValid = await bcrypt.compare(password, account.password_hash);

  if (!passwordValid) {
    throw invalidCredentials();
  }

  if (!accountIsActive(account)) {
    throw forbidden("account_not_active");
  }

  const transaction = await sequelize.transaction();

  try {
    const result = await createAuthenticatedSession({
      account,

      /*
       * Explicitly distinguish password login
       * from email OTP signup/verification.
       */
      authMethod: "email_password",

      clientType,
      deviceType,
      deviceName,
      userAgent,
      ipAddress,
      transaction,
    });

    await transaction.commit();

    return result;
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/google
|--------------------------------------------------------------------------
|
| Google is intentionally frictionless in Redress:
|
| - no mobile number during Google signup
| - no Redress password during Google signup
| - verified phone can be collected later when a business flow needs it
|
*/

export async function googleLogin({
  idToken,
  enforceSignupConsent = false,
  locale,
  clientType,
  deviceType,
  deviceName,
  userAgent,
  ipAddress,
}) {
  let googleIdentity;

  try {
    googleIdentity = await verifyGoogleIdToken(idToken);
  } catch (error) {
    if (error instanceof GoogleAuthConfigurationError) {
      throw internalError("google_auth_not_configured");
    }

    throw invalidCredentials("invalid_google_token");
  }

  const transaction = await sequelize.transaction();

  try {
    /*
     * FIRST:
     * lookup by stable Google subject.
     */
    const existingIdentity = await findIdentityByProviderSubject(
      "google",
      googleIdentity.subject,
      transaction,
    );

    /*
    |--------------------------------------------------------------------------
    | EXISTING GOOGLE IDENTITY
    |--------------------------------------------------------------------------
    */

    if (existingIdentity) {
      let account = await findAccountById(
        existingIdentity.account_id,
        transaction,
      );

      if (!account) {
        throw internalError("google_identity_account_missing");
      }

      if (!accountIsActive(account)) {
        throw forbidden("account_not_active");
      }

      await updateAccountIdentityProviderEmail(
        {
          identityId: existingIdentity.id,
          providerEmail: googleIdentity.email,
        },
        transaction,
      );

      const result = await createAuthenticatedSession({
        account,
        authMethod: "google",
        clientType,
        deviceType,
        deviceName,
        userAgent,
        ipAddress,
        transaction,
      });

      await transaction.commit();

      return result;
    }

    /*
    |--------------------------------------------------------------------------
    | NO GOOGLE IDENTITY YET
    |--------------------------------------------------------------------------
    |
    | Prevent duplicate Redress users when the exact verified
    | Google email already exists in Redress.
    |
    | Google will be linked to that same account.
    |
    | Privileged admin/super-admin accounts are intentionally
    | not auto-linked using only email matching.
    |
    */

    let account = await findAccountByEmail(googleIdentity.email, transaction);

    if (account) {
      if (!accountIsActive(account)) {
        throw forbidden("account_not_active");
      }

      if (!googleIdentity.emailAuthoritative) {
        throw conflict("google_link_requires_existing_auth", {
          email: "reauthentication_required",
        });
      }

      const roles = await getAccountRoles(account.id, transaction);

      if (roles.some((role) => ["admin", "super_admin"].includes(role))) {
        throw conflict("google_link_requires_authenticated_admin");
      }

      const existingGoogleForAccount = await findIdentityByAccountProvider(
        account.id,
        "google",
        transaction,
      );

      if (
        existingGoogleForAccount &&
        existingGoogleForAccount.provider_subject !== googleIdentity.subject
      ) {
        throw conflict("different_google_identity_already_linked");
      }

      if (!existingGoogleForAccount) {
        await createAccountIdentity(
          {
            accountId: account.id,

            provider: "google",

            providerSubject: googleIdentity.subject,

            providerEmail: googleIdentity.email,
          },
          transaction,
        );
      }

      if (!account.email_verified_at) {
        await updateAccountEmailVerified(
          {
            accountId: account.id,
          },
          transaction,
        );
      }

      await fillAccountGoogleProfileIfMissing(
        {
          accountId: account.id,

          firstName: googleIdentity.firstName,

          lastName: googleIdentity.lastName,

          displayName: googleIdentity.displayName,

          photoUrl: googleIdentity.photoUrl,
        },
        transaction,
      );

      account = await findAccountById(account.id, transaction);

      const result = await createAuthenticatedSession({
        account,
        authMethod: "google",
        clientType,
        deviceType,
        deviceName,
        userAgent,
        ipAddress,
        transaction,
      });

      await transaction.commit();

      return result;
    }

    /*
    |--------------------------------------------------------------------------
    | COMPLETELY NEW GOOGLE USER
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | Do NOT ask:
    | - phone
    | - phone OTP
    | - Redress password
    |
    */

    if (enforceSignupConsent) {
      const proofUuid = randomUUID();
      const signupTokenData = createGoogleSignupToken({
        proofUuid,
        subject: googleIdentity.subject,
        email: googleIdentity.email,
        displayName: googleIdentity.displayName,
        photoUrl: googleIdentity.photoUrl,
        locale,
      });
      await createSignupProof(
        {
          proofUuid,
          type: "google_signup",
          subject: googleIdentity.subject,
          email: googleIdentity.email,
          displayName: googleIdentity.displayName ?? null,
          photoUrl: googleIdentity.photoUrl ?? null,
          tokenHash: signupTokenData.tokenHash,
          tokenJti: signupTokenData.signupJti,
          expiresAt: signupTokenData.expiresAt,
        },
        transaction,
      );
      await transaction.commit();
      return {
        status: "signup_required",
        signupToken: signupTokenData.token,
        email: googleIdentity.email,
        fullName: googleIdentity.displayName ?? null,
        photoUrl: googleIdentity.photoUrl ?? null,
      };
    }

    const customerRole = await findRoleByCode("customer", transaction);

    if (!customerRole) {
      throw internalError("customer_role_missing");
    }

    const names = getGoogleNames(googleIdentity);

    const now = new Date();

    await createAccount(
      {
        email: googleIdentity.email,

        passwordHash: null,

        firstName: names.firstName,

        lastName: names.lastName,

        displayName: googleIdentity.displayName,

        phone: null,

        phoneVerifiedAt: null,

        /* Gmail and Workspace addresses are authoritative at Google. */
        emailVerifiedAt: googleIdentity.emailAuthoritative ? now : null,

        photoUrl: googleIdentity.photoUrl,

        locale,
      },
      transaction,
    );

    account = await findAccountByEmail(googleIdentity.email, transaction);

    if (!account) {
      throw internalError("account_create_failed");
    }

    await assignAccountRole(
      {
        accountId: account.id,

        roleId: customerRole.id,
      },
      transaction,
    );

    await createAccountIdentity(
      {
        accountId: account.id,

        provider: "google",

        providerSubject: googleIdentity.subject,

        providerEmail: googleIdentity.email,
      },
      transaction,
    );

    const result = await createAuthenticatedSession({
      account,
      authMethod: "google",
      clientType,
      deviceType,
      deviceName,
      userAgent,
      ipAddress,
      transaction,
    });

    await transaction.commit();

    return result;
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    if (isDuplicateEntryError(error)) {
      throw conflict("google_identity_or_email_already_in_use");
    }

    throw error;
  }
}

async function assertAvailableContact({ account, channel, destination }) {
  if (channel === "email") {
    if (
      account.email &&
      normalizeEmail(account.email) === destination &&
      account.email_verified_at
    ) {
      throw conflict("email_already_verified", {
        email: "already_verified",
      });
    }

    const owner = await findAccountByEmail(destination);

    if (owner && String(owner.id) !== String(account.id)) {
      throw conflict("email_already_in_use", {
        email: "taken",
      });
    }

    return;
  }

  if (account.phone === destination && account.phone_verified_at) {
    throw conflict("phone_already_verified", {
      phone: "already_verified",
    });
  }

  const owner = await findAccountByPhone(destination);

  if (owner && String(owner.id) !== String(account.id)) {
    throw conflict("phone_already_in_use", {
      phone: "taken",
    });
  }
}

async function requestCurrentAccountContactChange({
  accountId,
  purpose,
  channel,
  destination,
  locale,
}) {
  const account = await findAccountById(accountId);

  if (!accountIsActive(account)) {
    throw forbidden("account_not_active");
  }

  await assertAvailableContact({ account, channel, destination });

  return issueOtp({
    purpose,
    channel,
    destination,
    locale,
    accountId,
  });
}

export async function requestCurrentAccountEmailChange({
  accountId,
  newEmail,
  locale,
}) {
  return requestCurrentAccountContactChange({
    accountId,
    purpose: "email_change",
    channel: "email",
    destination: normalizeEmail(newEmail),
    locale,
  });
}

export async function requestCurrentAccountPhoneChange({
  accountId,
  newPhone,
  locale,
}) {
  return requestCurrentAccountContactChange({
    accountId,
    purpose: "phone_change",
    channel: "sms",
    destination: newPhone,
    locale,
  });
}

async function verifyCurrentAccountContactChange({
  accountId,
  sessionUuid,
  purpose,
  channel,
  destination,
  otp,
}) {
  const transaction = await sequelize.transaction();

  try {
    const challenge = await findLatestPendingOtpForUpdate(
      purpose,
      channel,
      destination,
      transaction,
      accountId,
    );

    if (!challenge) {
      throw invalidCredentials("otp_invalid_or_expired");
    }

    const now = new Date();

    if (new Date(challenge.expires_at) <= now) {
      await markOtpExpired(challenge.id, transaction);
      await transaction.commit();
      throw invalidCredentials("otp_invalid_or_expired");
    }

    if (Number(challenge.attempts) >= Number(challenge.max_attempts)) {
      throw invalidCredentials("otp_attempts_exceeded");
    }

    const validOtp = otpHashMatches({
      purpose,
      channel,
      destination,
      code: otp,
      expectedHash: challenge.code_hash,
    });

    if (!validOtp) {
      const attempts = Number(challenge.attempts) + 1;
      const status =
        attempts >= Number(challenge.max_attempts) ? "locked" : "pending";

      await registerFailedOtpAttempt(
        {
          challengeId: challenge.id,
          attempts,
          status,
        },
        transaction,
      );

      await transaction.commit();
      throw invalidCredentials("otp_invalid_or_expired");
    }

    const account = await findAccountByIdForUpdate(accountId, transaction);

    if (!accountIsActive(account)) {
      throw forbidden("account_not_active");
    }

    if (channel === "email") {
      const owner = await findAccountByEmail(destination, transaction);

      if (owner && String(owner.id) !== String(account.id)) {
        throw conflict("email_already_in_use", { email: "taken" });
      }

      await updateAccountEmailVerifiedAddress(
        { accountId: account.id, email: destination },
        transaction,
      );
    } else {
      const owner = await findAccountByPhone(destination, transaction);

      if (owner && String(owner.id) !== String(account.id)) {
        throw conflict("phone_already_in_use", { phone: "taken" });
      }

      await updateAccountPhoneVerified(
        { accountId: account.id, phone: destination },
        transaction,
      );
    }

    await markOtpConsumed(challenge.id, transaction);

    if (sessionUuid) {
      await revokeOtherAccountSessions(
        account.id,
        sessionUuid,
        channel === "email" ? "email_changed" : "phone_changed",
        transaction,
      );
    }

    await transaction.commit();

    return getCurrentUser({ accountId });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    if (isDuplicateEntryError(error)) {
      throw conflict(
        channel === "email" ? "email_already_in_use" : "phone_already_in_use",
        channel === "email" ? { email: "taken" } : { phone: "taken" },
      );
    }

    throw error;
  }
}

export async function verifyCurrentAccountEmailChange({
  accountId,
  sessionUuid,
  newEmail,
  otp,
}) {
  return verifyCurrentAccountContactChange({
    accountId,
    sessionUuid,
    purpose: "email_change",
    channel: "email",
    destination: normalizeEmail(newEmail),
    otp,
  });
}

export async function verifyCurrentAccountPhoneChange({
  accountId,
  sessionUuid,
  newPhone,
  otp,
}) {
  return verifyCurrentAccountContactChange({
    accountId,
    sessionUuid,
    purpose: "phone_change",
    channel: "sms",
    destination: newPhone,
    otp,
  });
}

/* Backward-compatible phone-link verification route. */
export async function verifyCurrentAccountPhone({
  accountId,
  sessionUuid,
  phone,
  otp,
}) {
  return verifyCurrentAccountContactChange({
    accountId,
    sessionUuid,
    purpose: "phone_link",
    channel: "sms",
    destination: phone,
    otp,
  });
}
/*
|--------------------------------------------------------------------------
| POST /auth/refresh
|--------------------------------------------------------------------------
*/

export async function refresh({ refreshToken }) {
  let claims;

  try {
    claims = verifyRefreshToken(refreshToken);
  } catch {
    throw sessionClosed("invalid_refresh_token");
  }

  const accountId = claims.sub;

  const sessionUuid = claims.sid;

  const presentedJti = claims.jti;

  const presentedHash = hashToken(refreshToken);

  const transaction = await sequelize.transaction();

  try {
    const session = await findAuthSessionForUpdate(
      sessionUuid,
      accountId,
      transaction,
    );

    if (!session || session.status !== "active") {
      throw sessionClosed("session_revoked");
    }

    const now = new Date();

    const sessionExpiresAt = new Date(session.expires_at);

    if (sessionExpiresAt <= now) {
      await revokeAuthSession(sessionUuid, "session_expired", transaction);

      await transaction.commit();

      throw sessionClosed("session_expired");
    }

    const account = await findAccountById(accountId, transaction);

    if (!accountIsActive(account)) {
      await revokeAuthSession(sessionUuid, "account_not_active", transaction);

      await transaction.commit();

      throw forbidden("account_not_active");
    }

    const matchesCurrent =
      tokenHashesEqual(presentedHash, session.refresh_token_hash) &&
      presentedJti === session.refresh_jti;

    if (!matchesCurrent) {
      const matchesPrevious =
        tokenHashesEqual(presentedHash, session.previous_refresh_token_hash) &&
        presentedJti === session.previous_refresh_jti;

      const previousValidUntil = session.previous_refresh_valid_until
        ? new Date(session.previous_refresh_valid_until)
        : null;

      /*
       * Small grace period:
       * allows two near-simultaneous refresh requests
       * without falsely treating it as theft/reuse.
       */
      if (matchesPrevious && previousValidUntil && previousValidUntil > now) {
        throw new AuthServiceError({
          statusCode: 409,

          errorCode: "CONFLICT",

          messageKey: "errorConflict",

          details: {
            retryable: true,
            reason: "concurrent_refresh",
          },
        });
      }

      /*
       * A previously-used refresh token outside the grace window
       * is treated as token reuse.
       */
      await revokeAuthSession(sessionUuid, "refresh_reuse", transaction);

      await transaction.commit();

      throw sessionClosed("refresh_reuse");
    }

    const internalRoles = await getAccountRoles(accountId, transaction);

    const publicRoles = toPublicRoles(internalRoles);

    /*
     * Refresh session has an absolute maximum expiry.
     * Refreshing does not keep a session alive forever.
     */
    const remainingRefreshSeconds = Math.max(
      1,
      Math.floor((sessionExpiresAt.getTime() - now.getTime()) / 1000),
    );

    const nextTokens = createTokenPair({
      accountId,
      sessionUuid,
      roles: publicRoles,
      refreshExpiresInSeconds: remainingRefreshSeconds,
    });

    const config = getAuthConfig();

    const previousValidUntil = new Date(
      Date.now() + config.refreshGraceSeconds * 1000,
    );

    await rotateSessionRefreshToken({
      sessionUuid,

      currentRefreshTokenHash: session.refresh_token_hash,

      currentRefreshJti: session.refresh_jti,

      newRefreshTokenHash: nextTokens.refreshTokenHash,

      newRefreshJti: nextTokens.refreshJti,

      previousValidUntil,

      transaction,
    });

    await transaction.commit();

    return {
      accessToken: nextTokens.accessToken,

      refreshToken: nextTokens.refreshToken,

      expiresIn: nextTokens.expiresIn,
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
| Logout
|--------------------------------------------------------------------------
*/

export async function logout({ sessionUuid }) {
  await revokeAuthSession(sessionUuid, "logout");
}

export async function logoutAll({ accountId }) {
  await revokeAllAccountSessions(accountId, "logout_all");
}

/*
|--------------------------------------------------------------------------
| Current user
|--------------------------------------------------------------------------
*/

export async function getCurrentUser({ accountId }) {
  const account = await findAccountById(accountId);

  if (!accountIsActive(account)) {
    throw forbidden("account_not_active");
  }

  const internalRoles = await getAccountRoles(accountId);

  const googleIdentity = await findIdentityByAccountProvider(
    accountId,
    "google",
  );

  return buildUser(account, internalRoles, googleIdentity);
}

export async function acceptPrivacyConsent({ accountId, consent }) {
  const account = await findAccountById(accountId);
  if (!accountIsActive(account)) throw forbidden("account_not_active");

  const version = await validatePrivacyConsent({ consent, required: true });
  if (account.consent_privacy_version === version && account.consent_privacy_accepted_at) {
    return getCurrentUser({ accountId });
  }

  const transaction = await sequelize.transaction();
  try {
    await recordPrivacyConsent({
      accountId,
      version,
      channel: "app_reconsent",
      transaction,
    });
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
  return getCurrentUser({ accountId });
}

export async function updateCurrentUser({
  accountId,
  firstName,
  lastName,
  locale,
}) {
  const account = await findAccountById(accountId);

  if (!accountIsActive(account)) {
    throw forbidden("account_not_active");
  }

  const nameChanged = firstName !== undefined || lastName !== undefined;
  const nextFirstName =
    firstName !== undefined ? firstName : (account.first_name ?? null);
  const nextLastName =
    lastName !== undefined ? lastName : (account.last_name ?? null);
  const nextDisplayName = [nextFirstName, nextLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (nameChanged && !nextDisplayName) {
    throw unprocessable("profile_name_required", {
      firstName: "required",
    });
  }

  if (nameChanged && [...nextDisplayName].length > 200) {
    throw unprocessable("profile_name_too_long", {
      firstName: "combined_name_too_long",
      lastName: "combined_name_too_long",
    });
  }

  await updateAccountProfile({
    accountId,
    firstName,
    lastName,
    displayName: nameChanged ? nextDisplayName : undefined,
    locale,
  });

  return getCurrentUser({
    accountId,
  });
}

export async function uploadCurrentUserPhoto({
  accountId,
  buffer,
  contentType,
}) {
  const account = await findAccountById(accountId);

  if (!accountIsActive(account)) {
    throw forbidden("account_not_active");
  }

  let optimized;

  try {
    optimized = await optimizeProfilePhoto({ buffer, contentType });
  } catch (error) {
    if (error instanceof ProfilePhotoValidationError) {
      const diagnosticFields =
        env.NODE_ENV === "production" || !error.diagnostics
          ? {}
          : { upload: error.diagnostics };

      throw unprocessable(error.reason, {
        photo: error.reason,
        ...diagnosticFields,
      });
    }

    throw error;
  }

  const storageKey = buildProfilePhotoKey(accountId, randomUUID());

  await uploadProfilePhoto({
    storageKey,
    accountId,
    optimizedImage: optimized,
  });

  try {
    await updateAccountProfile({
      accountId,
      photoUrl: null,
      profilePhotoStorageKey: storageKey,
    });
  } catch (error) {
    try {
      await deleteFromS3(storageKey);
    } catch (cleanupError) {
      logger.error(
        {
          accountId: String(accountId),
          storageKey,
          errorName: cleanupError?.name ?? "Error",
        },
        "Unable to clean up profile photo after account update failed",
      );
    }

    throw error;
  }

  if (account.profile_photo_storage_key) {
    await deleteFromS3(account.profile_photo_storage_key).catch((error) => {
      logger.warn(
        {
          accountId: String(accountId),
          errorName: error?.name ?? "Error",
        },
        "Unable to delete replaced profile photo",
      );
    });
  }

  return getCurrentUser({ accountId });
}

export async function deleteCurrentUserPhoto({ accountId }) {
  const account = await findAccountById(accountId);

  if (!accountIsActive(account)) {
    throw forbidden("account_not_active");
  }

  if (account.profile_photo_storage_key) {
    await deleteFromS3(account.profile_photo_storage_key);
  }

  await updateAccountProfile({
    accountId,
    photoUrl: null,
    profilePhotoStorageKey: null,
  });

  return getCurrentUser({ accountId });
}
