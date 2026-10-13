import { env } from "./env.js";

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

const authConfig = Object.freeze({
  accessSecret: env.JWT_ACCESS_SECRET,

  refreshSecret: env.JWT_REFRESH_SECRET,

  guestSecret: env.JWT_GUEST_SECRET,

  signupSecret: env.JWT_SIGNUP_SECRET,

  googleLinkSecret: env.JWT_GOOGLE_LINK_SECRET,

  otpHashSecret: env.AUTH_OTP_HASH_SECRET,

  accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,

  refreshTtlSeconds: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60,

  guestTtlSeconds: env.JWT_GUEST_TTL_DAYS * 24 * 60 * 60,

  signupTtlSeconds: env.AUTH_SIGNUP_TTL_SECONDS,

  googleLinkTtlSeconds: env.AUTH_GOOGLE_LINK_TTL_SECONDS,

  refreshGraceSeconds: env.AUTH_REFRESH_GRACE_SECONDS,

  sensitiveActionTtlSeconds: env.AUTH_SENSITIVE_ACTION_TTL_SECONDS,

  otpTtlSeconds: env.AUTH_OTP_TTL_SECONDS,

  otpMaxAttempts: env.AUTH_OTP_MAX_ATTEMPTS,

  otpResendSeconds: env.AUTH_OTP_RESEND_SECONDS,

  otpMaxSendsPerHour: env.AUTH_OTP_MAX_SENDS_PER_HOUR,

  otpProvider: env.AUTH_OTP_PROVIDER,

  otpFixedCode: env.AUTH_OTP_FIXED_CODE ?? null,

  smsWebhookUrl: env.AUTH_SMS_WEBHOOK_URL ?? null,

  smsWebhookBearerToken: env.AUTH_SMS_WEBHOOK_BEARER_TOKEN ?? null,

  emailWebhookUrl: env.AUTH_EMAIL_WEBHOOK_URL ?? null,

  emailWebhookBearerToken: env.AUTH_EMAIL_WEBHOOK_BEARER_TOKEN ?? null,

  googleClientIds: uniqueValues([
    env.GOOGLE_WEB_CLIENT_ID,
    env.GOOGLE_ANDROID_CLIENT_ID,
    env.GOOGLE_IOS_CLIENT_ID,
  ]),

  issuer: "redress-api",

  accessAudience: "redress-clients",

  guestAudience: "redress-guests",

  signupAudience: "redress-signup",

  googleLinkAudience: "redress-google-link",

  webOrigins: env.CORS_ORIGINS,

  refreshCookieName: env.AUTH_REFRESH_COOKIE_NAME,

  guestCookieName: env.AUTH_GUEST_COOKIE_NAME,

  cookieSecure: env.AUTH_COOKIE_SECURE,

  cookieSameSite: env.AUTH_COOKIE_SAME_SITE,
  allowConsoleOtpInProduction: env.AUTH_OTP_ALLOW_CONSOLE_IN_PRODUCTION,
});

export function getAuthConfig() {
  return authConfig;
}
