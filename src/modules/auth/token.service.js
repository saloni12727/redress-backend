import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import jwt from "jsonwebtoken";

import { getAuthConfig } from "../../config/auth.config.js";

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenHashesEqual(firstHash, secondHash) {
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

export function createAccessToken({ accountId, sessionUuid, roles }) {
  const config = getAuthConfig();

  return jwt.sign(
    {
      sid: sessionUuid,
      roles: roles ?? [],
      typ: "access",
    },
    config.accessSecret,
    {
      algorithm: "HS256",
      subject: String(accountId),
      jwtid: randomUUID(),
      issuer: config.issuer,
      audience: config.accessAudience,
      expiresIn: config.accessTtlSeconds,
    },
  );
}

export function createRefreshToken({
  accountId,
  sessionUuid,
  expiresInSeconds,
}) {
  const config = getAuthConfig();
  const refreshJti = randomUUID();
  const ttlSeconds = Math.max(
    1,
    Math.floor(expiresInSeconds ?? config.refreshTtlSeconds),
  );

  const token = jwt.sign(
    {
      sid: sessionUuid,
      typ: "refresh",
    },
    config.refreshSecret,
    {
      algorithm: "HS256",
      subject: String(accountId),
      jwtid: refreshJti,
      issuer: config.issuer,
      audience: config.accessAudience,
      expiresIn: ttlSeconds,
    },
  );

  return {
    token,
    refreshJti,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  };
}

export function createTokenPair({
  accountId,
  sessionUuid,
  roles,
  refreshExpiresInSeconds,
}) {
  const config = getAuthConfig();

  const accessToken = createAccessToken({
    accountId,
    sessionUuid,
    roles,
  });

  const refresh = createRefreshToken({
    accountId,
    sessionUuid,
    expiresInSeconds: refreshExpiresInSeconds,
  });

  return {
    accessToken,
    refreshToken: refresh.token,
    refreshTokenHash: refresh.tokenHash,
    refreshJti: refresh.refreshJti,
    refreshExpiresAt: refresh.expiresAt,
    expiresIn: config.accessTtlSeconds,
  };
}

/*
|--------------------------------------------------------------------------
| One-time signup proof token
|--------------------------------------------------------------------------
|
| The token itself carries the already-verified identifier. Flutter never
| sends that identifier again to /auth/signup, preventing identifier swaps.
|
| channel = sms   -> sub is E.164 phone
| channel = email -> sub is normalized email
|
*/
export function createSignupToken({
  challengeUuid,
  channel,
  destination,
  locale,
}) {
  const config = getAuthConfig();
  const signupJti = randomUUID();

  const token = jwt.sign(
    {
      typ: "signup",
      cid: challengeUuid,
      ch: channel,
      locale,
    },
    config.signupSecret,
    {
      algorithm: "HS256",
      subject: destination,
      jwtid: signupJti,
      issuer: config.issuer,
      audience: config.signupAudience,
      expiresIn: config.signupTtlSeconds,
    },
  );

  return {
    token,
    signupJti,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + config.signupTtlSeconds * 1000),
  };
}

/* Google signup has no OTP challenge, so its short-lived JWT is backed by a
 * durable proof record and can be burned atomically with account creation. */
export function createGoogleSignupToken({
  proofUuid,
  subject,
  email,
  displayName,
  photoUrl,
  locale,
}) {
  const config = getAuthConfig();
  const signupJti = randomUUID();
  const token = jwt.sign(
    {
      typ: "google_signup",
      pid: proofUuid,
      email,
      displayName: displayName ?? null,
      photoUrl: photoUrl ?? null,
      locale,
    },
    config.signupSecret,
    {
      algorithm: "HS256",
      subject,
      jwtid: signupJti,
      issuer: config.issuer,
      audience: config.signupAudience,
      expiresIn: config.signupTtlSeconds,
    },
  );
  return {
    token,
    signupJti,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + config.signupTtlSeconds * 1000),
  };
}

/*
 * Kept for backward compatibility with previously-issued deployments.
 * The new Google flow no longer requires a phone/link token during signup.
 */
export function createGoogleLinkToken({ attemptUuid, subject }) {
  const config = getAuthConfig();
  const linkJti = randomUUID();

  const token = jwt.sign(
    {
      typ: "google_link",
      aid: attemptUuid,
    },
    config.googleLinkSecret,
    {
      algorithm: "HS256",
      subject,
      jwtid: linkJti,
      issuer: config.issuer,
      audience: config.googleLinkAudience,
      expiresIn: config.googleLinkTtlSeconds,
    },
  );

  return {
    token,
    linkJti,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + config.googleLinkTtlSeconds * 1000),
  };
}

export function verifyAccessToken(token) {
  const config = getAuthConfig();

  const payload = jwt.verify(token, config.accessSecret, {
    algorithms: ["HS256"],
    issuer: config.issuer,
    audience: config.accessAudience,
  });

  if (
    typeof payload !== "object" ||
    payload.typ !== "access" ||
    !payload.sub ||
    !payload.sid
  ) {
    throw new Error("Invalid access token.");
  }

  return payload;
}

export function verifyRefreshToken(token) {
  const config = getAuthConfig();

  const payload = jwt.verify(token, config.refreshSecret, {
    algorithms: ["HS256"],
    issuer: config.issuer,
    audience: config.accessAudience,
  });

  if (
    typeof payload !== "object" ||
    payload.typ !== "refresh" ||
    !payload.sub ||
    !payload.sid ||
    !payload.jti
  ) {
    throw new Error("Invalid refresh token.");
  }

  return payload;
}

export function verifySignupToken(token) {
  const config = getAuthConfig();

  const payload = jwt.verify(token, config.signupSecret, {
    algorithms: ["HS256"],
    issuer: config.issuer,
    audience: config.signupAudience,
  });

  if (typeof payload !== "object" || !payload.sub || !payload.jti) {
    throw new Error("Invalid signup token.");
  }

  if (
    payload.typ === "signup" &&
    payload.cid &&
    ["sms", "email"].includes(payload.ch)
  ) {
    return payload;
  }

  if (
    payload.typ === "google_signup" &&
    payload.pid &&
    typeof payload.email === "string" &&
    payload.email
  ) {
    return payload;
  }

  throw new Error("Invalid signup token.");
}

export function verifyGoogleLinkToken(token) {
  const config = getAuthConfig();

  const payload = jwt.verify(token, config.googleLinkSecret, {
    algorithms: ["HS256"],
    issuer: config.issuer,
    audience: config.googleLinkAudience,
  });

  if (
    typeof payload !== "object" ||
    payload.typ !== "google_link" ||
    !payload.sub ||
    !payload.aid ||
    !payload.jti
  ) {
    throw new Error("Invalid Google link token.");
  }

  return {
    subject: payload.sub,
    attemptUuid: payload.aid,
    jti: payload.jti,
  };
}
