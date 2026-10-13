import bcrypt from "bcryptjs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const passwordRepository = {};

  const functions = [
    "consumePasswordResetChallenge",
    "createPasswordResetOtpChallenge",
    "findLatestPendingPasswordResetOtpForUpdate",
    "findPasswordAccountByEmail",
    "findPasswordAccountByEmailForUpdate",
    "findPasswordAccountByIdForUpdate",
    "findPasswordResetChallengeByTokenHashForUpdate",
    "getPasswordResetOtpSendStats",
    "markPasswordResetOtpDeliveryFailed",
    "markPasswordResetOtpExpired",
    "markPasswordResetOtpVerified",
    "registerFailedPasswordResetOtpAttempt",
    "revokeAllAccountSessionsForPasswordReset",
    "revokeOtherAccountSessionsForPasswordChange",
    "supersedePendingPasswordResetChallenges",
    "updateAccountPassword",
  ];

  for (const name of functions) {
    passwordRepository[name] = vi.fn();
  }

  const getAccountRoles = vi.fn();

  const sendAuthOtp = vi.fn();

  const transaction = {
    finished: undefined,

    commit: vi.fn(),

    rollback: vi.fn(),
  };

  const sequelize = {
    transaction: vi.fn(),
  };

  return {
    passwordRepository,
    getAccountRoles,
    sendAuthOtp,
    transaction,
    sequelize,
  };
});

vi.mock("../src/config/database.js", () => ({
  sequelize: state.sequelize,
}));

vi.mock(
  "../src/modules/auth/password.repository.js",
  () => state.passwordRepository,
);

vi.mock("../src/modules/auth/auth.repository.js", () => ({
  getAccountRoles: state.getAccountRoles,
}));

vi.mock("../src/modules/auth/otp.provider.js", () => ({
  sendAuthOtp: state.sendAuthOtp,
}));

import {
  changePassword,
  forgotPassword,
  resetPassword,
  setPassword,
} from "../src/modules/auth/password.service.js";

describe("password security policies", () => {
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
  });

  it("returns same forgot response for unknown account", async () => {
    state.passwordRepository.findPasswordAccountByEmail.mockResolvedValue(null);

    const result = await forgotPassword({
      email: "unknown@example.com",

      locale: "en",
    });

    expect(result).toEqual({
      status: "accepted",

      expiresIn: 300,

      resendIn: 60,
    });

    expect(state.sendAuthOtp).not.toHaveBeenCalled();
  });

  it("does not send reset OTP to Google-only account", async () => {
    state.passwordRepository.findPasswordAccountByEmail.mockResolvedValue({
      id: 10,

      status: "active",

      email: "google@example.com",

      email_verified_at: new Date(),

      password_hash: null,
    });

    const result = await forgotPassword({
      email: "google@example.com",

      locale: "en",
    });

    expect(result.status).toBe("accepted");

    expect(state.sendAuthOtp).not.toHaveBeenCalled();
  });

  it("does not expose privileged forgot-password account", async () => {
    state.passwordRepository.findPasswordAccountByEmail.mockResolvedValue({
      id: 11,

      status: "active",

      email: "admin@example.com",

      email_verified_at: new Date(),

      password_hash: "$2b$12$example",
    });

    state.getAccountRoles.mockResolvedValue(["super_admin"]);

    const result = await forgotPassword({
      email: "admin@example.com",

      locale: "en",
    });

    expect(result.status).toBe("accepted");

    expect(state.sendAuthOtp).not.toHaveBeenCalled();
  });

  it("sends password_reset OTP only to verified password account", async () => {
    state.passwordRepository.findPasswordAccountByEmail.mockResolvedValue({
      id: 12,

      status: "active",

      email: "customer@example.com",

      email_verified_at: new Date(),

      password_hash: "$2b$12$example",
    });

    state.getAccountRoles.mockResolvedValue(["customer"]);

    state.passwordRepository.getPasswordResetOtpSendStats.mockResolvedValue({
      lastCreatedAt: null,

      secondsSinceLastSend: null,

      sendsInWindow: 0,
    });

    state.sendAuthOtp.mockResolvedValue(undefined);

    await forgotPassword({
      email: "CUSTOMER@example.com",

      locale: "en",
    });

    expect(state.sendAuthOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: "password_reset",

        channel: "email",

        destination: "customer@example.com",
      }),
    );
  });

  it("reset password consumes token and revokes all old sessions", async () => {
    const oldPasswordHash = await bcrypt.hash("Old#582q", 4);

    state.passwordRepository.findPasswordResetChallengeByTokenHashForUpdate.mockResolvedValue(
      {
        id: 701,

        destination: "customer@example.com",

        reset_expires_at: new Date(Date.now() + 10 * 60 * 1000),
      },
    );

    state.passwordRepository.findPasswordAccountByEmailForUpdate.mockResolvedValue(
      {
        id: 20,

        status: "active",

        email: "customer@example.com",

        email_verified_at: new Date(),

        password_hash: oldPasswordHash,
      },
    );

    state.getAccountRoles.mockResolvedValue(["customer"]);

    const result = await resetPassword({
      resetToken: "r".repeat(43),

      newPassword: "New#582q",
    });

    expect(result.status).toBe("password_reset");

    expect(
      state.passwordRepository.consumePasswordResetChallenge,
    ).toHaveBeenCalledWith(701, state.transaction);

    expect(
      state.passwordRepository.revokeAllAccountSessionsForPasswordReset,
    ).toHaveBeenCalledWith(20, state.transaction);
  });

  it("change password revokes other sessions but keeps current session", async () => {
    const oldPasswordHash = await bcrypt.hash("Old#582q", 4);

    state.passwordRepository.findPasswordAccountByIdForUpdate.mockResolvedValue(
      {
        id: 30,

        status: "active",

        password_hash: oldPasswordHash,
      },
    );

    const sessionUuid = "550e8400-e29b-41d4-a716-446655440030";

    const result = await changePassword({
      accountId: "30",

      sessionUuid,

      currentPassword: "Old#582q",

      newPassword: "New#693w",
    });

    expect(result.status).toBe("password_changed");

    expect(
      state.passwordRepository.revokeOtherAccountSessionsForPasswordChange,
    ).toHaveBeenCalledWith(30, sessionUuid, state.transaction);
  });

  it("set password works for verified Google-style account without password", async () => {
    state.passwordRepository.findPasswordAccountByIdForUpdate.mockResolvedValue(
      {
        id: 40,

        status: "active",

        email: "google@example.com",

        email_verified_at: new Date(),

        password_hash: null,
      },
    );

    const result = await setPassword({
      accountId: "40",

      newPassword: "River#582q",
    });

    expect(result.status).toBe("password_set");

    expect(state.passwordRepository.updateAccountPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 40,

        passwordHash: expect.any(String),
      }),

      state.transaction,
    );
  });
});
