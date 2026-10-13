import { z } from "zod";
import { strongPasswordSchema } from "../auth/auth.validation.js";

const identifier = z.coerce.number().int().positive().safe();
const code = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
const slug = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionalString = (max) => z.preprocess((value) => value === "" || value === null ? null : value, z.string().trim().max(max).nullable().optional());
const email = z.preprocess((value) => value === "" || value === null ? null : value, z.string().trim().email().max(191).nullable().optional());
const website = z.preprocess((value) => value === "" || value === null ? null : value, z.string().trim().url().max(500).nullable().optional());

const vendorFields = {
  code: code.optional(), slug: slug.optional(), displayName: z.string().trim().min(1).max(180).optional(), legalName: optionalString(220), email, phone: optionalString(40), defaultCurrencyCode: z.string().trim().regex(/^[A-Z]{3}$/).optional(), countryCode: z.preprocess((value) => value === "" || value === null ? null : value, z.string().trim().regex(/^[A-Z]{2}$/).nullable().optional()), taxIdentifier: optionalString(100), registrationNumber: optionalString(120), websiteUrl: website,
};

export const createOnboardingSchema = z.object(vendorFields).strict().superRefine((value, context) => { for (const field of ["code", "slug", "displayName", "defaultCurrencyCode"]) if (value[field] === undefined) context.addIssue({ code: "custom", path: [field], message: "required" }); });
export const updateOnboardingSchema = z.object(vendorFields).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const staffIdSchema = z.object({ staffId: identifier });
export const createStaffSchema = z.object({ email: z.string().trim().email().max(191), firstName: z.string().trim().min(1).max(100), lastName: z.preprocess((value) => value === "" || value === null ? null : value, z.string().trim().min(1).max(100).nullable().optional()), password: strongPasswordSchema, }).strict();
export const updateStaffSchema = z.object({ status: z.enum(["active", "inactive"]) }).strict();
