import { z } from "zod";

const queryValue = (schema) => z.preprocess((value) => Array.isArray(value) ? value.at(-1) : value, schema);
const identifier = z.coerce.number().int().positive().safe();

export const vendorIdSchema = z.object({ id: queryValue(identifier) });
export const listOnboardingQuerySchema = z.object({
  page: queryValue(z.coerce.number().int().min(1).max(100000).default(1)),
  limit: queryValue(z.coerce.number().int().min(1).max(100).default(20)),
  q: queryValue(z.string().trim().min(1).max(180).optional()),
  approvalStatus: queryValue(z.enum(["pending", "approved", "rejected"]).optional()),
  status: queryValue(z.enum(["active", "inactive", "suspended"]).optional()),
}).strict();

export const rejectVendorSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
}).strict();

export const updateVendorStatusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]),
}).strict();
