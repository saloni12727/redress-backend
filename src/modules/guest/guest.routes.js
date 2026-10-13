import { Router } from "express";

import rateLimit from "express-rate-limit";

import { createGuestSessionController } from "./guest.controller.js";

const router = Router();

const guestSessionRateLimiter = rateLimit({
  windowMs: 60 * 1000,

  limit: 30,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler(req, res) {
    return res.status(429).json({
      success: false,
      data: null,
      message: "Too many guest session requests. Please try again later.",
    });
  },
});

router.post("/sessions", guestSessionRateLimiter, createGuestSessionController);

export default router;
