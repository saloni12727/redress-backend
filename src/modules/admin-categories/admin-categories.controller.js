import {
  categoryIdSchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "./admin-categories.validation.js";

import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategory,
  listAdminCategories,
  updateAdminCategory,
} from "./admin-categories.service.js";

import { AdminCategoryError } from "./admin-categories.error.js";

function invalidRequest(response) {
  return response.status(422).json({
    success: false,

    data: null,

    message: "One or more category fields are invalid.",
  });
}

function invalidQuery(response) {
  return response.status(400).json({
    success: false,

    data: null,

    message: "One or more query parameters are invalid.",
  });
}

function invalidIdentifier(response) {
  return response.status(400).json({
    success: false,

    data: null,

    message: "The category identifier is invalid.",
  });
}

function handleExpectedError(error, response, next) {
  if (error instanceof AdminCategoryError) {
    return response.status(error.statusCode).json({
      success: false,

      data: null,

      message: error.message,
    });
  }

  return next(error);
}

export async function listCategoriesController(request, response, next) {
  const parsed = listCategoriesQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return invalidQuery(response);
  }

  try {
    const data = await listAdminCategories(parsed.data);

    return response.status(200).json({
      success: true,

      data,

      message: "Categories retrieved successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function getCategoryController(request, response, next) {
  const params = categoryIdSchema.safeParse(request.params);

  if (!params.success) {
    return invalidIdentifier(response);
  }

  try {
    const data = await getAdminCategory(params.data.id);

    return response.status(200).json({
      success: true,

      data,

      message: "Category retrieved successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function createCategoryController(request, response, next) {
  const parsed = createCategorySchema.safeParse(request.body ?? {});

  if (!parsed.success) {
    return invalidRequest(response);
  }

  try {
    const data = await createAdminCategory(parsed.data);

    return response.status(201).json({
      success: true,

      data,

      message: "Category created successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function updateCategoryController(request, response, next) {
  const params = categoryIdSchema.safeParse(request.params);

  if (!params.success) {
    return invalidIdentifier(response);
  }

  const parsed = updateCategorySchema.safeParse(request.body ?? {});

  if (!parsed.success) {
    return invalidRequest(response);
  }

  try {
    const data = await updateAdminCategory(params.data.id, parsed.data);

    return response.status(200).json({
      success: true,

      data,

      message: "Category updated successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function deleteCategoryController(request, response, next) {
  const params = categoryIdSchema.safeParse(request.params);

  if (!params.success) {
    return invalidIdentifier(response);
  }

  try {
    await deleteAdminCategory(params.data.id);

    return response.status(200).json({
      success: true,

      data: null,

      message: "Category deleted successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}
