import { Router } from "express";

import { authenticateStandard } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { skipFitSetupController } from "./shopper-fit.controller.js";

const router = Router();

router.post("/fit-setup/skip", authenticateStandard, asyncHandler(skipFitSetupController));

export default router;
