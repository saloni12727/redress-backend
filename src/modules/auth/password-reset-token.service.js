import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * After email OTP verification,
 * resetToken remains valid for 15 minutes.
 */
export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 15 * 60;

export function hashPasswordResetToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function passwordResetTokenHashesEqual(firstHash, secondHash) {
  if (
    typeof firstHash !== "string" ||
    typeof secondHash !== "string" ||
    firstHash.length !== secondHash.length
  ) {
    return false;
  }

  try {
    const firstBuffer = Buffer.from(firstHash, "hex");

    const secondBuffer = Buffer.from(secondHash, "hex");

    if (firstBuffer.length !== secondBuffer.length) {
      return false;
    }

    return timingSafeEqual(firstBuffer, secondBuffer);
  } catch {
    return false;
  }
}

export function createPasswordResetToken() {
  /*
   * 256-bit cryptographically random opaque token.
   *
   * Raw token is returned to Flutter/Web only.
   * Database stores SHA-256 hash only.
   */
  const token = randomBytes(32).toString("base64url");

  return {
    token,

    tokenHash: hashPasswordResetToken(token),

    expiresIn: PASSWORD_RESET_TOKEN_TTL_SECONDS,

    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000),
  };
}
