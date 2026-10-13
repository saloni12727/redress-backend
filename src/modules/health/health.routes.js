import { Router } from "express";

import {
  livenessCheck,
  readinessCheck,
} from "./health.controller.js";
import { asyncHandler } from "../../utils/async-handler.js";

const router = Router();

// Keep the original route as a backwards-compatible readiness endpoint.
router.get("/", asyncHandler(readinessCheck));
router.get("/live", livenessCheck);
router.get("/ready", asyncHandler(readinessCheck));

export default router;
