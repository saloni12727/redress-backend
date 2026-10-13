import { AdminOperationsError } from "./admin-operations.error.js";
import * as service from "./admin-operations.service.js";
import * as validation from "./admin-operations.validation.js";

const fail = (response, status, message) => response.status(status).json({ success: false, data: null, message });
const send = (response, status, data, message) => response.status(status).json({ success: true, data, message });
const handle = (error, response, next) => error instanceof AdminOperationsError ? fail(response, error.statusCode, error.message) : next(error);

function parse(schema, value, response, { status = 422, message = "The request contains invalid fields." } = {}) {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  fail(response, status, message);
  return null;
}

export async function dashboardOverviewController(request, response, next) {
  try { return send(response, 200, await service.getAdminDashboardOverview(), "Dashboard overview retrieved successfully."); } catch (error) { return handle(error, response, next); }
}

export async function listOrdersController(request, response, next) {
  const filters = parse(validation.listOrdersSchema, request.query, response, { status: 400, message: "One or more query parameters are invalid." });
  if (!filters) return;
  try { return send(response, 200, await service.listAdminOrders(filters), "Orders retrieved successfully."); } catch (error) { return handle(error, response, next); }
}

export async function getOrderController(request, response, next) {
  const params = parse(validation.orderIdSchema, request.params, response, { status: 400, message: "The order identifier is invalid." });
  if (!params) return;
  try { return send(response, 200, await service.getAdminOrder(params.id), "Order retrieved successfully."); } catch (error) { return handle(error, response, next); }
}

export async function updateOrderStatusController(request, response, next) {
  const params = parse(validation.orderIdSchema, request.params, response, { status: 400, message: "The order identifier is invalid." });
  const payload = parse(validation.updateOrderStatusSchema, request.body ?? {}, response);
  if (!params || !payload) return;
  try { return send(response, 200, await service.updateAdminOrderStatus({ orderId: params.id, status: payload.status }), "Order status updated successfully."); } catch (error) { return handle(error, response, next); }
}

export async function updateOrderTrackingController(request, response, next) {
  const params = parse(validation.orderIdSchema, request.params, response, { status: 400, message: "The order identifier is invalid." });
  const payload = parse(validation.updateTrackingSchema, request.body ?? {}, response);
  if (!params || !payload) return;
  try { return send(response, 200, await service.updateAdminOrderTracking({ orderId: params.id, payload }), "Order tracking updated successfully."); } catch (error) { return handle(error, response, next); }
}

export async function listReturnsController(request, response, next) {
  const filters = parse(validation.listReturnsSchema, request.query, response, { status: 400, message: "One or more query parameters are invalid." });
  if (!filters) return;
  try { return send(response, 200, await service.listAdminReturns(filters), "Return requests retrieved successfully."); } catch (error) { return handle(error, response, next); }
}

export async function getReturnController(request, response, next) {
  const params = parse(validation.returnIdSchema, request.params, response, { status: 400, message: "The return request identifier is invalid." });
  if (!params) return;
  try { return send(response, 200, await service.getAdminReturn(params.id), "Return request retrieved successfully."); } catch (error) { return handle(error, response, next); }
}

async function returnAction(request, response, next, action, message, schema = null) {
  const params = parse(validation.returnIdSchema, request.params, response, { status: 400, message: "The return request identifier is invalid." });
  const payload = schema ? parse(schema, request.body ?? {}, response) : null;
  if (!params || (schema && !payload)) return;
  try { return send(response, 200, await action(params.id, payload), message); } catch (error) { return handle(error, response, next); }
}

export const approveReturnController = (request, response, next) => returnAction(request, response, next, service.approveAdminReturn, "Return request approved successfully.");
export const rejectReturnController = (request, response, next) => returnAction(request, response, next, service.rejectAdminReturn, "Return request rejected successfully.");
export const receiveReturnController = (request, response, next) => returnAction(request, response, next, service.receiveAdminReturn, "Return received successfully.");
export const refundReturnController = (request, response, next) => returnAction(request, response, next, (id, payload) => service.recordAdminReturnRefund({ returnId: id, payload }), "Refund recorded successfully.", validation.refundReturnSchema);
