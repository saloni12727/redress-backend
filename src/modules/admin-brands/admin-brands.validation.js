import { z } from "zod";

const code = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);

const slug = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const name = z.string().trim().min(1).max(150);

function optionalUrl() {
  return z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.string().trim().url().max(500).nullable().optional(),
  );
}

function optionalBoolean() {
  return z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    return value;
  }, z.boolean().optional());
}

const brandFields = {
  code: code.optional(),
  name: name.optional(),
  slug: slug.optional(),
  websiteUrl: optionalUrl(),
  isActive: optionalBoolean(),
};

export const createBrandSchema = z
  .object(brandFields)
  .strict()
  .superRefine((value, context) => {
    for (const field of ["code", "name", "slug"]) {
      if (value[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "required",
        });
      }
    }
  });

export const updateBrandSchema = z.object(brandFields).strict();

const queryValue = (schema) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.at(-1) : value),
    schema,
  );

export const brandIdSchema = z.object({
  id: queryValue(z.coerce.number().int().positive().safe()),
});

export const listBrandsQuerySchema = z
  .object({
    page: queryValue(z.coerce.number().int().min(1).max(100000).default(1)),
    limit: queryValue(z.coerce.number().int().min(1).max(100).default(20)),
    q: queryValue(z.string().trim().min(1).max(150).optional()),
    isActive: queryValue(
      z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
    ),
  })
  .strict();
