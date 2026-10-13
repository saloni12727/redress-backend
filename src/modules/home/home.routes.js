import { Router } from "express";

import { asyncHandler } from "../../utils/async-handler.js";

import { getHomeFeedController } from "./home.controller.js";

const router = Router();

router.get("/feed", asyncHandler(getHomeFeedController));

export default router;
