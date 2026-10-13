import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const state = vi.hoisted(() => {
  const repository = {};

  const repositoryFunctions = [
    "assignAccountRole",
    "createAccount",
    "createAccountIdentity",
    "createAuthSession",
    "createOtpChallenge",
    "createSignupProof",
    "createUserPrivacyConsent",
    "fillAccountGoogleProfileIfMissing",
    "findAccountByEmail",
    "findAccountById",
    "findAccountByIdForUpdate",
    "findAccountByPhone",
    "findAuthSessionForUpdate",
    "findIdentityByAccountProvider",
    "findIdentityByProviderSubject",
    "findLatestPendingOtpForUpdate",
    "findOtpChallengeByUuidForUpdate",
    "findSignupProofForUpdate",
    "findRoleByCode",
    "getAccountRoles",
    "getAccountFitSetupSnapshot",
    "getCurrentPrivacyPolicyVersion",
    "getOtpSendStats",
    "markOtpConsumed",
    "markOtpDeliveryFailed",
    "markOtpExpired",
    "markOtpVerifiedWithSignupToken",
    "markSignupProofConsumed",
    "registerFailedOtpAttempt",
    "revokeAllAccountSessions",
    "revokeAuthSession",
    "revokeOtherAccountSessions",
    "rotateSessionRefreshToken",
    "supersedePendingOtpChallenges",
    "updateAccountEmailVerified",
    "updateAccountEmailVerifiedAddress",
    "updateAccountIdentityProviderEmail",
    "updateAccountPhoneVerified",
    "updateAccountProfile",
    "updateAccountPrivacyConsent",
    "updateLastLoginAt",
  ];

  for (const name of repositoryFunctions) {
    repository[name] = vi.fn();
  }

  const transaction = {
    finished: undefined,

    commit: vi.fn(),

    rollback: vi.fn(),
  };

  const sequelize = {
    transaction: vi.fn(),
  };

  const sendAuthOtp = vi.fn();
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  const s3 = {
    buildProfilePhotoKey: vi.fn(),
    deleteFromS3: vi.fn(),
  };

  const profilePhoto = {
    optimizeProfilePhoto: vi.fn(),
    uploadProfilePhoto: vi.fn(),
    ProfilePhotoValidationError: class ProfilePhotoValidationError extends Error {},
  };

  const mediaUrl = {
    createMediaUrl: vi.fn(),
  };

  return {
    repository,
    transaction,
    sequelize,
    sendAuthOtp,
    logger,
    s3,
    profilePhoto,
    mediaUrl,
  };
});

vi.mock("../src/config/database.js", () => ({
  sequelize: state.sequelize,
}));

vi.mock("../src/config/logger.js", () => ({
  logger: state.logger,
}));

vi.mock("../src/modules/auth/auth.repository.js", () => state.repository);

vi.mock("../src/modules/auth/otp.provider.js", () => ({
  sendAuthOtp: state.sendAuthOtp,
}));

vi.mock("../src/services/s3.service.js", () => state.s3);

vi.mock("../src/services/profile-photo.service.js", () => state.profilePhoto);
vi.mock("../src/services/media-url.service.js", () => state.mediaUrl);

vi.mock("../src/modules/auth/google.service.js", () => ({
  GoogleAuthConfigurationError: class GoogleAuthConfigurationError extends Error {},

  verifyGoogleIdToken: vi.fn(),
}));

import {
  deleteCurrentUserPhoto,
  login,
  requestCurrentAccountEmailChange,
  sendOtp,
  signup,
  updateCurrentUser,
  uploadCurrentUserPhoto,
  verifyCurrentAccountEmailChange,
  verifyOtp,
} from "../src/modules/auth/auth.service.js";

import { createSignupToken } from "../src/modules/auth/token.service.js";

import { hashOtpCode } from "../src/modules/auth/otp.service.js";

