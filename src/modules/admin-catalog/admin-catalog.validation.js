import { z } from "zod";

const lowerCode = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);

const sizeCode = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);

const shortName = z.string().trim().min(1).max(100);
const localizedName = z.string().trim().min(1).max(150);
const positiveId = z.coerce.number().int().positive().safe();
const sortOrder = z.coerce.number().int().min(0).max(1_000_000);

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

function optionalText(maximum) {
  return z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.string().trim().min(1).max(maximum).nullable().optional(),
  );
}

function required(fields, requiredFields) {
  return z
    .object(fields)
    .strict()
    .superRefine((value, context) => {
      for (const field of requiredFields) {
        if (value[field] === undefined) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: "required",
          });
        }
      }
    });
}

function patch(fields) {
  return z
    .object(fields)
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
      message: "at_least_one_field_required",
    });
}

const colorFields = {
  code: lowerCode.max(50).optional(),
  name: shortName.optional(),
  hexCode: optionalText(7).refine(
    (value) => value === undefined || value === null || /^#[0-9A-Fa-f]{6}$/.test(value),
    "invalid_hex_code",
  ),
  sortOrder: sortOrder.optional(),
  isActive: optionalBoolean(),
};

const sizeSystemFields = {
  code: lowerCode.max(50).optional(),
  name: shortName.optional(),
  isActive: optionalBoolean(),
};

const sizeFields = {
  sizeSystemId: positiveId.optional(),
  code: sizeCode.optional(),
  label: z.string().trim().min(1).max(50).optional(),
  sortOrder: sortOrder.optional(),
  isActive: optionalBoolean(),
};

const fitProfileFields = {
  code: lowerCode.max(50).optional(),
  name: shortName.optional(),
  sortOrder: sortOrder.optional(),
  isActive: optionalBoolean(),
};

const ATTRIBUTE_DATA_TYPES = ["option", "text", "decimal", "boolean"];
const ATTRIBUTE_INPUT_TYPES = ["select", "multiselect", "text", "number", "toggle"];

const attributeFields = {
  code: lowerCode.optional(),
  nameEn: localizedName.optional(),
  nameIt: localizedName.optional(),
  dataType: z.enum(ATTRIBUTE_DATA_TYPES).optional(),
  inputType: z.enum(ATTRIBUTE_INPUT_TYPES).optional(),
  unitCode: optionalText(20),
  allowsMultiple: optionalBoolean(),
  isFilterable: optionalBoolean(),
  isSearchable: optionalBoolean(),
  sortOrder: sortOrder.optional(),
  isActive: optionalBoolean(),
};

const attributeValueFields = {
  code: lowerCode.optional(),
  labelEn: localizedName.optional(),
  labelIt: localizedName.optional(),
  sortOrder: sortOrder.optional(),
  isActive: optionalBoolean(),
};

const categoryAttributeFields = {
  categoryId: positiveId.optional(),
  attributeId: positiveId.optional(),
  isRequired: optionalBoolean(),
  isFilterable: optionalBoolean(),
  isVariantAttribute: optionalBoolean(),
  sortOrder: sortOrder.optional(),
  isActive: optionalBoolean(),
};

export const createColorSchema = required(colorFields, ["code", "name"]);
export const updateColorSchema = patch(colorFields);
export const createSizeSystemSchema = required(sizeSystemFields, ["code", "name"]);
export const updateSizeSystemSchema = patch(sizeSystemFields);
export const createSizeSchema = required(sizeFields, ["sizeSystemId", "code", "label"]);
export const updateSizeSchema = patch(sizeFields);
export const createFitProfileSchema = required(fitProfileFields, ["code", "name"]);
export const updateFitProfileSchema = patch(fitProfileFields);
export const createAttributeSchema = required(attributeFields, [
  "code",
  "nameEn",
  "nameIt",
  "dataType",
  "inputType",
]);
export const updateAttributeSchema = patch(attributeFields);
export const createAttributeValueSchema = required(
  {
    attributeId: positiveId.optional(),
    ...attributeValueFields,
  },
  ["attributeId", "code", "labelEn", "labelIt"],
);
export const updateAttributeValueSchema = patch(attributeValueFields);
export const createCategoryAttributeSchema = required(categoryAttributeFields, [
  "categoryId",
  "attributeId",
]);
export const updateCategoryAttributeSchema = patch({
  isRequired: categoryAttributeFields.isRequired,
  isFilterable: categoryAttributeFields.isFilterable,
  isVariantAttribute: categoryAttributeFields.isVariantAttribute,
  sortOrder: categoryAttributeFields.sortOrder,
  isActive: categoryAttributeFields.isActive,
});

const queryValue = (schema) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.at(-1) : value),
    schema,
  );

const listBase = {
  page: queryValue(z.coerce.number().int().min(1).max(100000).default(1)),
  limit: queryValue(z.coerce.number().int().min(1).max(100).default(20)),
  q: queryValue(z.string().trim().min(1).max(150).optional()),
  isActive: queryValue(
    z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  ),
};

export const listColorsQuerySchema = z.object(listBase).strict();
export const listSizeSystemsQuerySchema = z.object(listBase).strict();
export const listFitProfilesQuerySchema = z.object(listBase).strict();
export const listAttributesQuerySchema = z
  .object({
    ...listBase,
    dataType: queryValue(z.enum(ATTRIBUTE_DATA_TYPES).optional()),
  })
  .strict();
export const listSizesQuerySchema = z
  .object({
    ...listBase,
    sizeSystemId: queryValue(positiveId.optional()),
  })
  .strict();
export const listAttributeValuesQuerySchema = z
  .object({
    ...listBase,
    attributeId: queryValue(positiveId.optional()),
  })
  .strict();
export const listCategoryAttributesQuerySchema = z
  .object({
    ...listBase,
    categoryId: queryValue(positiveId.optional()),
    attributeId: queryValue(positiveId.optional()),
  })
  .strict();

export const resourceIdSchema = z.object({
  id: queryValue(positiveId),
});

export const attributeIdSchema = z.object({
  attributeId: queryValue(positiveId),
});
