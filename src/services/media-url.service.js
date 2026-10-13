import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

import { env } from "../config/env.js";

const TOKEN_VERSION = 1;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const MEDIA_URL_TTL_SECONDS = Math.min(
  env.AWS_S3_SIGNED_URL_EXPIRES_SECONDS,
  900,
);

function encryptionKey() {
  return createHmac("sha256", "redress-media-url-v1")
    .update(env.JWT_ACCESS_SECRET)
    .digest();
}

function isValidMediaKey(key) {
  if (
    typeof key !== "string" ||
    Buffer.byteLength(key, "utf8") > 1024 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(key) ||
    key.includes("..") ||
    key.startsWith("/")
  ) {
    return false;
  }

  const allowedPrefixes = [
    env.AWS_S3_PROFILE_PREFIX,
    env.AWS_S3_PRODUCT_PREFIX,
    "reviews",
    "brands",
    "vendors",
    "home",
  ];

  return allowedPrefixes.some((prefix) => {
    const normalizedPrefix = prefix.replace(/\/+$/, "");
    return key === normalizedPrefix || key.startsWith(`${normalizedPrefix}/`);
  });
}

export function createMediaUrl(storageKey) {
  if (!storageKey) {
    return null;
  }

  if (!isValidMediaKey(storageKey)) {
    throw new Error("Media storage key is invalid.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      version: TOKEN_VERSION,
      key: storageKey,
      expiresAt: issuedAt + MEDIA_URL_TTL_SECONDS,
    }),
  );
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const token = Buffer.concat([
    Buffer.from([TOKEN_VERSION]),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]).toString("base64url");
  const origin =
    env.API_PUBLIC_ORIGIN ??
    (env.NODE_ENV === "production"
      ? "https://redressbackend.cyberimpulses.com"
      : `http://localhost:${env.PORT}`);

  return `${origin}${env.API_PREFIX}/media/${token}`;
}

export function resolveMediaUrlToken(token) {
  try {
    if (typeof token !== "string" || token.length > 2048) {
      return null;
    }

    const encoded = Buffer.from(token, "base64url");
    if (
      encoded.toString("base64url") !== token ||
      encoded.length <= 1 + IV_LENGTH + AUTH_TAG_LENGTH ||
      encoded[0] !== TOKEN_VERSION
    ) {
      return null;
    }

    const iv = encoded.subarray(1, 1 + IV_LENGTH);
    const authTag = encoded.subarray(
      1 + IV_LENGTH,
      1 + IV_LENGTH + AUTH_TAG_LENGTH,
    );
    const ciphertext = encoded.subarray(1 + IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const payload = JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        "utf8",
      ),
    );

    if (
      payload.version !== TOKEN_VERSION ||
      !Number.isInteger(payload.expiresAt) ||
      payload.expiresAt <= Math.floor(Date.now() / 1000) ||
      !isValidMediaKey(payload.key)
    ) {
      return null;
    }

    return payload.key;
  } catch {
    return null;
  }
}
