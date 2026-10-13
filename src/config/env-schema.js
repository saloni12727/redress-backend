import { z } from "zod";

const booleanValue = z.preprocess(
  (value) => {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (["true", "1", "yes", "on"].includes(normalized)) {
        return true;
      }

      if (["false", "0", "no", "off"].includes(normalized)) {
        return false;
      }
    }

    return value;
  },

  z.boolean(),
);

const positiveInteger = z.coerce.number().int().positive();

const nonNegativeInteger = z.coerce.number().int().nonnegative();

const optionalString = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  },

  z.string().trim().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  },

  z.string().trim().url().optional(),
);

const optionalOrigin = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  },
  z
    .string()
    .trim()
    .url()
    .refine((value) => {
      const parsed = new URL(value);
      return (
        ["http:", "https:"].includes(parsed.protocol) &&
        !parsed.username &&
        !parsed.password &&
        parsed.pathname === "/" &&
        !parsed.search &&
        !parsed.hash
      );
    }, "API_PUBLIC_ORIGIN must contain only scheme, host, and optional port")
    .transform((value) => new URL(value).origin)
    .optional(),
);

const googleClientId = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  },

  z
    .string()
    .trim()
    .max(255)
    .regex(
      /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/,
      "Invalid Google OAuth client ID",
    )
    .optional(),
);

const commaSeparatedUrls = z
  .string()
  .trim()
  .min(1)
  .transform((value, context) => {
    const values = [
      ...new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];

    if (values.length === 0) {
      context.addIssue({
        code: "custom",

        message: "At least one CORS origin is required",
      });

      return z.NEVER;
    }

    for (const origin of values) {
      if (origin === "*") {
        context.addIssue({
          code: "custom",

          message: "Wildcard CORS origins are not allowed with credentials",
        });

        return z.NEVER;
      }

      try {
        const parsed = new URL(origin);

        if (
          !["http:", "https:"].includes(parsed.protocol) ||
          parsed.username ||
          parsed.password ||
          parsed.pathname !== "/" ||
          parsed.search ||
          parsed.hash
        ) {
          throw new Error("Unsupported protocol");
        }

        values[values.indexOf(origin)] = parsed.origin;
      } catch {
        context.addIssue({
          code: "custom",

          message: `Invalid CORS origin: ${origin}`,
        });

        return z.NEVER;
      }
    }

    return [...new Set(values)];
  });

const supportedLanguagesValue = z
  .string()
  .trim()
  .min(1)
  .transform((value) => [
    ...new Set(
      value
        .split(",")
        .map((language) => language.trim().toLowerCase())
        .filter(Boolean),
    ),
  ])
  .pipe(z.array(z.string().regex(/^[a-z]{2}(?:-[a-z]{2})?$/)).min(1));

