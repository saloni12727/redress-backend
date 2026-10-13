import { z } from "zod";

import {
  CATALOG_SORT_VALUES,
  HOME_LIST_STATUSES,
  HOME_SECTION_KEYS,
  HOME_STORED_STATUSES,
  HOME_TARGET_TYPES,
} from "./admin-home.constants.js";

const slug = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const simpleCode = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9_-]+$/);

const decimalPrice = z
  .string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/);
function parseJson(value) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function optionalPositiveId() {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    return typeof value === "string" ? Number(value) : value;
  }, z.number().int().positive().safe().optional());
}

function optionalSortOrder() {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    return typeof value === "string" ? Number(value) : value;
  }, z.number().int().min(0).max(1_000_000).optional());
}

function optionalText(maximum) {
  return z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.string().trim().min(1).max(maximum).nullable().optional(),
  );
}

function optionalDate() {
  return z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === "") {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }, z.date().nullable().optional());
}

const catalogFiltersSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    return parseJson(value);
  },
  z
    .object({
      category: slug.optional(),
      brand: z.array(slug).min(1).max(20).optional(),
      color: z.array(simpleCode).min(1).max(20).optional(),
      size: z.array(z.string().trim().regex(/^\d+$/)).min(1).max(50).optional(),
      fit: z.array(simpleCode).min(1).max(20).optional(),
      minPrice: decimalPrice.optional(),
      maxPrice: decimalPrice.optional(),
      featured: z.boolean().optional(),
      inStock: z.boolean().optional(),
      sort: z.enum(CATALOG_SORT_VALUES).optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (
        value.minPrice !== undefined &&
        value.maxPrice !== undefined &&
        Number(value.minPrice) > Number(value.maxPrice)
      ) {
        context.addIssue({
          code: "custom",
          path: ["maxPrice"],
          message: "must_be_greater_than_or_equal_to_min_price",
        });
      }
    })
    .optional(),
);

const placementFields = {
  sectionKey: z.enum(HOME_SECTION_KEYS).optional(),
  targetType: z.enum(HOME_TARGET_TYPES).optional(),
  targetProductId: optionalPositiveId(),
  targetBrandId: optionalPositiveId(),
  targetCategoryId: optionalPositiveId(),
  targetFilters: catalogFiltersSchema,
  titleEn: optionalText(200),
  titleIt: optionalText(200),
  subtitleEn: optionalText(500),
  subtitleIt: optionalText(500),
  ctaLabelEn: optionalText(100),
  ctaLabelIt: optionalText(100),
  altTextEn: optionalText(255),
  altTextIt: optionalText(255),
  badgeEn: optionalText(100),
  badgeIt: optionalText(100),
  discountLabelEn: optionalText(100),
  discountLabelIt: optionalText(100),
  startsAt: optionalDate(),
  endsAt: optionalDate(),
  sortOrder: optionalSortOrder(),
};

const targetFields = [
  "targetProductId",
  "targetBrandId",
  "targetCategoryId",
  "targetFilters",
];

function validateCreateDestination(value, context) {
  if (!value.targetType) {
    context.addIssue({
      code: "custom",
      path: ["targetType"],
      message: "required",
    });
    return;
  }

  const requiredField = {
    product: "targetProductId",
    brand: "targetBrandId",
    category: "targetCategoryId",
    catalog: "targetFilters",
  }[value.targetType];

  if (value[requiredField] === undefined || value[requiredField] === null) {
    context.addIssue({
      code: "custom",
      path: [requiredField],
      message: "required_for_target_type",
    });
  }

  for (const field of targetFields) {
    if (field !== requiredField && value[field] !== undefined) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: "not_allowed_for_target_type",
      });
    }
  }
}

export const createPlacementSchema = z
  .object(placementFields)
  .strict()
  .superRefine((value, context) => {
    if (!value.sectionKey) {
      context.addIssue({
        code: "custom",
        path: ["sectionKey"],
        message: "required",
      });
    }
    validateCreateDestination(value, context);
  });

export const updatePlacementSchema = z
  .object(placementFields)
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "at_least_one_field_required",
  });

const queryValue = (schema) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.at(-1) : value),
    schema,
  );

export const placementIdSchema = z.object({
  id: queryValue(z.coerce.number().int().positive().safe()),
});

export const listPlacementsQuerySchema = z
  .object({
    page: queryValue(z.coerce.number().int().min(1).max(100000).default(1)),
    limit: queryValue(z.coerce.number().int().min(1).max(100).default(20)),
    sectionKey: queryValue(z.enum(HOME_SECTION_KEYS).optional()),
    status: queryValue(z.enum(HOME_LIST_STATUSES).optional()),
    startsBefore: queryValue(optionalDate()),
    endsAfter: queryValue(optionalDate()),
  })
  .strict();

export const archivePlacementSchema = z.object({}).strict();

export const storedStatusSchema = z.enum(HOME_STORED_STATUSES);
