import { z } from "zod";

const e164Phone = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be valid E.164 format");

/* accounts.email and account_identities.provider_email are VARCHAR(191). */
const emailAddress = z.string().trim().email().max(191);

const profileName = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .transform((value) => value.replace(/\s+/g, " "));

const deviceFields = {
  deviceType: z.string().trim().min(1).max(50).optional(),

  deviceName: z.string().trim().min(1).max(120).optional(),
};

/*
 * The mobile clients submit the privacy-policy acknowledgement at signup.
 * Keep it optional for compatibility with already released clients, but
 * validate it whenever it is supplied so arbitrary nested fields cannot be
 * smuggled through this strict endpoint.
 */
export const consentSchema = z
  .object({
    /* Service validation intentionally decides required/stale errors so the
     * Flutter client gets the documented 422 field response. */
    privacyAccepted: z.boolean().optional(),

    privacyVersion: z
      .string()
      .trim()
      .max(64)
      .datetime({ offset: true })
      .optional(),
  })
  .strict();

function hasSequentialRun(value) {
  const normalized = value.toLowerCase();

  const sequences = [
    "abcdefghijklmnopqrstuvwxyz",
    "zyxwvutsrqponmlkjihgfedcba",
    "0123456789",
    "9876543210",
  ];

  for (let index = 0; index <= normalized.length - 3; index += 1) {
    const triplet = normalized.slice(index, index + 3);

    if (sequences.some((sequence) => sequence.includes(triplet))) {
      return true;
    }
  }

  return false;
}

export const strongPasswordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .max(200)
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a symbol")
  .refine((value) => !/(.)\1/.test(value), {
    message: "Password must not repeat the same character twice in a row",
  })
  .refine((value) => !hasSequentialRun(value), {
    message:
      "Password must not contain 3-character alphabetic or numeric sequences",
  });

export const otpSendSchema = z
  .object({
    /*
     * auth:
     *   normal phone/email login/signup OTP
     *
     * phone_link:
     *   attach/verify phone after authentication
     *
     * password_reset is intentionally NOT exposed here.
     * Forgot-password has its own dedicated endpoint.
     */
    purpose: z.enum(["auth", "phone_link"]).default("auth"),

    channel: z.enum(["sms", "email"]),

    phone: e164Phone.optional(),

    email: emailAddress.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.purpose === "phone_link" && value.channel !== "sms") {
      context.addIssue({
        code: "custom",
        path: ["channel"],
        message: "phone_link purpose requires sms channel",
      });
    }

    if (value.channel === "sms") {
      if (!value.phone) {
        context.addIssue({
          code: "custom",
          path: ["phone"],
          message: "Phone is required when channel is sms",
        });
      }

      if (value.email !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["email"],
          message: "Email must not be sent when channel is sms",
        });
      }
    }

    if (value.channel === "email") {
      if (!value.email) {
        context.addIssue({
          code: "custom",
          path: ["email"],
          message: "Email is required when channel is email",
        });
      }

      if (value.phone !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["phone"],
          message: "Phone must not be sent when channel is email",
        });
      }
    }
  });

export const otpVerifySchema = z
  .object({
    channel: z.enum(["sms", "email"]),

    phone: e164Phone.optional(),

    email: emailAddress.optional(),

    otp: z.string().regex(/^\d{6}$/),

    ...deviceFields,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.channel === "sms") {
      if (!value.phone) {
        context.addIssue({
          code: "custom",
          path: ["phone"],
          message: "Phone is required when channel is sms",
        });
      }

      if (value.email !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["email"],
          message: "Email must not be sent when channel is sms",
        });
      }
    }

    if (value.channel === "email") {
      if (!value.email) {
        context.addIssue({
          code: "custom",
          path: ["email"],
          message: "Email is required when channel is email",
        });
      }

      if (value.phone !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["phone"],
          message: "Phone must not be sent when channel is email",
        });
      }
    }
  });

/*
|--------------------------------------------------------------------------
| Phone verify after login
|--------------------------------------------------------------------------
*/

export const accountPhoneVerifySchema = z
  .object({
    phone: e164Phone,

    otp: z.string().regex(/^\d{6}$/),
  })
  .strict();

export const phoneChangeRequestSchema = z
  .object({
    newPhone: e164Phone,
  })
  .strict();

export const phoneChangeVerifySchema = z
  .object({
    newPhone: e164Phone,

    otp: z.string().regex(/^\d{6}$/),
  })
  .strict();

export const emailChangeRequestSchema = z
  .object({
    newEmail: emailAddress,
  })
  .strict();

export const emailChangeVerifySchema = z
  .object({
    newEmail: emailAddress,

    otp: z.string().regex(/^\d{6}$/),
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Signup
|--------------------------------------------------------------------------
|
| signupToken already contains the verified phone/email.
| Flutter cannot replace the verified identifier here.
|
*/

export const signupSchema = z
  .object({
    /* The service verifies the token first so token-related failures always
     * return the documented signup_token_invalid response. */
    signupToken: z.string().trim().min(1).max(8192),

    /* Channel-specific field rules are enforced after the verified token is
     * read, which keeps the error order deterministic for Flutter. */
    fullName: z.string().trim().max(200),

    /*
     * Required by service only when signupToken
     * represents an email signup.
     *
     * Phone signup intentionally has no password.
     */
    password: z.string().max(200).optional(),

    consent: consentSchema.optional(),

    ...deviceFields,
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Email / password login
|--------------------------------------------------------------------------
*/

export const loginSchema = z
  .object({
    email: emailAddress,

    password: z.string().min(1).max(200),

    ...deviceFields,
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Google
|--------------------------------------------------------------------------
*/

export const googleSchema = z
  .object({
    idToken: z.string().trim().min(20).max(8192),

    ...deviceFields,
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Refresh / logout
|--------------------------------------------------------------------------
*/

export const refreshSchema = z
  .object({
    /*
     * Flutter:
     * refreshToken comes in JSON.
     *
     * Browser:
     * refresh token comes from HttpOnly cookie.
     */
    refreshToken: z.string().min(20).optional(),
  })
  .strict();

export const logoutSchema = z
  .object({
    /*
     * Accepted for native API-contract compatibility.
     * Server-side session UUID from access token remains authoritative.
     */
    refreshToken: z.string().min(20).optional(),
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Profile
|--------------------------------------------------------------------------
*/

export const updateMeSchema = z
  .object({
    firstName: profileName.optional(),

    lastName: z.union([profileName, z.null()]).optional(),

    locale: z.enum(["it", "en"]).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.locale !== undefined,
    {
      message: "At least one field is required",
    },
  );

export const consentSubmissionSchema = z
  .object({
    consent: consentSchema.optional(),
  })
  .strict();
