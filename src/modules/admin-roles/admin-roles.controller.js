import { AdminRoleError } from "./admin-roles.error.js";
import { createRoleSchema, roleIdSchema, updateRoleSchema } from "./admin-roles.validation.js";
import * as service from "./admin-roles.service.js";

const fail = (response, status, message) => response.status(status).json({ success: false, data: null, message });
const send = (response, status, data, message) => response.status(status).json({ success: true, data, message });
const handle = (error, response, next) => error instanceof AdminRoleError ? fail(response, error.statusCode, error.message) : next(error);

export async function listRolesController(request, response, next) { try { return send(response, 200, await service.listAdminRoles(), "Roles retrieved successfully."); } catch (error) { return handle(error, response, next); } }
export async function listPermissionsController(request, response, next) { try { return send(response, 200, await service.listPlatformPermissions(), "Permissions retrieved successfully."); } catch (error) { return handle(error, response, next); } }
export async function createRoleController(request, response, next) { const parsed = createRoleSchema.safeParse(request.body ?? {}); if (!parsed.success) return fail(response, 422, "One or more role fields are invalid."); try { return send(response, 201, await service.createAdminRole(parsed.data), "Role created successfully."); } catch (error) { return handle(error, response, next); } }
export async function updateRoleController(request, response, next) { const params = roleIdSchema.safeParse(request.params); const parsed = updateRoleSchema.safeParse(request.body ?? {}); if (!params.success) return fail(response, 400, "The role identifier is invalid."); if (!parsed.success) return fail(response, 422, "One or more role fields are invalid."); try { return send(response, 200, await service.updateAdminRole(params.data.id, parsed.data), "Role updated successfully."); } catch (error) { return handle(error, response, next); } }
export async function deleteRoleController(request, response, next) { const params = roleIdSchema.safeParse(request.params); if (!params.success) return fail(response, 400, "The role identifier is invalid."); try { await service.deleteAdminRole(params.data.id); return send(response, 200, null, "Role deleted successfully."); } catch (error) { return handle(error, response, next); } }
