import { describe, expect, it } from "vitest";

import {
  createGoogleLinkToken,
  createGoogleSignupToken,
  createSignupToken,
  createTokenPair,
  verifyAccessToken,
  verifyGoogleLinkToken,
  verifyRefreshToken,
  verifySignupToken,
} from "../src/modules/auth/token.service.js";

describe("auth tokens", () => {
  it("keeps access and refresh token types separate", () => {
    const pair = createTokenPair({
      accountId: "1",

      sessionUuid: "550e8400-e29b-41d4-a716-446655440000",

      roles: ["customer"],
    });

    expect(verifyAccessToken(pair.accessToken).typ).toBe("access");

    expect(verifyRefreshToken(pair.refreshToken).typ).toBe("refresh");

    expect(() => verifyAccessToken(pair.refreshToken)).toThrow();
  });

  it("creates a phone signup proof token", () => {
    const result = createSignupToken({
      challengeUuid: "550e8400-e29b-41d4-a716-446655440001",

      channel: "sms",

      destination: "+393331234567",

      locale: "it",
    });

    const claims = verifySignupToken(result.token);

    expect(claims.typ).toBe("signup");

    expect(claims.ch).toBe("sms");

    expect(claims.sub).toBe("+393331234567");
  });

  it("creates an email signup proof token", () => {
    const result = createSignupToken({
      challengeUuid: "550e8400-e29b-41d4-a716-446655440003",

      channel: "email",

      destination: "ada@example.com",

      locale: "it",
    });

    const claims = verifySignupToken(result.token);

    expect(claims.ch).toBe("email");

    expect(claims.sub).toBe("ada@example.com");
  });

  it("creates a Google signup proof token", () => {
    const result = createGoogleSignupToken({
      proofUuid: "550e8400-e29b-41d4-a716-446655440004",
      subject: "google-subject-123",
      email: "ada@example.com",
      displayName: "Ada Rossi",
      photoUrl: "https://example.com/ada.png",
      locale: "it",
    });

    const claims = verifySignupToken(result.token);

    expect(claims.typ).toBe("google_signup");
    expect(claims.sub).toBe("google-subject-123");
    expect(claims.email).toBe("ada@example.com");
    expect(claims.pid).toBe("550e8400-e29b-41d4-a716-446655440004");
  });

  it("keeps the legacy Google-link token verifier valid", () => {
    const result = createGoogleLinkToken({
      attemptUuid: "550e8400-e29b-41d4-a716-446655440002",

      subject: "google-subject-123",
    });

    const claims = verifyGoogleLinkToken(result.token);

    expect(claims.subject).toBe("google-subject-123");

    expect(claims.attemptUuid).toBe("550e8400-e29b-41d4-a716-446655440002");
  });
});
