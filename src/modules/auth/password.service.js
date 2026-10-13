import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";

import { getAuthConfig } from "../../config/auth.config.js";

import { sequelize } from "../../config/database.js";

import { logger } from "../../config/logger.js";

import { getAccountRoles } from "./auth.repository.js";

import { sendAuthOtp } from "./otp.provider.js";

import { generateOtpCode, hashOtpCode, otpHashMatches } from "./otp.service.js";

import {
  createPasswordResetToken,
  hashPasswordResetToken,
} from "./password-reset-token.service.js";

import {
  consumePasswordResetChallenge,
  createPasswordResetOtpChallenge,
  findLatestPendingPasswordResetOtpForUpdate,
  findPasswordAccountByEmail,
  findPasswordAccountByEmailForUpdate,
  findPasswordAccountByIdForUpdate,
  findPasswordResetChallengeByTokenHashForUpdate,
  getPasswordResetOtpSendStats,
  markPasswordResetOtpDeliveryFailed,
  markPasswordResetOtpExpired,
  markPasswordResetOtpVerified,
  registerFailedPasswordResetOtpAttempt,
  revokeAllAccountSessionsForPasswordReset,
  revokeOtherAccountSessionsForPasswordChange,
  supersedePendingPasswordResetChallenges,
  updateAccountPassword,
} from "./password.repository.js";

export class PasswordServiceError extends Error {
  constructor({ statusCode, errorCode, messageKey, details }) {
    super(errorCode);

    this.name = "PasswordServiceError";

    this.statusCode = statusCode;

    this.errorCode = errorCode;

    this.messageKey = messageKey;

    this.details = details ?? {
      retryable: false,
    };
  }
}

