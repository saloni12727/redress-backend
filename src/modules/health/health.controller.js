import { env } from "../../config/env.js";

import {
  getLivenessStatus,
  getReadinessStatus,
} from "./health.service.js";

function createResponse(request, health) {
  return {
    success: health.healthy,
    status: health.status,
    service: env.APP_NAME,
    ...("dependencies" in health
      ? { dependencies: health.dependencies }
      : {}),
    timestamp: new Date().toISOString(),
    requestId: request.id,
  };
}

export function livenessCheck(request, response) {
  const health = getLivenessStatus();

  return response.status(200).json(createResponse(request, health));
}

export async function readinessCheck(request, response) {
  const health = await getReadinessStatus();

  return response
    .status(health.healthy ? 200 : 503)
    .json(createResponse(request, health));
}