describe("auth security policies", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    state.transaction.finished = undefined;

    state.transaction.commit.mockImplementation(async () => {
      state.transaction.finished = "commit";
    });

    state.transaction.rollback.mockImplementation(async () => {
      state.transaction.finished = "rollback";
    });

    state.sequelize.transaction.mockResolvedValue(state.transaction);
    state.repository.getCurrentPrivacyPolicyVersion.mockResolvedValue(null);
    state.repository.getAccountFitSetupSnapshot.mockResolvedValue(null);

    state.repository.getOtpSendStats.mockResolvedValue({
      lastCreatedAt: null,

      secondsSinceLastSend: null,

      sendsInWindow: 0,
    });

    state.sendAuthOtp.mockResolvedValue(undefined);

    state.s3.buildProfilePhotoKey.mockReturnValue("profiles/10/photo-id.webp");
    state.s3.deleteFromS3.mockResolvedValue(true);
    state.mediaUrl.createMediaUrl.mockReturnValue(
      "https://api.example/api/v1/media/opaque-token",
    );
    state.profilePhoto.optimizeProfilePhoto.mockResolvedValue({
      buffer: Buffer.from("optimized"),
      contentType: "image/webp",
      width: 256,
      height: 256,
      sizeBytes: 9,
    });
    state.profilePhoto.uploadProfilePhoto.mockResolvedValue({ etag: "etag" });
  });

  it("requires authentication before issuing phone_link OTP", async () => {
    await expect(
      sendOtp({
        purpose: "phone_link",

        channel: "sms",

        phone: "+393331234567",

        locale: "en",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,

      errorCode: "FORBIDDEN",

      details: {
        reason: "authentication_required_for_phone_link",
      },
    });

    expect(state.repository.createOtpChallenge).not.toHaveBeenCalled();

    expect(state.sendAuthOtp).not.toHaveBeenCalled();
  });

  it("keeps phone_link purpose through storage and delivery", async () => {
    const phone = "+393331234567";

    state.repository.findAccountById.mockResolvedValue({
      id: 10,

      status: "active",
    });

    state.repository.findAccountByPhone.mockResolvedValue(null);

    await sendOtp({
      purpose: "phone_link",

      channel: "sms",

      phone,

      locale: "en",

      accountId: "10",
    });

    expect(state.repository.getOtpSendStats).toHaveBeenCalledWith(
      "phone_link",
      "sms",
      phone,
    );

    expect(state.repository.supersedePendingOtpChallenges).toHaveBeenCalledWith(
      "phone_link",
      "sms",
      phone,
      "10",
    );

    expect(state.repository.createOtpChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "phone_link",

        channel: "sms",

        destination: phone,

        accountId: "10",
      }),
    );

    expect(state.sendAuthOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "phone_link",

        channel: "sms",

        destination: phone,
      }),
    );
  });

  it("logs OTP provider failures with the request id but without the destination", async () => {
    state.sendAuthOtp.mockRejectedValue(
      new Error("SMS provider returned HTTP 503."),
    );

    await expect(
      sendOtp({
        channel: "sms",
        phone: "+393331234567",
        locale: "en",
        requestId: "request-123",
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      errorCode: "INTERNAL",
      details: {
        reason: "otp_delivery_failed",
      },
    });

    expect(state.repository.markOtpDeliveryFailed).toHaveBeenCalledTimes(1);
    expect(state.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "request-123",
        event: "otp_delivery_failed",
        purpose: "auth",
        channel: "sms",
        error: expect.objectContaining({
          message: "SMS provider returned HTTP 503.",
        }),
      }),
      "OTP delivery failed",
    );
    expect(state.logger.error.mock.calls[0][0]).not.toHaveProperty("destination");
  });

  it("binds an email-change OTP to the authenticated account", async () => {
    state.repository.findAccountById.mockResolvedValue({
      id: 10,
      status: "active",
      email: "old@example.com",
      email_verified_at: new Date(),
    });
    state.repository.findAccountByEmail.mockResolvedValue(null);

    await requestCurrentAccountEmailChange({
      accountId: "10",
      newEmail: "NEW@example.com",
      locale: "en",
    });

    expect(state.repository.createOtpChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "10",
        purpose: "email_change",
        channel: "email",
        destination: "new@example.com",
      }),
    );
  });

  it("atomically verifies an account-bound email change", async () => {
    const destination = "new@example.com";

    state.repository.findLatestPendingOtpForUpdate.mockResolvedValue({
      id: 550,
      attempts: 0,
      max_attempts: 5,
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
      code_hash: hashOtpCode({
        purpose: "email_change",
        channel: "email",
        destination,
        code: "123456",
      }),
    });
    state.repository.findAccountByIdForUpdate.mockResolvedValue({
      id: 10,
      status: "active",
    });
    state.repository.findAccountByEmail.mockResolvedValue(null);
    state.repository.findAccountById.mockResolvedValue({
      id: 10,
      status: "active",
      email: destination,
      email_verified_at: new Date(),
      first_name: "Ada",
      last_name: "Rossi",
      locale: "en",
    });
    state.repository.getAccountRoles.mockResolvedValue(["customer"]);
    state.repository.findIdentityByAccountProvider.mockResolvedValue(null);

    const user = await verifyCurrentAccountEmailChange({
      accountId: "10",
      sessionUuid: "current-session",
      newEmail: "NEW@example.com",
      otp: "123456",
    });

    expect(state.repository.findLatestPendingOtpForUpdate).toHaveBeenCalledWith(
      "email_change",
      "email",
      destination,
      state.transaction,
      "10",
    );
    expect(
      state.repository.updateAccountEmailVerifiedAddress,
    ).toHaveBeenCalledWith(
      { accountId: 10, email: destination },
      state.transaction,
    );
    expect(state.repository.revokeOtherAccountSessions).toHaveBeenCalledWith(
      10,
      "current-session",
      "email_changed",
      state.transaction,
    );
    expect(user).toMatchObject({
      email: destination,
      emailVerified: true,
    });
  });

  it("updates canonical names and keeps display name synchronized", async () => {
    state.repository.findAccountById
      .mockResolvedValueOnce({
        id: 10,
        status: "active",
        first_name: "Ada",
        last_name: "Rossi",
      })
      .mockResolvedValueOnce({
        id: 10,
        status: "active",
        first_name: "Ada Maria",
        last_name: null,
        display_name: "Ada Maria",
        locale: "en",
      });
    state.repository.getAccountRoles.mockResolvedValue(["customer"]);
    state.repository.findIdentityByAccountProvider.mockResolvedValue(null);

    const user = await updateCurrentUser({
      accountId: "10",
      firstName: "Ada Maria",
      lastName: null,
    });

    expect(state.repository.updateAccountProfile).toHaveBeenCalledWith({
      accountId: "10",
      firstName: "Ada Maria",
      lastName: null,
      displayName: "Ada Maria",
      locale: undefined,
    });
    expect(user).toMatchObject({
      firstName: "Ada Maria",
      lastName: null,
      displayName: "Ada Maria",
    });
  });

  it("uploads a private profile photo without requiring S3 delete permission", async () => {
    state.s3.deleteFromS3.mockRejectedValue(
      Object.assign(new Error("delete denied"), { name: "AccessDenied" }),
    );
    state.repository.findAccountById
      .mockResolvedValueOnce({
        id: 10,
        status: "active",
        profile_photo_storage_key: null,
      })
      .mockResolvedValueOnce({
        id: 10,
        status: "active",
        first_name: "Ada",
        last_name: "Rossi",
        profile_photo_storage_key: "profiles/10/photo-id.webp",
        locale: "en",
      });
    state.repository.getAccountRoles.mockResolvedValue(["customer"]);
    state.repository.findIdentityByAccountProvider.mockResolvedValue(null);

    const user = await uploadCurrentUserPhoto({
      accountId: "10",
      buffer: Buffer.from("jpeg"),
      contentType: "image/jpeg",
    });

    expect(state.s3.deleteFromS3).not.toHaveBeenCalled();
    expect(state.profilePhoto.uploadProfilePhoto).toHaveBeenCalledWith({
      storageKey: "profiles/10/photo-id.webp",
      accountId: "10",
      optimizedImage: expect.objectContaining({
        contentType: "image/webp",
        width: 256,
        height: 256,
      }),
    });
    expect(state.repository.updateAccountProfile).toHaveBeenCalledWith({
      accountId: "10",
      photoUrl: null,
      profilePhotoStorageKey: "profiles/10/photo-id.webp",
    });
    expect(user.photoUrl).toBe(
      "https://api.example/api/v1/media/opaque-token",
    );
  });

  it("keeps a successful replacement when old-photo cleanup is denied", async () => {
    state.repository.findAccountById
      .mockResolvedValueOnce({
        id: 10,
        status: "active",
        profile_photo_storage_key: "profiles/10/old-photo.webp",
      })
      .mockResolvedValueOnce({
        id: 10,
        status: "active",
        first_name: "Ada",
        last_name: "Rossi",
        profile_photo_storage_key: "profiles/10/photo-id.webp",
        locale: "en",
      });
    state.repository.getAccountRoles.mockResolvedValue(["customer"]);
    state.repository.findIdentityByAccountProvider.mockResolvedValue(null);
    state.s3.deleteFromS3.mockRejectedValue(
      Object.assign(new Error("delete denied"), { name: "AccessDenied" }),
    );

    const user = await uploadCurrentUserPhoto({
      accountId: "10",
      buffer: Buffer.from("jpeg"),
      contentType: "image/jpeg",
    });

    expect(state.profilePhoto.uploadProfilePhoto).toHaveBeenCalledOnce();
    expect(state.repository.updateAccountProfile).toHaveBeenCalledWith({
      accountId: "10",
      photoUrl: null,
      profilePhotoStorageKey: "profiles/10/photo-id.webp",
    });
    expect(state.s3.deleteFromS3).toHaveBeenCalledWith(
      "profiles/10/old-photo.webp",
    );
    expect(user.photoUrl).toBe(
      "https://api.example/api/v1/media/opaque-token",
    );
  });

  it("deletes a replaced profile object only after its database key is updated", async () => {
    state.repository.findAccountById
      .mockResolvedValueOnce({
        id: 10,
        status: "active",
        profile_photo_storage_key: "profiles/10/old-photo.webp",
      })
      .mockResolvedValueOnce({
        id: 10,
        status: "active",
        first_name: "Ada",
        last_name: "Rossi",
        profile_photo_storage_key: "profiles/10/photo-id.webp",
        locale: "en",
      });
    state.repository.getAccountRoles.mockResolvedValue(["customer"]);
    state.repository.findIdentityByAccountProvider.mockResolvedValue(null);

    await uploadCurrentUserPhoto({
      accountId: "10",
      buffer: Buffer.from("jpeg"),
      contentType: "image/jpeg",
    });

    expect(state.s3.deleteFromS3).toHaveBeenCalledWith(
      "profiles/10/old-photo.webp",
    );
    expect(
      state.repository.updateAccountProfile.mock.invocationCallOrder[0],
    ).toBeLessThan(state.s3.deleteFromS3.mock.invocationCallOrder[0]);
  });

  it("deletes a newly uploaded profile object when its database update fails", async () => {
    state.repository.findAccountById.mockResolvedValue({
      id: 10,
      status: "active",
      profile_photo_storage_key: null,
    });
    state.repository.updateAccountProfile.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    await expect(
      uploadCurrentUserPhoto({
        accountId: "10",
        buffer: Buffer.from("jpeg"),
        contentType: "image/jpeg",
      }),
    ).rejects.toThrow("database unavailable");

    expect(state.s3.deleteFromS3).toHaveBeenCalledWith(
      "profiles/10/photo-id.webp",
    );
  });

  it("preserves the database error and logs failed S3 cleanup after a failed update", async () => {
    const databaseError = new Error("database unavailable");
    state.repository.findAccountById.mockResolvedValue({
      id: 10,
      status: "active",
      profile_photo_storage_key: null,
    });
    state.repository.updateAccountProfile.mockRejectedValueOnce(databaseError);
    state.s3.deleteFromS3.mockRejectedValueOnce(
      Object.assign(new Error("delete denied"), { name: "AccessDenied" }),
    );

    await expect(
      uploadCurrentUserPhoto({
        accountId: "10",
        buffer: Buffer.from("jpeg"),
        contentType: "image/jpeg",
      }),
    ).rejects.toBe(databaseError);

    expect(state.s3.deleteFromS3).toHaveBeenCalledWith(
      "profiles/10/photo-id.webp",
    );
  });

  it("keeps the database photo reference when S3 deletion is denied", async () => {
    state.repository.findAccountById.mockResolvedValue({
      id: 10,
      status: "active",
      profile_photo_storage_key: "profiles/10/photo-id.webp",
    });
    state.s3.deleteFromS3.mockRejectedValue(
      Object.assign(new Error("denied"), { name: "AccessDenied" }),
    );

    await expect(
      deleteCurrentUserPhoto({ accountId: "10" }),
    ).rejects.toMatchObject({ name: "AccessDenied" });

    expect(state.repository.updateAccountProfile).not.toHaveBeenCalled();
  });

  it("public OTP verification only queries purpose auth", async () => {
    state.repository.findLatestPendingOtpForUpdate.mockResolvedValue(null);

    await expect(
      verifyOtp({
        channel: "email",

        email: "ada@example.com",

        otp: "123456",

        locale: "en",
      }),
    ).rejects.toMatchObject({
      errorCode: "INVALID_CREDENTIALS",

      details: {
        reason: "otp_invalid_or_expired",
      },
    });

    expect(state.repository.findLatestPendingOtpForUpdate).toHaveBeenCalledWith(
      "auth",
      "email",
      "ada@example.com",
      state.transaction,
    );
  });

  it("blocks customer OTP login for admin", async () => {
    const phone = "+393331234567";

    state.repository.findLatestPendingOtpForUpdate.mockResolvedValue({
      id: 501,

      challenge_uuid: "550e8400-e29b-41d4-a716-446655440000",

      attempts: 0,

      max_attempts: 5,

      expires_at: new Date(Date.now() + 5 * 60 * 1000),

      code_hash: hashOtpCode({
        purpose: "auth",

        channel: "sms",

        destination: phone,

        code: "123456",
      }),
    });

    state.repository.findAccountByPhone.mockResolvedValue({
      id: 99,

      status: "active",

      phone,

      phone_verified_at: new Date(),
    });

    state.repository.getAccountRoles.mockResolvedValue(["admin"]);

    await expect(
      verifyOtp({
        channel: "sms",

        phone,

        otp: "123456",

        locale: "en",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,

      errorCode: "FORBIDDEN",

      details: {
        reason: "otp_login_not_allowed_for_privileged_account",
      },
    });

    expect(state.repository.markOtpConsumed).toHaveBeenCalledWith(
      501,
      state.transaction,
    );

    expect(state.transaction.commit).toHaveBeenCalledTimes(1);
  });

  it("records phone_otp as the authentication method for a phone OTP session", async () => {
    const phone = "+393331234567";

    state.repository.findLatestPendingOtpForUpdate.mockResolvedValue({
      id: 502,

      challenge_uuid: "550e8400-e29b-41d4-a716-446655440010",

      attempts: 0,

      max_attempts: 5,

      expires_at: new Date(Date.now() + 5 * 60 * 1000),

      code_hash: hashOtpCode({
        purpose: "auth",

        channel: "sms",

        destination: phone,

        code: "123456",
      }),
    });

    state.repository.findAccountByPhone.mockResolvedValue({
      id: 100,

      status: "active",

      phone,

      phone_verified_at: new Date(),
    });

    state.repository.getAccountRoles.mockResolvedValue(["customer"]);

    await verifyOtp({
      channel: "sms",

      phone,

      otp: "123456",

      clientType: "native",

      locale: "en",
    });

    expect(state.repository.createAuthSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 100,

        authMethod: "phone_otp",
      }),
    );
  });

  it("records email_password as the authentication method for password login", async () => {
    const password = "Kite#482m";

    state.repository.findAccountByEmail.mockResolvedValue({
      id: 101,

      status: "active",

      email: "ada@example.com",

      email_verified_at: new Date(),

      password_hash: await bcrypt.hash(password, 4),
    });

    state.repository.getAccountRoles.mockResolvedValue(["customer"]);

    await login({
      email: "ada@example.com",

      password,

      clientType: "web",
    });

    expect(state.repository.createAuthSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 101,

        authMethod: "email_password",
      }),
    );
  });

  it("rejects signup token backed by non-auth OTP challenge", async () => {
    const tokenData = createSignupToken({
      challengeUuid: "550e8400-e29b-41d4-a716-446655440001",

      channel: "email",

      destination: "ada@example.com",

      locale: "en",
    });

    state.repository.findOtpChallengeByUuidForUpdate.mockResolvedValue({
      id: 601,

      status: "verified",

      purpose: "phone_link",

      channel: "email",

      destination: "ada@example.com",

      signup_jti: tokenData.signupJti,

      signup_token_hash: tokenData.tokenHash,

      signup_expires_at: tokenData.expiresAt,
    });

    await expect(
      signup({
        signupToken: tokenData.token,

        fullName: "Ada Rossi",

        password: "Kite#482m",

        locale: "en",
      }),
    ).rejects.toMatchObject({
      errorCode: "UNPROCESSABLE",

      details: {
        reason: "signup_token_invalid",
      },
    });
  });

  it("prevents duplicate email signup", async () => {
    const tokenData = createSignupToken({
      challengeUuid: "550e8400-e29b-41d4-a716-446655440002",

      channel: "email",

      destination: "ada@example.com",

      locale: "en",
    });

    state.repository.findOtpChallengeByUuidForUpdate.mockResolvedValue({
      id: 602,

      status: "verified",

      purpose: "auth",

      channel: "email",

      destination: "ada@example.com",

      signup_jti: tokenData.signupJti,

      signup_token_hash: tokenData.tokenHash,

      signup_expires_at: tokenData.expiresAt,
    });

    state.repository.findAccountByEmail.mockResolvedValue({
      id: 7,

      status: "active",

      email: "ada@example.com",
    });

    await expect(
      signup({
        signupToken: tokenData.token,

        fullName: "Ada Rossi",

        password: "Kite#482m",

        locale: "en",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,

      errorCode: "CONFLICT",

      details: {
        reason: "email_already_in_use",
      },
    });

    expect(state.repository.createAccount).not.toHaveBeenCalled();
  });

  it("reports a weak email-signup password after validating its proof and consent", async () => {
    const tokenData = createSignupToken({
      challengeUuid: "550e8400-e29b-41d4-a716-446655440003",
      channel: "email",
      destination: "ada@example.com",
      locale: "en",
    });
    state.repository.findOtpChallengeByUuidForUpdate.mockResolvedValue({
      id: 603,
      status: "verified",
      purpose: "auth",
      channel: "email",
      destination: "ada@example.com",
      signup_jti: tokenData.signupJti,
      signup_token_hash: tokenData.tokenHash,
      signup_expires_at: tokenData.expiresAt,
    });
    state.repository.getCurrentPrivacyPolicyVersion.mockResolvedValue(
      "2026-10-01T00:00:00.000Z",
    );

    await expect(
      signup({
        signupToken: tokenData.token,
        fullName: "Ada Rossi",
        password: "password",
        consent: {
          privacyAccepted: true,
          privacyVersion: "2026-10-01T00:00:00.000Z",
        },
        enforceSignupConsent: true,
        locale: "en",
      }),
    ).rejects.toMatchObject({
      errorCode: "UNPROCESSABLE",
      details: { fields: { password: "weak" } },
    });
    expect(state.repository.createAccount).not.toHaveBeenCalled();
  });
});
