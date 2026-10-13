import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  clientIds: [],
  verifyIdToken: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: class OAuth2Client {
    verifyIdToken(options) {
      return state.verifyIdToken(options);
    }
  },
}));

vi.mock("../src/config/auth.config.js", () => ({
  getAuthConfig: () => ({
    googleClientIds: state.clientIds,
  }),
}));

import {
  GoogleAuthConfigurationError,
  verifyGoogleIdToken,
} from "../src/modules/auth/google.service.js";

function googleTicket(payload) {
  return {
    getPayload: () => payload,
  };
}

describe("Google ID-token verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    state.clientIds = [
      "web.apps.googleusercontent.com",
      "android.apps.googleusercontent.com",
      "ios.apps.googleusercontent.com",
    ];
  });

  it("fails closed when no Google client ID is configured", async () => {
    state.clientIds = [];

    await expect(verifyGoogleIdToken("google-id-token")).rejects.toBeInstanceOf(
      GoogleAuthConfigurationError,
    );

    expect(state.verifyIdToken).not.toHaveBeenCalled();
  });

  it("verifies against every configured platform audience", async () => {
    state.verifyIdToken.mockResolvedValue(
      googleTicket({
        sub: "google-subject-123",
        email: " Ada@Gmail.com ",
        email_verified: true,
        name: "Ada Lovelace",
        given_name: "Ada",
        family_name: "Lovelace",
        picture: "https://lh3.googleusercontent.com/avatar.png",
      }),
    );

    await expect(verifyGoogleIdToken("google-id-token")).resolves.toEqual({
      subject: "google-subject-123",
      email: "ada@gmail.com",
      displayName: "Ada Lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
      photoUrl: "https://lh3.googleusercontent.com/avatar.png",
      hostedDomain: null,
      emailAuthoritative: true,
    });

    expect(state.verifyIdToken).toHaveBeenCalledWith({
      idToken: "google-id-token",
      audience: state.clientIds,
    });
  });

  it("treats verified Google Workspace email as authoritative", async () => {
    state.verifyIdToken.mockResolvedValue(
      googleTicket({
        sub: "workspace-subject",
        email: "owner@example.com",
        email_verified: true,
        hd: "example.com",
      }),
    );

    const identity = await verifyGoogleIdToken("google-id-token");

    expect(identity.hostedDomain).toBe("example.com");
    expect(identity.emailAuthoritative).toBe(true);
  });

  it("does not treat a third-party email domain as authoritative", async () => {
    state.verifyIdToken.mockResolvedValue(
      googleTicket({
        sub: "external-subject",
        email: "owner@example.net",
        email_verified: true,
      }),
    );

    const identity = await verifyGoogleIdToken("google-id-token");

    expect(identity.emailAuthoritative).toBe(false);
  });

  it("rejects a token without a Google-verified email", async () => {
    state.verifyIdToken.mockResolvedValue(
      googleTicket({
        sub: "google-subject-123",
        email: "owner@gmail.com",
        email_verified: false,
      }),
    );

    await expect(verifyGoogleIdToken("google-id-token")).rejects.toThrow(
      "Invalid Google identity token",
    );
  });

  it("ignores non-HTTPS profile photos", async () => {
    state.verifyIdToken.mockResolvedValue(
      googleTicket({
        sub: "google-subject-123",
        email: "owner@gmail.com",
        email_verified: true,
        picture: "http://example.com/avatar.png",
      }),
    );

    const identity = await verifyGoogleIdToken("google-id-token");

    expect(identity.photoUrl).toBeNull();
  });
});
