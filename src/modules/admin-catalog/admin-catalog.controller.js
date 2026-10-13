import { AdminCatalogError } from "./admin-catalog.error.js";
import {
  createAttributeSchema,
  createAttributeValueSchema,
  createCategoryAttributeSchema,
  createColorSchema,
  createFitProfileSchema,
  createSizeSchema,
  createSizeSystemSchema,
  listAttributesQuerySchema,
  listAttributeValuesQuerySchema,
  listCategoryAttributesQuerySchema,
  listColorsQuerySchema,
  listFitProfilesQuerySchema,
  listSizesQuerySchema,
  listSizeSystemsQuerySchema,
  resourceIdSchema,
  updateAttributeSchema,
  updateAttributeValueSchema,
  updateCategoryAttributeSchema,
  updateColorSchema,
  updateFitProfileSchema,
  updateSizeSchema,
  updateSizeSystemSchema,
} from "./admin-catalog.validation.js";
import {
  createAdminAttribute,
  createAdminAttributeValue,
  createAdminCategoryAttribute,
  createAdminColor,
  createAdminFitProfile,
  createAdminSize,
  createAdminSizeSystem,
  deleteAdminAttribute,
  deleteAdminAttributeValue,
  deleteAdminCategoryAttribute,
  deleteAdminColor,
  deleteAdminFitProfile,
  deleteAdminSize,
  deleteAdminSizeSystem,
  getAdminAttribute,
  getAdminAttributeValue,
  getAdminCategoryAttribute,
  getAdminColor,
  getAdminFitProfile,
  getAdminSize,
  getAdminSizeSystem,
  listAdminAttributes,
  listAdminAttributeValues,
  listAdminCategoryAttributes,
  listAdminColors,
  listAdminFitProfiles,
  listAdminSizes,
  listAdminSizeSystems,
  updateAdminAttribute,
  updateAdminAttributeValue,
  updateAdminCategoryAttribute,
  updateAdminColor,
  updateAdminFitProfile,
  updateAdminSize,
  updateAdminSizeSystem,
} from "./admin-catalog.service.js";

function failed(response, status, message) {
  return response.status(status).json({
    success: false,
    data: null,
    message,
  });
}

function handleExpectedError(error, response, next) {
  if (error instanceof AdminCatalogError) {
    return failed(response, error.statusCode, error.message);
  }

  return next(error);
}

function listController(schema, service, plural) {
  return async function controller(request, response, next) {
    const parsed = schema.safeParse(request.query);

    if (!parsed.success) {
      return failed(response, 400, "One or more query parameters are invalid.");
    }

    try {
      const data = await service(parsed.data);
      return response.status(200).json({
        success: true,
        data,
        message: `${plural} retrieved successfully.`,
      });
    } catch (error) {
      return handleExpectedError(error, response, next);
    }
  };
}

function getController(service, singular) {
  return async function controller(request, response, next) {
    const params = resourceIdSchema.safeParse(request.params);

    if (!params.success) {
      return failed(response, 400, `The ${singular} identifier is invalid.`);
    }

    try {
      const data = await service(params.data.id);
      return response.status(200).json({
        success: true,
        data,
        message: `${singular[0].toUpperCase()}${singular.slice(1)} retrieved successfully.`,
      });
    } catch (error) {
      return handleExpectedError(error, response, next);
    }
  };
}

function createController(schema, service, singular) {
  return async function controller(request, response, next) {
    const parsed = schema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return failed(response, 422, `One or more ${singular} fields are invalid.`);
    }

    try {
      const data = await service(parsed.data);
      return response.status(201).json({
        success: true,
        data,
        message: `${singular[0].toUpperCase()}${singular.slice(1)} created successfully.`,
      });
    } catch (error) {
      return handleExpectedError(error, response, next);
    }
  };
}

function updateController(schema, service, singular) {
  return async function controller(request, response, next) {
    const params = resourceIdSchema.safeParse(request.params);
    const parsed = schema.safeParse(request.body ?? {});

    if (!params.success) {
      return failed(response, 400, `The ${singular} identifier is invalid.`);
    }

    if (!parsed.success) {
      return failed(response, 422, `One or more ${singular} fields are invalid.`);
    }

    try {
      const data = await service(params.data.id, parsed.data);
      return response.status(200).json({
        success: true,
        data,
        message: `${singular[0].toUpperCase()}${singular.slice(1)} updated successfully.`,
      });
    } catch (error) {
      return handleExpectedError(error, response, next);
    }
  };
}

