import { z } from "zod";

const categoryCode = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);

const categorySlug = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const categoryName = z.string().trim().min(1).max(150);

function optionalDescription() {
  return z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().trim().max(5000).nullable().optional(),
  );
}

function optionalParentId() {
  return z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === "") {
      return null;
    }

    return typeof value === "string" ? Number(value) : value;
  }, z.number().int().positive().safe().nullable().optional());
}

const categoryFields = {
  parentId: optionalParentId(),

  code: categoryCode.optional(),

  slug: categorySlug.optional(),

  nameEn: categoryName.optional(),

  nameIt: categoryName.optional(),

  descriptionEn: optionalDescription(),

  descriptionIt: optionalDescription(),

  sortOrder: z.number().int().min(0).max(1_000_000).optional(),

  isActive: z.boolean().optional(),
};

export const createCategorySchema = z
  .object(categoryFields)
  .strict()
  .superRefine((value, context) => {
    for (const field of ["code", "slug", "nameEn", "nameIt"]) {
      if (value[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "required",
        });
      }
    }
  });

export const updateCategorySchema = z
  .object(categoryFields)
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "at_least_one_field_required",
  });

const queryValue = (schema) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.at(-1) : value),
    schema,
  );

export const categoryIdSchema = z.object({
  id: queryValue(z.coerce.number().int().positive().safe()),
});

export const listCategoriesQuerySchema = z
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

    /*
     * parentId = 0
     * means root categories.
     */
    parentId: queryValue(z.coerce.number().int().min(0).safe().optional()),
  })
  .strict();