function invalidCredentials(reason = null) {
  return new PasswordServiceError({
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
  return new PasswordServiceError({
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
  return new PasswordServiceError({
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
  return new PasswordServiceError({
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

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function accountIsActive(account) {
  return Boolean(account && account.status === "active");
}

function hasPrivilegedRole(roles) {
  return roles.some((role) => role === "admin" || role === "super_admin");
}

function genericForgotPasswordResult() {
  const config = getAuthConfig();

  return {
    status: "accepted",

    expiresIn: config.otpTtlSeconds,

    resendIn: config.otpResendSeconds,
  };
}

/*
|--------------------------------------------------------------------------
| POST /auth/forgot-password
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| This endpoint is intentionally enumeration-safe.
|
| Unknown email, inactive account, privileged account,
| unverified email and delivery failure return the same
| public response.
|
*/

export async function forgotPassword({ email, locale }) {
  const config = getAuthConfig();

  const normalizedEmail = normalizeEmail(email);

  const account = await findPasswordAccountByEmail(normalizedEmail);

  /*
   * Always generic response.
   *
   * Google-only user has no forgotten Redress
   * password, so no reset OTP should be sent.
   *
   * Google-only authenticated user can use:
   * POST /auth/set-password
   */
  if (
    !account ||
    !accountIsActive(account) ||
    !account.email_verified_at ||
    !account.password_hash
  ) {
    return genericForgotPasswordResult();
  }

  const roles = await getAccountRoles(account.id);

  /*
   * Consumer forgot-password flow
   * is not for privileged accounts.
   */
  if (hasPrivilegedRole(roles)) {
    logger.warn(
      {
        accountId: String(account.id),

        event: "privileged_password_reset_blocked",
      },

      "Consumer password reset blocked for privileged account",
    );

    return genericForgotPasswordResult();
  }

  const stats = await getPasswordResetOtpSendStats(normalizedEmail);

  const now = Date.now();

  /*
   * Database UTC comparison prevents
   * previous multi-hour retryAfter issue.
   */
  if (stats.secondsSinceLastSend !== null) {
    const secondsSinceLastSend = Math.max(0, stats.secondsSinceLastSend);

    if (secondsSinceLastSend < config.otpResendSeconds) {
      return genericForgotPasswordResult();
    }
  }

  if (stats.sendsInWindow >= config.otpMaxSendsPerHour) {
    return genericForgotPasswordResult();
  }

  const challengeUuid = randomUUID();

  const code = generateOtpCode();

  const codeHash = hashOtpCode({
    purpose: "password_reset",

    channel: "email",

    destination: normalizedEmail,

    code,
  });

  const expiresAt = new Date(now + config.otpTtlSeconds * 1000);

  await supersedePendingPasswordResetChallenges(normalizedEmail);

  await createPasswordResetOtpChallenge({
    challengeUuid,

    email: normalizedEmail,

    codeHash,

    maxAttempts: config.otpMaxAttempts,

    locale,

    expiresAt,
  });

  try {
    await sendAuthOtp({
      purpose: "password_reset",

      channel: "email",

      destination: normalizedEmail,

      code,

      locale,

      expiresIn: config.otpTtlSeconds,
    });
  } catch (error) {
    await markPasswordResetOtpDeliveryFailed(challengeUuid);

    logger.error(
      {
        err: error,

        accountId: String(account.id),

        event: "password_reset_otp_delivery_failed",
      },

      "Password-reset OTP delivery failed",
    );
  }

  return genericForgotPasswordResult();
}

/*
|--------------------------------------------------------------------------
| POST /auth/forgot-password/verify
|--------------------------------------------------------------------------
*/

export async function verifyForgotPasswordOtp({ email, otp }) {
  const normalizedEmail = normalizeEmail(email);

  const transaction = await sequelize.transaction();

  try {
    const challenge = await findLatestPendingPasswordResetOtpForUpdate(
      normalizedEmail,
      transaction,
    );

    if (!challenge) {
      throw invalidCredentials("otp_invalid_or_expired");
    }

    const now = new Date();

    if (new Date(challenge.expires_at) <= now) {
      await markPasswordResetOtpExpired(challenge.id, transaction);

      await transaction.commit();

      throw invalidCredentials("otp_invalid_or_expired");
    }

    if (Number(challenge.attempts) >= Number(challenge.max_attempts)) {
      throw invalidCredentials("otp_attempts_exceeded");
    }

    const validOtp = otpHashMatches({
      purpose: "password_reset",

      channel: "email",

      destination: normalizedEmail,

      code: otp,

      expectedHash: challenge.code_hash,
    });

    if (!validOtp) {
      const attempts = Number(challenge.attempts) + 1;

      const status =
        attempts >= Number(challenge.max_attempts) ? "locked" : "pending";

      await registerFailedPasswordResetOtpAttempt(
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

    const account = await findPasswordAccountByEmailForUpdate(
      normalizedEmail,
      transaction,
    );

    /*
     * Reset flow only applies when a real
     * Redress password already exists.
     */
    if (
      !account ||
      !accountIsActive(account) ||
      !account.email_verified_at ||
      !account.password_hash
    ) {
      throw invalidCredentials("otp_invalid_or_expired");
    }

    const roles = await getAccountRoles(account.id, transaction);

    if (hasPrivilegedRole(roles)) {
      throw invalidCredentials("otp_invalid_or_expired");
    }

    const resetTokenData = createPasswordResetToken();

    await markPasswordResetOtpVerified(
      {
        challengeId: challenge.id,

        resetTokenHash: resetTokenData.tokenHash,

        resetExpiresAt: resetTokenData.expiresAt,
      },

      transaction,
    );

    await transaction.commit();

    return {
      status: "verified",

      resetToken: resetTokenData.token,

      expiresIn: resetTokenData.expiresIn,
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
| POST /auth/reset-password
|--------------------------------------------------------------------------
*/

export async function resetPassword({ resetToken, newPassword }) {
  const resetTokenHash = hashPasswordResetToken(resetToken);

  const transaction = await sequelize.transaction();

  try {
    const challenge = await findPasswordResetChallengeByTokenHashForUpdate(
      resetTokenHash,
      transaction,
    );

    if (
      !challenge ||
      !challenge.reset_expires_at ||
      new Date(challenge.reset_expires_at) <= new Date()
    ) {
      throw invalidCredentials("invalid_reset_token");
    }

    const account = await findPasswordAccountByEmailForUpdate(
      challenge.destination,
      transaction,
    );

    /*
     * A password-reset token can only reset
     * an account that already had a password.
     */
    if (
      !account ||
      !accountIsActive(account) ||
      !account.email_verified_at ||
      !account.password_hash
    ) {
      throw invalidCredentials("invalid_reset_token");
    }

    const roles = await getAccountRoles(account.id, transaction);

    if (hasPrivilegedRole(roles)) {
      throw invalidCredentials("invalid_reset_token");
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      account.password_hash,
    );

    if (samePassword) {
      throw unprocessable("password_reuse_not_allowed", {
        newPassword: "must_be_different",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await updateAccountPassword(
      {
        accountId: account.id,

        passwordHash,
      },

      transaction,
    );

    await consumePasswordResetChallenge(challenge.id, transaction);

    /*
     * Password reset revokes every
     * previously authenticated device.
     */
    await revokeAllAccountSessionsForPasswordReset(account.id, transaction);

    await transaction.commit();

    return {
      status: "password_reset",
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
| POST /auth/change-password
|--------------------------------------------------------------------------
|
| User is already authenticated.
|
| Correct current password is mandatory.
| Current session stays active.
| Other sessions are revoked.
|
*/

export async function changePassword({
  accountId,
  sessionUuid,
  currentPassword,
  newPassword,
}) {
  const transaction = await sequelize.transaction();

  try {
    const account = await findPasswordAccountByIdForUpdate(
      accountId,
      transaction,
    );

    if (!account || !accountIsActive(account)) {
      throw forbidden("account_not_active");
    }

    if (!account.password_hash) {
      throw conflict("password_not_set");
    }

    const currentPasswordValid = await bcrypt.compare(
      currentPassword,
      account.password_hash,
    );

    if (!currentPasswordValid) {
      throw invalidCredentials("current_password_invalid");
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      account.password_hash,
    );

    if (samePassword) {
      throw unprocessable("password_reuse_not_allowed", {
        newPassword: "must_be_different",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await updateAccountPassword(
      {
        accountId: account.id,

        passwordHash,
      },
      transaction,
    );

    /*
     * Keep only current verified session.
     */
    await revokeOtherAccountSessionsForPasswordChange(
      account.id,
      sessionUuid,
      transaction,
    );

    await transaction.commit();

    return {
      status: "password_changed",
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
| POST /auth/set-password
|--------------------------------------------------------------------------
|
| Explicit account-linking policy:
|
| This is for authenticated accounts that currently
| do NOT have a Redress password.
|
| Typical case:
|
| Google signup
| -> verified Google email
| -> password_hash NULL
| -> user chooses "Set password"
|
| Phone-only account without verified email cannot
| use email/password login yet, therefore it cannot
| set a password through this endpoint.
|
*/

export async function setPassword({ accountId, newPassword }) {
  const transaction = await sequelize.transaction();

  try {
    const account = await findPasswordAccountByIdForUpdate(
      accountId,
      transaction,
    );

    if (!account || !accountIsActive(account)) {
      throw forbidden("account_not_active");
    }

    /*
     * Email/password login requires a verified email.
     */
    if (!account.email || !account.email_verified_at) {
      throw unprocessable("verified_email_required", {
        email: "verified_email_required",
      });
    }

    if (account.password_hash) {
      throw conflict("password_already_set");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await updateAccountPassword(
      {
        accountId: account.id,

        passwordHash,
      },
      transaction,
    );

    await transaction.commit();

    return {
      status: "password_set",
    };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}
