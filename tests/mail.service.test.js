import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const sendMail = vi.fn();

  return {
    sendMail,
    createTransport: vi.fn(() => ({ sendMail })),
  };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: state.createTransport,
  },
}));

vi.mock("../src/config/mail.config.js", () => ({
  getMailConfig: () => ({
    enabled: true,
    service: "gmail",
    user: "sender@example.com",
    password: "test-password",
    from: "Redress <sender@example.com>",
  }),
}));

import { sendOtpEmail } from "../src/modules/auth/mail.service.js";

describe("OTP email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns delivery metadata only after SMTP accepts the recipient", async () => {
    state.sendMail.mockResolvedValue({
      accepted: ["recipient@example.com"],
      rejected: [],
      messageId: "smtp-message-id",
    });

    await expect(
      sendOtpEmail({
        to: "recipient@example.com",
        code: "123456",
        locale: "en",
        expiresIn: 300,
      }),
    ).resolves.toEqual({
      messageId: "smtp-message-id",
      acceptedRecipientCount: 1,
    });
  });

  it("rejects a delivery that SMTP did not accept", async () => {
    state.sendMail.mockResolvedValue({
      accepted: [],
      rejected: ["recipient@example.com"],
      messageId: "smtp-message-id",
    });

    await expect(
      sendOtpEmail({
        to: "recipient@example.com",
        code: "123456",
        locale: "en",
        expiresIn: 300,
      }),
    ).rejects.toThrow("SMTP did not accept the OTP email recipient.");
  });
});
