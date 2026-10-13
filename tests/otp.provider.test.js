import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sendOtpEmail: vi.fn(),
}));

vi.mock("../src/config/auth.config.js", () => ({
  getAuthConfig: () => ({
    otpProvider: "console",
    allowConsoleOtpInProduction: false,
  }),
}));

vi.mock("../src/config/mail.config.js", () => ({
  getMailConfig: () => ({ enabled: false }),
}));

vi.mock("../src/modules/auth/mail.service.js", () => ({
  sendOtpEmail: state.sendOtpEmail,
}));

import { sendAuthOtp } from "../src/modules/auth/otp.provider.js";

describe("OTP delivery provider", () => {
  it("never reports a console fallback as a delivered email OTP", async () => {
    await expect(
      sendAuthOtp({
        channel: "email",
        destination: "recipient@example.com",
        code: "123456",
        locale: "en",
        expiresIn: 300,
      }),
    ).rejects.toThrow(
      "Email OTP delivery requires SMTP or an email webhook provider.",
    );

    expect(state.sendOtpEmail).not.toHaveBeenCalled();
  });
});
