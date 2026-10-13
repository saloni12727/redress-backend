import {
  archivePlacementSchema,
  createPlacementSchema,
  listPlacementsQuerySchema,
  placementIdSchema,
  updatePlacementSchema,
} from "./admin-home.validation.js";
import {
  archiveHomePlacement,
  createHomePlacement,
  deleteHomePlacement,
  getHomePlacement,
  listHomePlacements,
  publishHomePlacement,
  updateHomePlacement,
} from "./admin-home.service.js";
import { AdminHomeError } from "./admin-home.error.js";

function invalidRequest(response) {
  return response.status(422).json({
    success: false,
    data: null,
    message: "One or more Home placement fields are invalid.",
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
    message: "The Home placement identifier is invalid.",
  });
}

function handleExpectedError(error, response, next) {
  if (error instanceof AdminHomeError) {
    return response.status(error.statusCode).json({
      success: false,
      data: null,
      message: error.message,
    });
  }

  return next(error);
}

export async function listPlacementsController(request, response, next) {
  const parsed = listPlacementsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return invalidQuery(response);
  }

  try {
    const data = await listHomePlacements(parsed.data);
    return response.status(200).json({
      success: true,
      data,
      message: "Home placements retrieved successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function getPlacementController(request, response, next) {
  const parsed = placementIdSchema.safeParse(request.params);
  if (!parsed.success) {
    return invalidIdentifier(response);
  }

  try {
    const data = await getHomePlacement(parsed.data.id);
    return response.status(200).json({
      success: true,
      data,
      message: "Home placement retrieved successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function createPlacementController(request, response, next) {
  const parsed = createPlacementSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return invalidRequest(response);
  }

  try {
    const data = await createHomePlacement({
      payload: parsed.data,
      file: request.mediaFile,
      accountId: request.auth.accountId,
    });
    return response.status(201).json({
      success: true,
      data,
      message: "Home placement draft created successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function updatePlacementController(request, response, next) {
  const params = placementIdSchema.safeParse(request.params);
  if (!params.success) {
    return invalidIdentifier(response);
  }

  const parsed = updatePlacementSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return invalidRequest(response);
  }

  try {
    const data = await updateHomePlacement({
      id: params.data.id,
      payload: parsed.data,
      file: request.mediaFile,
      accountId: request.auth.accountId,
    });
    return response.status(200).json({
      success: true,
      data,
      message: "Home placement updated successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function publishPlacementController(request, response, next) {
  const params = placementIdSchema.safeParse(request.params);
  if (!params.success) {
    return invalidIdentifier(response);
  }

  try {
    const data = await publishHomePlacement({
      id: params.data.id,
      accountId: request.auth.accountId,
    });
    return response.status(200).json({
      success: true,
      data,
      message: "Home placement published successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function archivePlacementController(request, response, next) {
  const params = placementIdSchema.safeParse(request.params);
  if (!params.success) {
    return invalidIdentifier(response);
  }

  const body = archivePlacementSchema.safeParse(request.body ?? {});
  if (!body.success) {
    return invalidRequest(response);
  }

  try {
    const data = await archiveHomePlacement({
      id: params.data.id,
      accountId: request.auth.accountId,
    });
    return response.status(200).json({
      success: true,
      data,
      message: "Home placement archived successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}

export async function deletePlacementController(request, response, next) {
  const params = placementIdSchema.safeParse(request.params);
  if (!params.success) {
    return invalidIdentifier(response);
  }

  try {
    await deleteHomePlacement({ id: params.data.id });
    return response.status(200).json({
      success: true,
      data: null,
      message: "Home placement deleted successfully.",
    });
  } catch (error) {
    return handleExpectedError(error, response, next);
  }
}
