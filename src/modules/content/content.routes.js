import { Router } from "express";

import { asyncHandler } from "../../utils/async-handler.js";
import { privacyPolicyController } from "./content.controller.js";

const router = Router();

router.get("/policies/privacy", asyncHandler(privacyPolicyController));

export default router;
