import { Router } from "express";

import { authenticateStandard } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createBodyProfileController,
  deleteBodyProfileController,
  estimateStoredBodyProfileController,
  getBodyProfileController,
  listBodyProfilesController,
  updateBodyProfileController,
  upsertSelfBodyProfileController,
} from "./shopper-fit.controller.js";

const router = Router();

router.use(authenticateStandard);
router.get("/", asyncHandler(listBodyProfilesController));
router.post("/", asyncHandler(createBodyProfileController));
router.put("/self", asyncHandler(upsertSelfBodyProfileController));
router.post("/:id/estimate", asyncHandler(estimateStoredBodyProfileController));
router.get("/:id", asyncHandler(getBodyProfileController));
router.patch("/:id", asyncHandler(updateBodyProfileController));
router.delete("/:id", asyncHandler(deleteBodyProfileController));

export default router;