const trustProxyValue = z.preprocess(
  (value) => {
    if (typeof value === "boolean" || typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (normalized === "true") {
        return true;
      }

      if (normalized === "false") {
        return false;
      }

      if (/^\d+$/.test(normalized)) {
        return Number(normalized);
      }
    }

    return value;
  },

  z.union([z.boolean(), z.number().int().nonnegative()]),
);

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    APP_NAME: z.string().trim().min(1).default("Redress API"),

    HOST: z.string().trim().min(1).default("0.0.0.0"),

    PORT: z.coerce.number().int().min(1).max(65535).default(5000),

    API_PREFIX: z
      .string()
      .trim()
      .regex(/^\/[a-zA-Z0-9/_-]*$/)
      .default("/api/v1"),

    API_PUBLIC_ORIGIN: optionalOrigin,

    CORS_ORIGINS: commaSeparatedUrls,

    APP_DEFAULT_LANGUAGE: z.string().trim().toLowerCase().min(2).default("it"),

    APP_SUPPORTED_LANGUAGES: z.preprocess(
      (value) => value ?? "it,en",

      supportedLanguagesValue,
    ),

    /*
      |--------------------------------------------------------------------------
      | JWT / Authentication secrets
      |--------------------------------------------------------------------------
      */

    JWT_ACCESS_SECRET: z
      .string()
      .min(64, "JWT_ACCESS_SECRET must be at least 64 characters"),

    JWT_REFRESH_SECRET: z
      .string()
      .min(64, "JWT_REFRESH_SECRET must be at least 64 characters"),

    JWT_GUEST_SECRET: z
      .string()
      .min(64, "JWT_GUEST_SECRET must be at least 64 characters"),

    JWT_SIGNUP_SECRET: z
      .string()
      .min(64, "JWT_SIGNUP_SECRET must be at least 64 characters"),

    JWT_GOOGLE_LINK_SECRET: z
      .string()
      .min(64, "JWT_GOOGLE_LINK_SECRET must be at least 64 characters"),

    AUTH_OTP_HASH_SECRET: z
      .string()
      .min(64, "AUTH_OTP_HASH_SECRET must be at least 64 characters"),

    JWT_ACCESS_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(432000)
      .default(900),

    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),

    JWT_GUEST_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),

    AUTH_SIGNUP_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(900),

    AUTH_GOOGLE_LINK_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(900),

    AUTH_REFRESH_GRACE_SECONDS: z.coerce
      .number()
      .int()
      .min(0)
      .max(60)
      .default(10),

    AUTH_SENSITIVE_ACTION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(600),

    /*
      |--------------------------------------------------------------------------
      | OTP
      |--------------------------------------------------------------------------
      */
    AUTH_OTP_ALLOW_CONSOLE_IN_PRODUCTION: booleanValue.default(false),

    AUTH_OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),

    AUTH_OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),

    AUTH_OTP_RESEND_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(300)
      .default(60),

    AUTH_OTP_MAX_SENDS_PER_HOUR: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5),

    // AUTH_OTP_PROVIDER: z.enum(["console", "webhook"]).default("console"),
    AUTH_OTP_PROVIDER: z
      .enum(["disabled", "console", "webhook"])
      .default("disabled"),

    AUTH_OTP_FIXED_CODE: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() === "") {
          return undefined;
        }

        return value;
      },

      z
        .string()
        .regex(/^\d{6}$/)
        .optional(),
    ),

    AUTH_SMS_WEBHOOK_URL: optionalUrl,

    AUTH_SMS_WEBHOOK_BEARER_TOKEN: optionalString,

    AUTH_EMAIL_WEBHOOK_URL: optionalUrl,

    AUTH_EMAIL_WEBHOOK_BEARER_TOKEN: optionalString,

    /*
      |--------------------------------------------------------------------------
      | Google
      |--------------------------------------------------------------------------
      */

    GOOGLE_WEB_CLIENT_ID: googleClientId,

    GOOGLE_ANDROID_CLIENT_ID: googleClientId,

    GOOGLE_IOS_CLIENT_ID: googleClientId,

    /*
      |--------------------------------------------------------------------------
      | Cookies
      |--------------------------------------------------------------------------
      */

    AUTH_REFRESH_COOKIE_NAME: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default("redress_refresh"),

    AUTH_GUEST_COOKIE_NAME: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default("redress_guest"),

    AUTH_COOKIE_SECURE: booleanValue.default(false),

    AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),

    LOG_LEVEL: z
      .enum(["silent", "fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),

    TRUST_PROXY: trustProxyValue.default(0),

    HTTP_REQUEST_TIMEOUT_MS: positiveInteger.default(30000),

    HTTP_HEADERS_TIMEOUT_MS: positiveInteger.default(35000),

    HTTP_KEEP_ALIVE_TIMEOUT_MS: positiveInteger.default(5000),

    SHUTDOWN_TIMEOUT_MS: positiveInteger.default(10000),

    RATE_LIMIT_ENABLED: booleanValue.default(true),

    RATE_LIMIT_WINDOW_MS: positiveInteger.default(900000),

    RATE_LIMIT_MAX: positiveInteger.default(1000),

    DB_HOST: z.string().trim().min(1),

    DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),

    DB_NAME: z.string().trim().min(1),

    DB_USER: z.string().trim().min(1),

    DB_PASSWORD: z.string(),

    DB_CONNECT_TIMEOUT_MS: positiveInteger.default(10000),

    DB_POOL_MAX: positiveInteger.default(10),

    DB_POOL_MIN: nonNegativeInteger.default(0),

    DB_POOL_ACQUIRE_MS: positiveInteger.default(30000),

    DB_POOL_IDLE_MS: positiveInteger.default(10000),

    DB_SSL_ENABLED: booleanValue.default(false),

    DB_SSL_REJECT_UNAUTHORIZED: booleanValue.default(true),

    DB_SSL_CA_PATH: z.string().trim().min(1).optional(),

    STORAGE_PROVIDER: z.enum(["s3"]).default("s3"),

    AWS_ACCESS_KEY_ID: optionalString,

    AWS_SECRET_ACCESS_KEY: optionalString,

    AWS_REGION: z.string().trim().min(1).default("us-east-1"),

    AWS_S3_BUCKET_NAME: z.string().trim().min(3),

    AWS_S3_PRODUCT_PREFIX: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9/_-]+$/)
      .default("products"),

    AWS_S3_PROFILE_PREFIX: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9/_-]+$/)
      .default("profiles"),

    AWS_S3_SIGNED_URL_EXPIRES_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(900),

    PROFILE_PHOTO_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(100 * 1024 * 1024)
      .default(100 * 1024 * 1024),

    REDIS_ENABLED: booleanValue.default(false),

    REDIS_URL: z.string().trim().min(1).default("redis://127.0.0.1:6379"),

    REDIS_CONNECT_TIMEOUT_MS: positiveInteger.default(10000),

    REDIS_KEY_PREFIX: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+:?$/)
      .default("redress:"),
  })

  .superRefine((data, context) => {
    if (!data.APP_SUPPORTED_LANGUAGES.includes(data.APP_DEFAULT_LANGUAGE)) {
      context.addIssue({
        code: "custom",

        path: ["APP_DEFAULT_LANGUAGE"],

        message:
          "APP_DEFAULT_LANGUAGE must exist inside APP_SUPPORTED_LANGUAGES",
      });
    }

    if (data.DB_POOL_MIN > data.DB_POOL_MAX) {
      context.addIssue({
        code: "custom",

        path: ["DB_POOL_MIN"],

        message: "DB_POOL_MIN cannot be greater than DB_POOL_MAX",
      });
    }

    /*
     * Access, refresh, guest, signup, Google-link
     * and OTP hash secrets must be different.
     */
    const authSecrets = new Set([
      data.JWT_ACCESS_SECRET,
      data.JWT_REFRESH_SECRET,
      data.JWT_GUEST_SECRET,
      data.JWT_SIGNUP_SECRET,
      data.JWT_GOOGLE_LINK_SECRET,
      data.AUTH_OTP_HASH_SECRET,
    ]);

    if (authSecrets.size !== 6) {
      context.addIssue({
        code: "custom",

        path: ["JWT_ACCESS_SECRET"],

        message: "All authentication secrets must be different",
      });
    }

    if (data.AUTH_COOKIE_SAME_SITE === "none" && !data.AUTH_COOKIE_SECURE) {
      context.addIssue({
        code: "custom",

        path: ["AUTH_COOKIE_SECURE"],

        message:
          "AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE=none",
      });
    }

    /*
     * Webhook mode may support SMS, email, or both.
     * At least one channel adapter must be configured.
     */
    if (
      data.AUTH_OTP_PROVIDER === "webhook" &&
      !data.AUTH_SMS_WEBHOOK_URL &&
      !data.AUTH_EMAIL_WEBHOOK_URL
    ) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_OTP_PROVIDER"],
        message:
          "Webhook OTP provider requires AUTH_SMS_WEBHOOK_URL and/or AUTH_EMAIL_WEBHOOK_URL",
      });
    }

    if (data.NODE_ENV === "production") {
      if (data.JWT_ACCESS_TTL_SECONDS > 3600) {
        context.addIssue({
          code: "custom",
          path: ["JWT_ACCESS_TTL_SECONDS"],
          message:
            "JWT_ACCESS_TTL_SECONDS cannot exceed one hour in production",
        });
      }

      if (data.DB_PASSWORD.length === 0) {
        context.addIssue({
          code: "custom",

          path: ["DB_PASSWORD"],

          message: "DB_PASSWORD cannot be empty in production",
        });
      }

      if (!data.REDIS_ENABLED) {
        context.addIssue({
          code: "custom",

          path: ["REDIS_ENABLED"],

          message: "Redis must be enabled in production",
        });
      }

      if (!data.AUTH_COOKIE_SECURE) {
        context.addIssue({
          code: "custom",

          path: ["AUTH_COOKIE_SECURE"],

          message: "AUTH_COOKIE_SECURE must be true in production",
        });
      }

      if (
        data.AUTH_OTP_PROVIDER === "console" &&
        !data.AUTH_OTP_ALLOW_CONSOLE_IN_PRODUCTION
      ) {
        context.addIssue({
          code: "custom",
          path: ["AUTH_OTP_PROVIDER"],
          message:
            "Console OTP provider is not allowed in production unless AUTH_OTP_ALLOW_CONSOLE_IN_PRODUCTION=true",
        });
      }

      if (
        data.AUTH_OTP_FIXED_CODE &&
        !data.AUTH_OTP_ALLOW_CONSOLE_IN_PRODUCTION
      ) {
        context.addIssue({
          code: "custom",
          path: ["AUTH_OTP_FIXED_CODE"],
          message:
            "Fixed OTP code is not allowed in production unless AUTH_OTP_ALLOW_CONSOLE_IN_PRODUCTION=true",
        });
      }
      // if (data.AUTH_OTP_PROVIDER === "console") {
      //   context.addIssue({
      //     code: "custom",

      //     path: ["AUTH_OTP_PROVIDER"],

      //     message: "Console OTP provider is not allowed in production",
      //   });
      // }

      // if (data.AUTH_OTP_FIXED_CODE) {
      //   context.addIssue({
      //     code: "custom",

      //     path: ["AUTH_OTP_FIXED_CODE"],

      //     message: "Fixed OTP code is not allowed in production",
      //   });
      // }

    }
  });

export function parseEnvironment(values) {
  const parsed = environmentSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    throw new Error(
      `Invalid environment configuration:\n${JSON.stringify(
        fieldErrors,
        null,
        2,
      )}`,
    );
  }

  return Object.freeze(parsed.data);
}
