import { beforeEach, describe, expect, it, vi } from "vitest";

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

  return {
    repository,
    transaction: {
      finished: undefined,
      commit: vi.fn(),
      rollback: vi.fn(),
    },
    sequelize: {
      transaction: vi.fn(),
    },
    verifyGoogleIdToken: vi.fn(),
  };
});

vi.mock("../src/config/database.js", () => ({
  sequelize: state.sequelize,
}));

vi.mock("../src/modules/auth/auth.repository.js", () => state.repository);

vi.mock("../src/modules/auth/otp.provider.js", () => ({
  sendAuthOtp: vi.fn(),
}));

vi.mock("../src/modules/auth/google.service.js", () => ({
  GoogleAuthConfigurationError: class GoogleAuthConfigurationError extends Error {},
  verifyGoogleIdToken: state.verifyGoogleIdToken,
}));

import { googleLogin } from "../src/modules/auth/auth.service.js";

const clientContext = {
  idToken: "google-id-token",
  locale: "en",
  clientType: "mobile",
  deviceType: "android",
  deviceName: "Pixel",
  userAgent: "Redress test",
  ipAddress: "127.0.0.1",
};

function account(overrides = {}) {
  return {
    id: 42,
    status: "active",
    email: "owner@gmail.com",
    email_verified_at: new Date(),
    password_hash: null,
    first_name: "Ada",
    last_name: "Lovelace",
    display_name: "Ada Lovelace",
    photo_url: null,
    phone: null,
    phone_verified_at: null,
    locale: "en",
    ...overrides,
  };
}

function googleIdentity(overrides = {}) {
  return {
    subject: "google-subject-123",
    email: "owner@gmail.com",
    displayName: "Ada Lovelace",
    firstName: "Ada",
    lastName: "Lovelace",
    photoUrl: "https://lh3.googleusercontent.com/avatar.png",
    hostedDomain: null,
    emailAuthoritative: true,
    ...overrides,
  };
}

