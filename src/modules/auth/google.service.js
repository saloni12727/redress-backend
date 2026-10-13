import { OAuth2Client } from "google-auth-library";

import { getAuthConfig } from "../../config/auth.config.js";

let googleClient = null;

export class GoogleAuthConfigurationError extends Error {
  constructor() {
    super("Google authentication is not configured.");
    this.name = "GoogleAuthConfigurationError";
  }
}

function getGoogleClient() {
  if (!googleClient) {
    googleClient = new OAuth2Client();
  }

  return googleClient;
}

function cleanOptionalText(value, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return [...value.trim()].slice(0, maxLength).join("");
}

function cleanBoundedIdentifier(value, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const cleaned = value.trim();

  return [...cleaned].length <= maxLength ? cleaned : null;
}

function cleanGooglePhotoUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = new URL(value.trim());

    if (parsed.protocol !== "https:") {
      return null;
    }

    const normalizedUrl = parsed.toString();

    return normalizedUrl.length <= 500 ? normalizedUrl : null;
  } catch {
    return null;
  }
}

export async function verifyGoogleIdToken(idToken) {
  const config = getAuthConfig();

  if (config.googleClientIds.length === 0) {
    throw new GoogleAuthConfigurationError();
  }

  /*
   * Same backend accepts tokens issued to the approved Web/Android/iOS
   * OAuth client IDs. google-auth-library verifies signature, audience,
   * issuer and expiry before we trust any profile claim below.
   */
  const ticket = await getGoogleClient().verifyIdToken({
    idToken,
    audience: config.googleClientIds,
  });

  const payload = ticket.getPayload();

  const subject = cleanBoundedIdentifier(payload?.sub, 191);
  const email =
    cleanBoundedIdentifier(payload?.email, 191)?.toLowerCase() ?? null;
  const hostedDomain =
    cleanOptionalText(payload?.hd, 255)?.toLowerCase() ?? null;

  if (!subject || !email || payload.email_verified !== true) {
    throw new Error("Invalid Google identity token.");
  }

  return {
    /* Stable provider key. Never use email as the Google identity key. */
    subject,
    email,
    displayName: cleanOptionalText(payload.name, 200),
    firstName: cleanOptionalText(payload.given_name, 100),
    lastName: cleanOptionalText(payload.family_name, 100),
    photoUrl: cleanGooglePhotoUrl(payload.picture),
    hostedDomain,

    /*
     * Google is authoritative for Gmail and Google Workspace addresses.
     * For third-party email domains, an existing Redress account must be
     * authenticated before it can be linked to this Google identity.
     */
    emailAuthoritative:
      email.endsWith("@gmail.com") || Boolean(hostedDomain),
  };
}
