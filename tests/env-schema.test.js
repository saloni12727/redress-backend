import { describe, expect, it } from "vitest";

import { parseEnvironment } from "../src/config/env-schema.js";

function validEnvironment(overrides = {}) {
  return {
    NODE_ENV: "development",

    CORS_ORIGINS: "http://localhost:3000,https://admin.example.com",

    DB_HOST: "127.0.0.1",

    DB_NAME: "redress",

    DB_USER: "redress",

    DB_PASSWORD: "development-password",

    AWS_S3_BUCKET_NAME: "redress-test-bucket",

    /*
    |--------------------------------------------------------------------------
    | Test-only authentication secrets
    |--------------------------------------------------------------------------
    */

    JWT_ACCESS_SECRET: "a".repeat(64),

    JWT_REFRESH_SECRET: "b".repeat(64),

    JWT_GUEST_SECRET: "c".repeat(64),

    JWT_SIGNUP_SECRET: "d".repeat(64),

    JWT_GOOGLE_LINK_SECRET: "e".repeat(64),

    AUTH_OTP_HASH_SECRET: "f".repeat(64),

    ...overrides,
  };
}

describe("parseEnvironment", () => {
  it("uses Italian as the default language", () => {
    const result = parseEnvironment(validEnvironment());

    expect(result.APP_DEFAULT_LANGUAGE).toBe("it");

    expect(result.APP_SUPPORTED_LANGUAGES).toEqual(["it", "en"]);
  });

  it("allows profile photo uploads up to 100 MB by default", () => {
    const result = parseEnvironment(validEnvironment());

    expect(result.PROFILE_PHOTO_MAX_BYTES).toBe(100 * 1024 * 1024);
  });

  it("normalizes list and boolean values", () => {
    const result = parseEnvironment(
      validEnvironment({
        APP_DEFAULT_LANGUAGE: "IT",

        APP_SUPPORTED_LANGUAGES: "it,en,it",

        REDIS_ENABLED: "true",

        TRUST_PROXY: "1",

        AUTH_COOKIE_SECURE: "false",
      }),
    );

    expect(result.CORS_ORIGINS).toEqual([
      "http://localhost:3000",
      "https://admin.example.com",
    ]);

    expect(result.APP_SUPPORTED_LANGUAGES).toEqual(["it", "en"]);

    expect(result.APP_DEFAULT_LANGUAGE).toBe("it");

    expect(result.REDIS_ENABLED).toBe(true);

    expect(result.TRUST_PROXY).toBe(1);

    expect(result.AUTH_COOKIE_SECURE).toBe(false);
  });

  it("normalizes API_PUBLIC_ORIGIN to a browser origin", () => {
    const result = parseEnvironment(
      validEnvironment({
        API_PUBLIC_ORIGIN: "https://api.example.com:8443/",
      }),
    );

    expect(result.API_PUBLIC_ORIGIN).toBe("https://api.example.com:8443");
  });

  it("allows a five-day access token in test but rejects it in production", () => {
    const testEnvironment = parseEnvironment(
      validEnvironment({
        NODE_ENV: "test",
        JWT_ACCESS_TTL_SECONDS: 432000,
      }),
    );

    expect(testEnvironment.JWT_ACCESS_TTL_SECONDS).toBe(432000);

    expect(() =>
      parseEnvironment(
        validEnvironment({
          NODE_ENV: "production",
          JWT_ACCESS_TTL_SECONDS: 432000,
        }),
      ),
    ).toThrow(/JWT_ACCESS_TTL_SECONDS/);
  });

  it.each([
    "https://api.example.com/api/v1",
    "https://user:password@api.example.com",
    "https://api.example.com/?query=1",
  ])("rejects API_PUBLIC_ORIGIN values that are not origins: %s", (origin) => {
    expect(() =>
      parseEnvironment(validEnvironment({ API_PUBLIC_ORIGIN: origin })),
    ).toThrow(/API_PUBLIC_ORIGIN/);
  });

  it("normalizes configured CORS origins and removes trailing slashes", () => {
    const result = parseEnvironment(
      validEnvironment({
        CORS_ORIGINS:
          "HTTPS://Example.com/,https://example.com:443,http://localhost:4108/",
      }),
    );

    expect(result.CORS_ORIGINS).toEqual([
      "https://example.com",
      "http://localhost:4108",
    ]);
  });

  it("rejects insecure production configuration", () => {
    expect(() =>
      parseEnvironment(
        validEnvironment({
          NODE_ENV: "production",

          DB_PASSWORD: "",

          REDIS_ENABLED: "false",

          AUTH_COOKIE_SECURE: "false",

          AUTH_OTP_PROVIDER: "disabled",

          AUTH_OTP_FIXED_CODE: undefined,

          GOOGLE_WEB_CLIENT_ID: "",

          GOOGLE_ANDROID_CLIENT_ID: "",

          GOOGLE_IOS_CLIENT_ID: "",
        }),
      ),
    ).toThrow(/DB_PASSWORD|REDIS_ENABLED|AUTH_COOKIE_SECURE/);
  });

  it("allows optional external auth integrations to remain disabled in production", () => {
    const result = parseEnvironment(
      validEnvironment({
        NODE_ENV: "production",

        DB_PASSWORD: "production-password",

        REDIS_ENABLED: "true",

        AUTH_COOKIE_SECURE: "true",

        AUTH_COOKIE_SAME_SITE: "lax",

        AUTH_OTP_PROVIDER: "disabled",

        AUTH_OTP_FIXED_CODE: undefined,

        GOOGLE_WEB_CLIENT_ID: "",

        GOOGLE_ANDROID_CLIENT_ID: "",

        GOOGLE_IOS_CLIENT_ID: "",
      }),
    );

    expect(result.AUTH_OTP_PROVIDER).toBe("disabled");

    expect(result.GOOGLE_WEB_CLIENT_ID).toBeUndefined();

    expect(result.GOOGLE_ANDROID_CLIENT_ID).toBeUndefined();

    expect(result.GOOGLE_IOS_CLIENT_ID).toBeUndefined();
  });

  it("validates Google OAuth client IDs per platform", () => {
    const result = parseEnvironment(
      validEnvironment({
        GOOGLE_WEB_CLIENT_ID:
          " 123-web.apps.googleusercontent.com ",

        GOOGLE_ANDROID_CLIENT_ID:
          "123-android.apps.googleusercontent.com",

        GOOGLE_IOS_CLIENT_ID: "123-ios.apps.googleusercontent.com",
      }),
    );

    expect(result.GOOGLE_WEB_CLIENT_ID).toBe(
      "123-web.apps.googleusercontent.com",
    );

    expect(result.GOOGLE_ANDROID_CLIENT_ID).toBe(
      "123-android.apps.googleusercontent.com",
    );

    expect(result.GOOGLE_IOS_CLIENT_ID).toBe(
      "123-ios.apps.googleusercontent.com",
    );
  });

  it("rejects malformed Google OAuth client IDs", () => {
    expect(() =>
      parseEnvironment(
        validEnvironment({
          GOOGLE_WEB_CLIENT_ID: "not-a-google-client-id",
        }),
      ),
    ).toThrow(/GOOGLE_WEB_CLIENT_ID/);
  });

  it("rejects wildcard credentialed CORS", () => {
    expect(() =>
      parseEnvironment(
        validEnvironment({
          CORS_ORIGINS: "*",
        }),
      ),
    ).toThrow(/CORS_ORIGINS/);
  });

  it.each([
    "https://example.com/path",
    "https://user:pass@example.com",
    "https://example.com/?query=1",
  ])("rejects non-origin CORS URL values: %s", (origin) => {
    expect(() =>
      parseEnvironment(validEnvironment({ CORS_ORIGINS: origin })),
    ).toThrow(/CORS_ORIGINS/);
  });

  it("rejects a default language outside the supported list", () => {
    expect(() =>
      parseEnvironment(
        validEnvironment({
          APP_DEFAULT_LANGUAGE: "fr",

          APP_SUPPORTED_LANGUAGES: "it,en",
        }),
      ),
    ).toThrow(/APP_DEFAULT_LANGUAGE/);
  });

  it("rejects invalid database pool configuration", () => {
    expect(() =>
      parseEnvironment(
        validEnvironment({
          DB_POOL_MIN: "20",

          DB_POOL_MAX: "10",
        }),
      ),
    ).toThrow(/DB_POOL_MIN/);
  });

  it("requires all authentication secrets to be different", () => {
    expect(() =>
      parseEnvironment(
        validEnvironment({
          JWT_REFRESH_SECRET: "a".repeat(64),
        }),
      ),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("requires secure cookies when SameSite is none", () => {
    expect(() =>
      parseEnvironment(
        validEnvironment({
          AUTH_COOKIE_SAME_SITE: "none",

          AUTH_COOKIE_SECURE: "false",
        }),
      ),
    ).toThrow(/AUTH_COOKIE_SECURE/);
  });

  it("rejects console OTP provider in production", () => {
    expect(() =>
      parseEnvironment(
        validEnvironment({
          NODE_ENV: "production",

          DB_PASSWORD: "production-password",

          REDIS_ENABLED: "true",

          AUTH_COOKIE_SECURE: "true",

          AUTH_OTP_PROVIDER: "console",

          AUTH_OTP_FIXED_CODE: undefined,
        }),
      ),
    ).toThrow(/AUTH_OTP_PROVIDER/);
  });

  it("rejects fixed OTP in production", () => {
    expect(() =>
      parseEnvironment(
        validEnvironment({
          NODE_ENV: "production",

          DB_PASSWORD: "production-password",

          REDIS_ENABLED: "true",

          AUTH_COOKIE_SECURE: "true",

          AUTH_OTP_PROVIDER: "disabled",

          AUTH_OTP_FIXED_CODE: "123456",
        }),
      ),
    ).toThrow(/AUTH_OTP_FIXED_CODE/);
  });

  it("requires webhook URL when webhook OTP provider is enabled", () => {
    expect(() =>
      parseEnvironment(
        validEnvironment({
          AUTH_OTP_PROVIDER: "webhook",

          AUTH_SMS_WEBHOOK_URL: "",
        }),
      ),
    ).toThrow(/AUTH_SMS_WEBHOOK_URL/);
  });
});

// import { describe, expect, it } from "vitest";

// import { parseEnvironment } from "../src/config/env-schema.js";

// function validEnvironment(overrides = {}) {
//   return {
//     NODE_ENV: "development",

//     CORS_ORIGINS: "http://localhost:3000,https://admin.example.com",

//     DB_HOST: "127.0.0.1",

//     DB_NAME: "redress",

//     DB_USER: "redress",

//     DB_PASSWORD: "development-password",

//     /*
//     |--------------------------------------------------------------------------
//     | Test-only authentication secrets
//     |--------------------------------------------------------------------------
//     |
//     | These are deliberately simple TEST values.
//     |
//     | Never use these values in development/staging/production.
//     |
//     */

//     JWT_ACCESS_SECRET: "a".repeat(64),

//     JWT_REFRESH_SECRET: "b".repeat(64),

//     JWT_GUEST_SECRET: "c".repeat(64),

//     JWT_SIGNUP_SECRET: "d".repeat(64),

//     JWT_GOOGLE_LINK_SECRET: "e".repeat(64),

//     AUTH_OTP_HASH_SECRET: "f".repeat(64),

//     ...overrides,
//   };
// }

// describe("parseEnvironment", () => {
//   it("uses Italian as the default language", () => {
//     const result = parseEnvironment(validEnvironment());

//     expect(result.APP_DEFAULT_LANGUAGE).toBe("it");

//     expect(result.APP_SUPPORTED_LANGUAGES).toEqual(["it", "en"]);
//   });

//   it("normalizes list and boolean values", () => {
//     const result = parseEnvironment(
//       validEnvironment({
//         APP_DEFAULT_LANGUAGE: "IT",

//         APP_SUPPORTED_LANGUAGES: "it,en,it",

//         REDIS_ENABLED: "true",

//         TRUST_PROXY: "1",

//         AUTH_COOKIE_SECURE: "false",
//       }),
//     );

//     expect(result.CORS_ORIGINS).toEqual([
//       "http://localhost:3000",
//       "https://admin.example.com",
//     ]);

//     expect(result.APP_SUPPORTED_LANGUAGES).toEqual(["it", "en"]);

//     expect(result.APP_DEFAULT_LANGUAGE).toBe("it");

//     expect(result.REDIS_ENABLED).toBe(true);

//     expect(result.TRUST_PROXY).toBe(1);

//     expect(result.AUTH_COOKIE_SECURE).toBe(false);
//   });

//   it("rejects insecure production configuration", () => {
//     expect(() =>
//       parseEnvironment(
//         validEnvironment({
//           NODE_ENV: "production",

//           DB_PASSWORD: "",

//           REDIS_ENABLED: "false",

//           AUTH_COOKIE_SECURE: "false",

//           /*
//            * These make the remaining production-only
//            * Auth requirements valid so this test focuses
//            * on DB / Redis / Secure cookie validation.
//            */

//           AUTH_OTP_PROVIDER: "webhook",

//           AUTH_SMS_WEBHOOK_URL: "https://sms.example.com/send",

//           GOOGLE_WEB_CLIENT_ID: "test-web.apps.googleusercontent.com",

//           AUTH_OTP_FIXED_CODE: undefined,
//         }),
//       ),
//     ).toThrow(/DB_PASSWORD|REDIS_ENABLED|AUTH_COOKIE_SECURE/);
//   });

//   it("rejects wildcard credentialed CORS", () => {
//     expect(() =>
//       parseEnvironment(
//         validEnvironment({
//           CORS_ORIGINS: "*",
//         }),
//       ),
//     ).toThrow(/CORS_ORIGINS/);
//   });

//   it("rejects a default language outside the supported list", () => {
//     expect(() =>
//       parseEnvironment(
//         validEnvironment({
//           APP_DEFAULT_LANGUAGE: "fr",

//           APP_SUPPORTED_LANGUAGES: "it,en",
//         }),
//       ),
//     ).toThrow(/APP_DEFAULT_LANGUAGE/);
//   });

//   it("rejects invalid database pool configuration", () => {
//     expect(() =>
//       parseEnvironment(
//         validEnvironment({
//           DB_POOL_MIN: "20",

//           DB_POOL_MAX: "10",
//         }),
//       ),
//     ).toThrow(/DB_POOL_MIN/);
//   });

//   it("requires all authentication secrets to be different", () => {
//     expect(() =>
//       parseEnvironment(
//         validEnvironment({
//           /*
//            * Deliberately reuse access secret.
//            */
//           JWT_REFRESH_SECRET: "a".repeat(64),
//         }),
//       ),
//     ).toThrow(/JWT_ACCESS_SECRET/);
//   });

//   it("requires secure cookies when SameSite is none", () => {
//     expect(() =>
//       parseEnvironment(
//         validEnvironment({
//           AUTH_COOKIE_SAME_SITE: "none",

//           AUTH_COOKIE_SECURE: "false",
//         }),
//       ),
//     ).toThrow(/AUTH_COOKIE_SECURE/);
//   });

//   it("rejects console OTP provider in production", () => {
//     expect(() =>
//       parseEnvironment(
//         validEnvironment({
//           NODE_ENV: "production",

//           DB_PASSWORD: "production-password",

//           REDIS_ENABLED: "true",

//           AUTH_COOKIE_SECURE: "true",

//           AUTH_COOKIE_SAME_SITE: "lax",

//           AUTH_OTP_PROVIDER: "console",

//           GOOGLE_WEB_CLIENT_ID: "production-web.apps.googleusercontent.com",
//         }),
//       ),
//     ).toThrow(/AUTH_OTP_PROVIDER/);
//   });

//   it("rejects fixed OTP in production", () => {
//     expect(() =>
//       parseEnvironment(
//         validEnvironment({
//           NODE_ENV: "production",

//           DB_PASSWORD: "production-password",

//           REDIS_ENABLED: "true",

//           AUTH_COOKIE_SECURE: "true",

//           AUTH_COOKIE_SAME_SITE: "lax",

//           AUTH_OTP_PROVIDER: "webhook",

//           AUTH_SMS_WEBHOOK_URL: "https://sms.example.com/send",

//           AUTH_OTP_FIXED_CODE: "123456",

//           GOOGLE_WEB_CLIENT_ID: "production-web.apps.googleusercontent.com",
//         }),
//       ),
//     ).toThrow(/AUTH_OTP_FIXED_CODE/);
//   });

//   it("requires Google client IDs in production", () => {
//     expect(() =>
//       parseEnvironment(
//         validEnvironment({
//           NODE_ENV: "production",

//           DB_PASSWORD: "production-password",

//           REDIS_ENABLED: "true",

//           AUTH_COOKIE_SECURE: "true",

//           AUTH_COOKIE_SAME_SITE: "lax",

//           AUTH_OTP_PROVIDER: "webhook",

//           AUTH_SMS_WEBHOOK_URL: "https://sms.example.com/send",

//           AUTH_OTP_FIXED_CODE: undefined,

//           GOOGLE_WEB_CLIENT_ID: "",
//         }),
//       ),
//     ).toThrow(/GOOGLE_WEB_CLIENT_ID/);
//   });
// });
