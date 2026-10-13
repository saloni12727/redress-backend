import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    env: {
      NODE_ENV: "test",

      APP_NAME: "Redress API Test",

      HOST: "127.0.0.1",

      PORT: "5001",

      API_PREFIX: "/api/v1",

      CORS_ORIGINS: "http://localhost:3000",

      APP_DEFAULT_LANGUAGE: "it",

      APP_SUPPORTED_LANGUAGES: "it,en",

      /*
       * TEST-ONLY secrets.
       */
      JWT_ACCESS_SECRET: "a".repeat(64),

      JWT_REFRESH_SECRET: "b".repeat(64),

      JWT_GUEST_SECRET: "c".repeat(64),

      JWT_SIGNUP_SECRET: "d".repeat(64),

      JWT_GOOGLE_LINK_SECRET: "e".repeat(64),

      AUTH_OTP_HASH_SECRET: "f".repeat(64),

      JWT_ACCESS_TTL_SECONDS: "900",

      JWT_REFRESH_TTL_DAYS: "30",

      JWT_GUEST_TTL_DAYS: "30",

      AUTH_SIGNUP_TTL_SECONDS: "900",

      AUTH_GOOGLE_LINK_TTL_SECONDS: "900",

      AUTH_REFRESH_GRACE_SECONDS: "10",

      AUTH_OTP_TTL_SECONDS: "300",

      AUTH_OTP_MAX_ATTEMPTS: "5",

      AUTH_OTP_RESEND_SECONDS: "60",

      AUTH_OTP_MAX_SENDS_PER_HOUR: "5",

      AUTH_OTP_PROVIDER: "console",

      /*
       * Fixed OTP is fine ONLY inside automated tests.
       * Production .env must keep this blank.
       */
      AUTH_OTP_FIXED_CODE: "123456",

      AUTH_REFRESH_COOKIE_NAME: "redress_refresh",

      AUTH_GUEST_COOKIE_NAME: "redress_guest",

      AUTH_COOKIE_SECURE: "false",

      AUTH_COOKIE_SAME_SITE: "lax",

      GOOGLE_WEB_CLIENT_ID: "test-web.apps.googleusercontent.com",

      GOOGLE_ANDROID_CLIENT_ID: "test-android.apps.googleusercontent.com",

      GOOGLE_IOS_CLIENT_ID: "test-ios.apps.googleusercontent.com",

      DB_HOST: "127.0.0.1",

      DB_PORT: "3306",

      DB_NAME: "redress_test",

      DB_USER: "redress_test",

      DB_PASSWORD: "test-password",

      STORAGE_PROVIDER: "s3",

      AWS_ACCESS_KEY_ID: "test-access-key",

      AWS_SECRET_ACCESS_KEY: "test-secret-key",

      AWS_REGION: "us-east-1",

      AWS_S3_BUCKET_NAME: "redress-test-bucket",

      AWS_S3_PROFILE_PREFIX: "profiles",

      AWS_S3_SIGNED_URL_EXPIRES_SECONDS: "900",

      PROFILE_PHOTO_MAX_BYTES: "8388608",

      REDIS_ENABLED: "false",

      REDIS_URL: "redis://127.0.0.1:6379",

      REDIS_CONNECT_TIMEOUT_MS: "10000",

      REDIS_KEY_PREFIX: "redress_test:",

      LOG_LEVEL: "silent",

      TRUST_PROXY: "0",

      RATE_LIMIT_ENABLED: "false",
    },

    clearMocks: true,

    restoreMocks: true,
  },
});
