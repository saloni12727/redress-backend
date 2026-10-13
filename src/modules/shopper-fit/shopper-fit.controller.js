import {
  createBodyProfileSchema,
  estimateFieldsSchema,
  listBodyProfilesQuerySchema,
  profileIdSchema,
  updateBodyProfileSchema,
} from "./shopper-fit.validation.js";
import {
  createBodyProfile,
  deleteBodyProfile,
  estimateStoredBodyProfile,
  estimateMeasurements,
  getBodyProfile,
  listBodyProfiles,
  skipFitSetup,
  updateBodyProfile,
  uploadBodyPhoto,
  upsertSelfBodyProfile,
} from "./shopper-fit.service.js";

function invalid(response, message = "One or more fields are invalid.") {
  return response.status(422).json({ success: false, data: null, message });
}

function parse(schema, value, response) {
  const result = schema.safeParse(value);
  return result.success ? result.data : (invalid(response), null);
}

export async function listBodyProfilesController(request, response, next) {
  const filters = parse(listBodyProfilesQuerySchema, request.query, response);
  if (!filters) return;
  try {
    const result = await listBodyProfiles({ accountId: request.auth.accountId, filters });
    return response.status(200).json({ success: true, data: result.items, page: result.page, message: "Body profiles retrieved successfully." });
  } catch (error) { return next(error); }
}

export async function getBodyProfileController(request, response, next) {
  const params = parse(profileIdSchema, request.params, response);
  if (!params) return;
  try {
    return response.status(200).json({ success: true, data: await getBodyProfile({ accountId: request.auth.accountId, profileId: params.id }), message: "Body profile retrieved successfully." });
  } catch (error) { return next(error); }
}

export async function createBodyProfileController(request, response, next) {
  const payload = parse(createBodyProfileSchema, request.body ?? {}, response);
  if (!payload) return;
  try {
    return response.status(201).json({ success: true, data: await createBodyProfile({ accountId: request.auth.accountId, payload }), message: "Body profile created successfully." });
  } catch (error) { return next(error); }
}

export async function upsertSelfBodyProfileController(request, response, next) {
  const payload = parse(createBodyProfileSchema, { ...(request.body ?? {}), relation: "self" }, response);
  if (!payload) return;
  try {
    return response.status(200).json({ success: true, data: await upsertSelfBodyProfile({ accountId: request.auth.accountId, payload }), message: "Your body profile was saved successfully." });
  } catch (error) { return next(error); }
}

export async function updateBodyProfileController(request, response, next) {
  const params = parse(profileIdSchema, request.params, response);
  const payload = parse(updateBodyProfileSchema, request.body ?? {}, response);
  if (!params || !payload) return;
  try {
    return response.status(200).json({ success: true, data: await updateBodyProfile({ accountId: request.auth.accountId, profileId: params.id, payload }), message: "Body profile updated successfully." });
  } catch (error) { return next(error); }
}

export async function deleteBodyProfileController(request, response, next) {
  const params = parse(profileIdSchema, request.params, response);
  if (!params) return;
  try {
    await deleteBodyProfile({ accountId: request.auth.accountId, profileId: params.id });
    return response.status(200).json({ success: true, data: null, message: "Body profile deleted successfully." });
  } catch (error) { return next(error); }
}

export async function uploadBodyPhotoController(request, response, next) {
  if (request.body?.purpose !== "bodyPhoto" || !request.mediaFile) return invalid(response, "A body photo upload requires purpose bodyPhoto and a file.");
  try {
    return response.status(201).json({ success: true, data: await uploadBodyPhoto({ accountId: request.auth.accountId, file: request.mediaFile }), message: "Body photo uploaded successfully." });
  } catch (error) { return next(error); }
}

export async function skipFitSetupController(request, response, next) {
  try {
    return response.status(200).json({ success: true, data: await skipFitSetup({ accountId: request.auth.accountId }), message: "Fit setup was skipped successfully." });
  } catch (error) { return next(error); }
}

export async function estimateMeasurementsController(request, response, next) {
  const fields = parse(estimateFieldsSchema, request.body ?? {}, response);
  if (!fields) return;
  try {
    return response.status(200).json({ success: true, data: await estimateMeasurements({ fields, files: request.measurementFiles }), message: "Measurements estimated successfully." });
  } catch (error) { return next(error); }
}

export async function estimateStoredBodyProfileController(request, response, next) {
  const params = parse(profileIdSchema, request.params, response);
  if (!params) return;
  try {
    return response.status(200).json({ success: true, data: await estimateStoredBodyProfile({ accountId: request.auth.accountId, profileId: params.id }), message: "Measurements estimated successfully." });
  } catch (error) { return next(error); }
}
