import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  forgotPasswordSchema,
  forgotPasswordVerifySchema,
  resetPasswordSchema,
  setPasswordSchema,
} from "../src/modules/auth/password.validation.js";

describe("password validation", () => {
  it("accepts valid forgot password email", () => {
    expect(
      forgotPasswordSchema.safeParse({
        email: "ada@example.com",
      }).success,
    ).toBe(true);
  });

  it("requires six digit forgot-password OTP", () => {
    expect(
      forgotPasswordVerifySchema.safeParse({
        email: "ada@example.com",

        otp: "583214",
      }).success,
    ).toBe(true);

    expect(
      forgotPasswordVerifySchema.safeParse({
        email: "ada@example.com",

        otp: "12345",
      }).success,
    ).toBe(false);
  });

  it("accepts strong password with reset token", () => {
    expect(
      resetPasswordSchema.safeParse({
        resetToken: "x".repeat(43),

        newPassword: "Kite#482m",
      }).success,
    ).toBe(true);
  });

  it("rejects same current and new password", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "Kite#482m",

        newPassword: "Kite#482m",
      }).success,
    ).toBe(false);
  });

  it("accepts first strong password", () => {
    expect(
      setPasswordSchema.safeParse({
        newPassword: "River#582q",
      }).success,
    ).toBe(true);
  });
});
