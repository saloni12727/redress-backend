import { z } from "zod";

const identifier = z.coerce.number().int().positive().safe();
const code = z.string().trim().min(2).max(80).regex(/^[a-z][a-z0-9_]*$/);
const name = z.string().trim().min(2).max(120);
const permissionIds = z.array(identifier).max(250).refine((values) => new Set(values).size === values.length, "Duplicate permissions are not allowed");

export const roleIdSchema = z.object({ id: identifier });
export const createRoleSchema = z.object({ code, name, permissionIds: permissionIds.default([]) }).strict();
export const updateRoleSchema = z.object({ name: name.optional(), isActive: z.boolean().optional(), permissionIds: permissionIds.optional() }).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");
