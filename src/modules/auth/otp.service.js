import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { getAuthConfig } from "../../config/auth.config.js";

export function generateOtpCode() {
  const config = getAuthConfig();

  /*
   * Development/Postman only.
   * Fixed OTP must never be enabled in production.
   */
  if (config.otpFixedCode) {
    return config.otpFixedCode;
  }

  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode({ purpose = "auth", channel, destination, code }) {
  const config = getAuthConfig();

  /*
   * Purpose is part of the HMAC input.
   *
   * Therefore:
   *
   * auth OTP
   * phone-link OTP
   * password-reset OTP
   *
   * are cryptographically separated.
   */
  return createHmac("sha256", config.otpHashSecret)
    .update(`${purpose}:${channel}:${destination}:${code}`)
    .digest("hex");
}

export function otpHashMatches({
  purpose = "auth",
  channel,
  destination,
  code,
  expectedHash,
}) {
  if (typeof expectedHash !== "string" || expectedHash.length !== 64) {
    return false;
  }

  try {
    const actualHash = hashOtpCode({
      purpose,
      channel,
      destination,
      code,
    });

    const actualBuffer = Buffer.from(actualHash, "hex");

    const expectedBuffer = Buffer.from(expectedHash, "hex");

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