function deleteController(service, singular) {
  return async function controller(request, response, next) {
    const params = resourceIdSchema.safeParse(request.params);

    if (!params.success) {
      return failed(response, 400, `The ${singular} identifier is invalid.`);
    }

    try {
      await service(params.data.id);
      return response.status(200).json({
        success: true,
        data: null,
        message: `${singular[0].toUpperCase()}${singular.slice(1)} deleted successfully.`,
      });
    } catch (error) {
      return handleExpectedError(error, response, next);
    }
  };
}

export const listColorsController = listController(
  listColorsQuerySchema,
  listAdminColors,
  "Colors",
);
export const getColorController = getController(getAdminColor, "color");
export const createColorController = createController(
  createColorSchema,
  createAdminColor,
  "color",
);
export const updateColorController = updateController(
  updateColorSchema,
  updateAdminColor,
  "color",
);
export const deleteColorController = deleteController(deleteAdminColor, "color");

export const listSizeSystemsController = listController(
  listSizeSystemsQuerySchema,
  listAdminSizeSystems,
  "Size systems",
);
export const getSizeSystemController = getController(
  getAdminSizeSystem,
  "size system",
);
export const createSizeSystemController = createController(
  createSizeSystemSchema,
  createAdminSizeSystem,
  "size system",
);
export const updateSizeSystemController = updateController(
  updateSizeSystemSchema,
  updateAdminSizeSystem,
  "size system",
);
export const deleteSizeSystemController = deleteController(
  deleteAdminSizeSystem,
  "size system",
);

export const listSizesController = listController(
  listSizesQuerySchema,
  listAdminSizes,
  "Sizes",
);
export const getSizeController = getController(getAdminSize, "size");
export const createSizeController = createController(
  createSizeSchema,
  createAdminSize,
  "size",
);
export const updateSizeController = updateController(
  updateSizeSchema,
  updateAdminSize,
  "size",
);
export const deleteSizeController = deleteController(deleteAdminSize, "size");

export const listFitProfilesController = listController(
  listFitProfilesQuerySchema,
  listAdminFitProfiles,
  "Fit profiles",
);
export const getFitProfileController = getController(
  getAdminFitProfile,
  "fit profile",
);
export const createFitProfileController = createController(
  createFitProfileSchema,
  createAdminFitProfile,
  "fit profile",
);
export const updateFitProfileController = updateController(
  updateFitProfileSchema,
  updateAdminFitProfile,
  "fit profile",
);
export const deleteFitProfileController = deleteController(
  deleteAdminFitProfile,
  "fit profile",
);

export const listAttributesController = listController(
  listAttributesQuerySchema,
  listAdminAttributes,
  "Attributes",
);
export const getAttributeController = getController(getAdminAttribute, "attribute");
export const createAttributeController = createController(
  createAttributeSchema,
  createAdminAttribute,
  "attribute",
);
export const updateAttributeController = updateController(
  updateAttributeSchema,
  updateAdminAttribute,
  "attribute",
);
export const deleteAttributeController = deleteController(
  deleteAdminAttribute,
  "attribute",
);

export const listAttributeValuesController = listController(
  listAttributeValuesQuerySchema,
  listAdminAttributeValues,
  "Attribute values",
);
export const getAttributeValueController = getController(
  getAdminAttributeValue,
  "attribute value",
);
export const createAttributeValueController = createController(
  createAttributeValueSchema,
  createAdminAttributeValue,
  "attribute value",
);
export const updateAttributeValueController = updateController(
  updateAttributeValueSchema,
  updateAdminAttributeValue,
  "attribute value",
);
export const deleteAttributeValueController = deleteController(
  deleteAdminAttributeValue,
  "attribute value",
);

export const listCategoryAttributesController = listController(
  listCategoryAttributesQuerySchema,
  listAdminCategoryAttributes,
  "Category attribute mappings",
);
export const getCategoryAttributeController = getController(
  getAdminCategoryAttribute,
  "category attribute mapping",
);
export const createCategoryAttributeController = createController(
  createCategoryAttributeSchema,
  createAdminCategoryAttribute,
  "category attribute mapping",
);
export const updateCategoryAttributeController = updateController(
  updateCategoryAttributeSchema,
  updateAdminCategoryAttribute,
  "category attribute mapping",
);
export const deleteCategoryAttributeController = deleteController(
  deleteAdminCategoryAttribute,
  "category attribute mapping",
);
