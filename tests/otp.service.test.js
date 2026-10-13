import { describe, expect, it } from "vitest";

import {
  generateOtpCode,
  hashOtpCode,
  otpHashMatches,
} from "../src/modules/auth/otp.service.js";

describe("OTP service security", () => {
  it("keeps OTP hashes separated by purpose", () => {
    const input = {
      channel: "sms",

      destination: "+393331234567",

      code: "123456",
    };

    const authHash = hashOtpCode({
      purpose: "auth",

      ...input,
    });

    const phoneLinkHash = hashOtpCode({
      purpose: "phone_link",

      ...input,
    });

    const passwordResetHash = hashOtpCode({
      purpose: "password_reset",

      channel: "email",

      destination: "ada@example.com",

      code: "123456",
    });

    expect(authHash).toHaveLength(64);

    expect(phoneLinkHash).toHaveLength(64);

    expect(passwordResetHash).toHaveLength(64);

    expect(authHash).not.toBe(phoneLinkHash);

    expect(authHash).not.toBe(passwordResetHash);

    expect(phoneLinkHash).not.toBe(passwordResetHash);
  });

  it("does not accept auth OTP as phone-link OTP", () => {
    const expectedHash = hashOtpCode({
      purpose: "auth",

      channel: "sms",

      destination: "+393331234567",

      code: "123456",
    });

    expect(
      otpHashMatches({
        purpose: "phone_link",

        channel: "sms",

        destination: "+393331234567",

        code: "123456",

        expectedHash,
      }),
    ).toBe(false);
  });

  it("uses configured fixed OTP in test environment", () => {
    expect(generateOtpCode()).toBe("123456");
  });
});