describe("Google authentication", () => {
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
    state.repository.getAccountRoles.mockResolvedValue(["customer"]);
    state.repository.getCurrentPrivacyPolicyVersion.mockResolvedValue(null);
    state.repository.getAccountFitSetupSnapshot.mockResolvedValue(null);
  });

  it("logs in an existing account by the stable Google subject", async () => {
    const existingAccount = account();

    state.verifyGoogleIdToken.mockResolvedValue(googleIdentity());
    state.repository.findIdentityByProviderSubject.mockResolvedValue({
      id: 77,
      account_id: existingAccount.id,
      provider_subject: "google-subject-123",
    });
    state.repository.findAccountById.mockResolvedValue(existingAccount);
    state.repository.findIdentityByAccountProvider.mockResolvedValue({
      provider_subject: "google-subject-123",
    });

    const result = await googleLogin(clientContext);

    expect(result.status).toBe("authenticated");
    expect(result.user).toMatchObject({
      id: "42",
      email: "owner@gmail.com",
      googleLinked: true,
    });
    expect(state.repository.findAccountByEmail).not.toHaveBeenCalled();
    expect(state.repository.createAccount).not.toHaveBeenCalled();
    expect(
      state.repository.updateAccountIdentityProviderEmail,
    ).toHaveBeenCalledWith(
      { identityId: 77, providerEmail: "owner@gmail.com" },
      state.transaction,
    );
    expect(
      state.repository.fillAccountGoogleProfileIfMissing,
    ).not.toHaveBeenCalled();
    expect(state.repository.createAuthSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 42,
        authMethod: "google",
      }),
    );
    expect(state.transaction.commit).toHaveBeenCalledTimes(1);
  });

  it("auto-links an authoritative Gmail identity to a customer account", async () => {
    const existingAccount = account({
      email_verified_at: null,
    });
    const verifiedAccount = account();

    state.verifyGoogleIdToken.mockResolvedValue(googleIdentity());
    state.repository.findIdentityByProviderSubject.mockResolvedValue(null);
    state.repository.findAccountByEmail.mockResolvedValue(existingAccount);
    state.repository.findIdentityByAccountProvider
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        provider_subject: "google-subject-123",
      });
    state.repository.findAccountById.mockResolvedValue(verifiedAccount);

    const result = await googleLogin(clientContext);

    expect(state.repository.createAccountIdentity).toHaveBeenCalledWith(
      {
        accountId: 42,
        provider: "google",
        providerSubject: "google-subject-123",
        providerEmail: "owner@gmail.com",
      },
      state.transaction,
    );
    expect(state.repository.updateAccountEmailVerified).toHaveBeenCalledWith(
      { accountId: 42 },
      state.transaction,
    );
    expect(
      state.repository.fillAccountGoogleProfileIfMissing,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 42,
        firstName: "Ada",
        lastName: "Lovelace",
      }),
      state.transaction,
    );
    expect(result.status).toBe("authenticated");
    expect(state.transaction.commit).toHaveBeenCalledTimes(1);
  });

  it("does not auto-link a non-authoritative email to an existing account", async () => {
    state.verifyGoogleIdToken.mockResolvedValue(
      googleIdentity({
        email: "owner@example.net",
        emailAuthoritative: false,
      }),
    );
    state.repository.findIdentityByProviderSubject.mockResolvedValue(null);
    state.repository.findAccountByEmail.mockResolvedValue(
      account({
        email: "owner@example.net",
      }),
    );

    await expect(googleLogin(clientContext)).rejects.toMatchObject({
      statusCode: 409,
      errorCode: "CONFLICT",
      details: {
        reason: "google_link_requires_existing_auth",
      },
    });

    expect(state.repository.createAccountIdentity).not.toHaveBeenCalled();
    expect(state.repository.createAuthSession).not.toHaveBeenCalled();
    expect(state.transaction.rollback).toHaveBeenCalledTimes(1);
  });

  it("creates a passwordless customer account for a new Google user", async () => {
    const createdAccount = account();

    state.verifyGoogleIdToken.mockResolvedValue(googleIdentity());
    state.repository.findIdentityByProviderSubject.mockResolvedValue(null);
    state.repository.findAccountByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdAccount);
    state.repository.findRoleByCode.mockResolvedValue({ id: 3 });
    state.repository.findIdentityByAccountProvider.mockResolvedValue({
      provider_subject: "google-subject-123",
    });

    const result = await googleLogin(clientContext);

    expect(state.repository.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@gmail.com",
        passwordHash: null,
        phone: null,
        emailVerifiedAt: expect.any(Date),
      }),
      state.transaction,
    );
    expect(state.repository.assignAccountRole).toHaveBeenCalledWith(
      {
        accountId: 42,
        roleId: 3,
      },
      state.transaction,
    );
    expect(state.repository.createAccountIdentity).toHaveBeenCalled();
    expect(result.status).toBe("authenticated");
    expect(state.transaction.commit).toHaveBeenCalledTimes(1);
  });

  it("defers a new Google user to the consent signup flow when the new contract is requested", async () => {
    state.verifyGoogleIdToken.mockResolvedValue(googleIdentity());
    state.repository.findIdentityByProviderSubject.mockResolvedValue(null);
    state.repository.findAccountByEmail.mockResolvedValue(null);

    const result = await googleLogin({
      ...clientContext,
      enforceSignupConsent: true,
    });

    expect(result).toMatchObject({
      status: "signup_required",
      email: "owner@gmail.com",
      fullName: "Ada Lovelace",
      photoUrl: "https://lh3.googleusercontent.com/avatar.png",
    });
    expect(result.signupToken).toEqual(expect.any(String));
    expect(state.repository.createSignupProof).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "google_signup",
        subject: "google-subject-123",
        email: "owner@gmail.com",
      }),
      state.transaction,
    );
    expect(state.repository.createAccount).not.toHaveBeenCalled();
    expect(state.repository.createAuthSession).not.toHaveBeenCalled();
  });

  it("does not mark a new third-party Google email as authoritative", async () => {
    const externalAccount = account({
      email: "owner@example.net",
      email_verified_at: null,
    });

    state.verifyGoogleIdToken.mockResolvedValue(
      googleIdentity({
        email: "owner@example.net",
        emailAuthoritative: false,
      }),
    );
    state.repository.findIdentityByProviderSubject.mockResolvedValue(null);
    state.repository.findAccountByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(externalAccount);
    state.repository.findRoleByCode.mockResolvedValue({ id: 3 });
    state.repository.findIdentityByAccountProvider.mockResolvedValue({
      provider_subject: "google-subject-123",
    });

    await googleLogin(clientContext);

    expect(state.repository.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@example.net",
        emailVerifiedAt: null,
      }),
      state.transaction,
    );
  });
});
