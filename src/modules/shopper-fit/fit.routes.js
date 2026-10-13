import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { authenticateStandard } from "../../middleware/authenticate.js";
import { bodyMeasurementUpload } from "../../middleware/body-measurement-upload.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { estimateMeasurementsController } from "./shopper-fit.controller.js";

const router = Router();

/* Photo estimation is deliberately more constrained than ordinary profile
 * editing: it is CPU-intensive and uses sensitive in-memory images. */
const measurementEstimateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (request) =>
    `measurement-estimate:${request.auth?.accountId ?? ipKeyGenerator(request.ip)}`,
  handler(_request, response) {
    return response.status(429).json({
      success: false,
      data: null,
      message: "Too many measurement estimation requests. Please try again later.",
    });
  },
});

router.post(
  "/measurements/estimate",
  authenticateStandard,
  measurementEstimateRateLimiter,
  bodyMeasurementUpload,
  asyncHandler(estimateMeasurementsController),
);

export default router;
