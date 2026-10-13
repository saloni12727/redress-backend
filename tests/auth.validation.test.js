import { describe, expect, it } from "vitest";

import {
  emailChangeRequestSchema,
  emailChangeVerifySchema,
  googleSchema,
  otpSendSchema,
  otpVerifySchema,
  phoneChangeRequestSchema,
  phoneChangeVerifySchema,
  signupSchema,
  updateMeSchema,
} from "../src/modules/auth/auth.validation.js";

describe("auth validation", () => {
  it("accepts a normal SMS auth OTP request", () => {
    const result = otpSendSchema.safeParse({
      channel: "sms",

      phone: "+393331234567",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.purpose).toBe("auth");
    }
  });

  it("accepts a normal email auth OTP request", () => {
    const result = otpSendSchema.safeParse({
      channel: "email",

      email: "ada@example.com",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.purpose).toBe("auth");
    }
  });

  it("accepts phone_link only with SMS", () => {
    expect(
      otpSendSchema.safeParse({
        purpose: "phone_link",

        channel: "sms",

        phone: "+393331234567",
      }).success,
    ).toBe(true);

    expect(
      otpSendSchema.safeParse({
        purpose: "phone_link",

        channel: "email",

        email: "ada@example.com",
      }).success,
    ).toBe(false);
  });

  it("does not expose password_reset through generic OTP endpoint", () => {
    expect(
      otpSendSchema.safeParse({
        purpose: "password_reset",

        channel: "email",

        email: "ada@example.com",
      }).success,
    ).toBe(false);
  });

  it("rejects a non-E.164 phone", () => {
    expect(
      otpSendSchema.safeParse({
        channel: "sms",

        phone: "3331234567",
      }).success,
    ).toBe(false);
  });

  it("rejects channel destination mismatches", () => {
    expect(
      otpVerifySchema.safeParse({
        channel: "email",

        phone: "+393331234567",

        otp: "123456",
      }).success,
    ).toBe(false);
  });

  it("does not allow purpose field on public OTP verification", () => {
    expect(
      otpVerifySchema.safeParse({
        purpose: "phone_link",

        channel: "sms",

        phone: "+393331234567",

        otp: "123456",
      }).success,
    ).toBe(false);
  });

  it("accepts phone signup without password", () => {
    expect(
      signupSchema.safeParse({
        signupToken: "x".repeat(40),

        fullName: "Ada Rossi",
      }).success,
    ).toBe(true);
  });

  it("leaves weak signup passwords for service-level, token-aware validation", () => {
    expect(
      signupSchema.safeParse({
        signupToken: "x".repeat(40),

        fullName: "Ada Rossi",

        password: "password",
      }).success,
    ).toBe(true);
  });

  it("accepts Redress compliant password", () => {
    expect(
      signupSchema.safeParse({
        signupToken: "x".repeat(40),

        fullName: "Ada Rossi",

        password: "Kite#482m",
      }).success,
    ).toBe(true);
  });

  it("accepts the Flutter signup privacy-consent payload", () => {
    const result = signupSchema.safeParse({
      signupToken: "x".repeat(40),

      fullName: "Umesh",

      password: "Kite#482m",

      consent: {
        privacyAccepted: true,

        privacyVersion: "2026-10-01T00:00:00.000Z",
      },

      deviceType: "android",

      deviceName: "Redress Flutter",
    });

    expect(result.success).toBe(true);
  });

  it("leaves unaccepted consent for the service to report as a documented field error", () => {
    expect(
      signupSchema.safeParse({
        signupToken: "x".repeat(40),

        fullName: "Umesh",

        consent: {
          privacyAccepted: false,

          privacyVersion: "2026-10-01T00:00:00.000Z",
        },
      }).success,
    ).toBe(true);

    /* A malformed version is still invalid request syntax. */
    expect(
      signupSchema.safeParse({
        signupToken: "x".repeat(40),

        fullName: "Umesh",

        consent: {
          privacyAccepted: true,

          privacyVersion: "2026-10-01",
        },
      }).success,
    ).toBe(false);
  });

  it("accepts a bounded Google ID token", () => {
    const result = googleSchema.safeParse({
      idToken: `header.${"x".repeat(100)}.signature`,
      deviceType: "android",
      deviceName: "Pixel",
    });

    expect(result.success).toBe(true);
  });

  it("rejects oversized Google ID tokens and unexpected fields", () => {
    expect(
      googleSchema.safeParse({
        idToken: "x".repeat(8193),
      }).success,
    ).toBe(false);

    expect(
      googleSchema.safeParse({
        idToken: "x".repeat(100),
        accessToken: "not-accepted",
      }).success,
    ).toBe(false);
  });

  it("requires at least one PATCH me field", () => {
    expect(updateMeSchema.safeParse({}).success).toBe(false);
  });

  it("accepts canonical profile fields and normalizes name whitespace", () => {
    const result = updateMeSchema.safeParse({
      firstName: "  Ada   Maria ",
      lastName: null,
      locale: "en",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.firstName).toBe("Ada Maria");
      expect(result.data.lastName).toBeNull();
    }
  });

  it("rejects legacy displayName as an editable profile field", () => {
    expect(
      updateMeSchema.safeParse({ displayName: "Ada Lovelace" }).success,
    ).toBe(false);
  });

  it("validates email and phone contact-change payloads", () => {
    expect(
      emailChangeRequestSchema.safeParse({ newEmail: "ADA@example.com" })
        .success,
    ).toBe(true);
    expect(
      emailChangeVerifySchema.safeParse({
        newEmail: "ada@example.com",
        otp: "123456",
      }).success,
    ).toBe(true);
    expect(
      phoneChangeRequestSchema.safeParse({ newPhone: "+393331234567" })
        .success,
    ).toBe(true);
    expect(
      phoneChangeVerifySchema.safeParse({
        newPhone: "+393331234567",
        otp: "123456",
      }).success,
    ).toBe(true);
  });
});
