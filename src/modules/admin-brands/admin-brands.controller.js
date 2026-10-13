import {
  brandIdSchema,
  createBrandSchema,
  listBrandsQuerySchema,
  updateBrandSchema,
} from "./admin-brands.validation.js";
import {
  createAdminBrand,
  deleteAdminBrand,
  getAdminBrand,
  listAdminBrands,
  updateAdminBrand,
} from "./admin-brands.service.js";
import { AdminBrandError } from "./admin-brands.error.js";

function failed(response, status, message) {
  return response.status(status).json({
    success: false,
    data: null,
    message,
  });
}

function handleExpectedError(error, response, next) {
  if (error instanceof AdminBrandError) {
    return failed(response, error.statusCode, error.message);
  }

  return next(error);
}

export async function listBrandsController(request, response, next) {
  const parsed = listBrandsQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return failed(response, 400, "One or more query parameters are invalid.");
  }

  try {
    const data = await listAdminBrands(parsed.data);
    return response.status(200).json({
      success: true,
      data,
      message: "Brands retrieved successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function getBrandController(request, response, next) {
  const params = brandIdSchema.safeParse(request.params);

  if (!params.success) {
    return failed(response, 400, "The brand identifier is invalid.");
  }

  try {
    const data = await getAdminBrand(params.data.id);
    return response.status(200).json({
      success: true,
      data,
      message: "Brand retrieved successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function createBrandController(request, response, next) {
  const parsed = createBrandSchema.safeParse(request.body ?? {});

  if (!parsed.success) {
    return failed(response, 422, "One or more brand fields are invalid.");
  }

  try {
    const data = await createAdminBrand({
      payload: parsed.data,
      file: request.mediaFile,
    });
    return response.status(201).json({
      success: true,
      data,
      message: "Brand created successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function updateBrandController(request, response, next) {
  const params = brandIdSchema.safeParse(request.params);
  const parsed = updateBrandSchema.safeParse(request.body ?? {});

  if (!params.success) {
    return failed(response, 400, "The brand identifier is invalid.");
  }

  if (
    !parsed.success ||
    (Object.keys(parsed.data).length === 0 && !request.mediaFile)
  ) {
    return failed(response, 422, "One or more brand fields are invalid.");
  }

  try {
    const data = await updateAdminBrand({
      id: params.data.id,
      payload: parsed.data,
      file: request.mediaFile,
    });
    return response.status(200).json({
      success: true,
      data,
      message: "Brand updated successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function deleteBrandController(request, response, next) {
  const params = brandIdSchema.safeParse(request.params);

  if (!params.success) {
    return failed(response, 400, "The brand identifier is invalid.");
  }

  try {
    await deleteAdminBrand(params.data.id);
    return response.status(200).json({
      success: true,
      data: null,
      message: "Brand deleted successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}
