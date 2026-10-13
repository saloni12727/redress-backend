import { z } from "zod";

const optionalString = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  },

  z.string().trim().min(1).optional(),
);

const mailEnvironmentSchema = z
  .object({
    MAIL_SERVICE: optionalString,

    MAIL_USER: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() === "") {
          return undefined;
        }

        return value;
      },

      z.string().trim().email().optional(),
    ),

    MAIL_PASS: optionalString,

    MAIL_FROM: optionalString,
  })
  .superRefine((data, context) => {
    const values = [
      data.MAIL_SERVICE,
      data.MAIL_USER,
      data.MAIL_PASS,
      data.MAIL_FROM,
    ];

    const configured = values.some(Boolean);

    if (!configured) {
      return;
    }

    if (!data.MAIL_SERVICE) {
      context.addIssue({
        code: "custom",

        path: ["MAIL_SERVICE"],

        message: "MAIL_SERVICE is required when email SMTP is configured",
      });
    }

    if (!data.MAIL_USER) {
      context.addIssue({
        code: "custom",

        path: ["MAIL_USER"],

        message: "MAIL_USER is required when email SMTP is configured",
      });
    }

    if (!data.MAIL_PASS) {
      context.addIssue({
        code: "custom",

        path: ["MAIL_PASS"],

        message: "MAIL_PASS is required when email SMTP is configured",
      });
    }

    if (!data.MAIL_FROM) {
      context.addIssue({
        code: "custom",

        path: ["MAIL_FROM"],

        message: "MAIL_FROM is required when email SMTP is configured",
      });
    }
  });

const parsed = mailEnvironmentSchema.safeParse(process.env);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;

  throw new Error(
    `Invalid mail configuration:\n${JSON.stringify(fieldErrors, null, 2)}`,
  );
}

const data = parsed.data;

const mailConfig = Object.freeze({
  enabled: Boolean(
    data.MAIL_SERVICE && data.MAIL_USER && data.MAIL_PASS && data.MAIL_FROM,
  ),

  service: data.MAIL_SERVICE ?? null,

  user: data.MAIL_USER ?? null,

  password: data.MAIL_PASS ?? null,

  from: data.MAIL_FROM ?? null,
});

export function getMailConfig() {
  return mailConfig;
}
