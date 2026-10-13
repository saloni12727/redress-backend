import { randomUUID } from "node:crypto";

function isValidRequestId(value) {
  if (typeof value !== "string") {
    return false;
  }

  if (value.length === 0 || value.length > 100) {
    return false;
  }

  return /^[a-zA-Z0-9._:-]+$/.test(value);
}

export function requestIdMiddleware(request, response, next) {
  const incomingRequestId = request.headers["x-request-id"];

  const requestId = isValidRequestId(incomingRequestId)
    ? incomingRequestId
    : randomUUID();

  request.id = requestId;

  response.setHeader("X-Request-Id", requestId);

  next();
}
