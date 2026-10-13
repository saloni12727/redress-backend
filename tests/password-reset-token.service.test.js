import { describe, expect, it } from "vitest";

import {
  createPasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
  passwordResetTokenHashesEqual,
} from "../src/modules/auth/password-reset-token.service.js";

describe("password reset token service", () => {
  it("creates random opaque token and stores SHA256 hash", () => {
    const first = createPasswordResetToken();

    const second = createPasswordResetToken();

    expect(first.token).not.toBe(second.token);

    expect(first.tokenHash).toHaveLength(64);

    expect(first.tokenHash).toBe(hashPasswordResetToken(first.token));

    expect(first.expiresIn).toBe(PASSWORD_RESET_TOKEN_TTL_SECONDS);
  });

  it("compares reset token hashes safely", () => {
    const token = createPasswordResetToken();

    const sameHash = hashPasswordResetToken(token.token);

    const otherHash = hashPasswordResetToken("another-reset-token");

    expect(passwordResetTokenHashesEqual(token.tokenHash, sameHash)).toBe(true);

    expect(passwordResetTokenHashesEqual(token.tokenHash, otherHash)).toBe(
      false,
    );
  });
});
