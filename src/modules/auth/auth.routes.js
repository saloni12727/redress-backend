import { Router } from "express";

import rateLimit from "express-rate-limit";

import { env } from "../../config/env.js";
import { authenticate, authenticateStandard } from "../../middleware/authenticate.js";
import { profilePhotoUpload } from "../../middleware/profile-photo-upload.js";
import { requireRecentAuthentication } from "../../middleware/require-recent-authentication.js";

import {
  accountPhoneVerifyController,
  consentController,
  deleteMePhotoController,
  emailChangeRequestController,
  emailChangeVerifyController,
  googleController,
  loginController,
  logoutAllController,
  logoutController,
  meController,
  otpSendController,
  otpVerifyController,
  phoneChangeRequestController,
  phoneChangeVerifyController,
  refreshController,
  signupController,
  updateMeController,
  uploadMePhotoController,
} from "./auth.controller.js";

import {
  changePasswordController,
  forgotPasswordController,
  forgotPasswordVerifyController,
  resetPasswordController,
  setPasswordController,
} from "./password.controller.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Conditional authentication for phone_link OTP
|--------------------------------------------------------------------------
|
| Normal auth OTP remains PUBLIC.
|
| phone_link requires a valid Bearer session.
|
*/

function authenticatePhoneLinkOtp(req, res, next) {
  if (req.body?.purpose === "phone_link") {
    return authenticate(req, res, (error) => {
      if (error) {
        return next(error);
      }

      return requireRecentAuthentication(req, res, next);
    });
  }

  return next();
}

function rateLimitHandler(req, res) {
  return res.status(429).json({
    errorCode: "RATE_LIMITED",

    messageKey: "errorRateLimited",

    details: {
      retryable: true,
    },
  });
}

/*
|--------------------------------------------------------------------------
| OTP
|--------------------------------------------------------------------------
*/

const otpSendRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 20,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

const otpVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 40,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

/*
|--------------------------------------------------------------------------
| Signup / Login / Google
|--------------------------------------------------------------------------
*/

const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 20,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

const googleRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 30,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000,

  limit: 30,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

/*
|--------------------------------------------------------------------------
| Password
|--------------------------------------------------------------------------
*/

const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

const forgotPasswordVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 20,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

const resetPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

const authenticatedPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

const contactChangeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

const profilePhotoRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  handler: rateLimitHandler,
});

/*
|--------------------------------------------------------------------------
| Public / conditionally protected Auth APIs
|--------------------------------------------------------------------------
*/

router.post(
  "/otp/send",
  otpSendRateLimiter,
  authenticatePhoneLinkOtp,
  otpSendController,
);

router.post("/otp/verify", otpVerifyRateLimiter, otpVerifyController);

router.post("/signup", signupRateLimiter, signupController);

router.post("/login", loginRateLimiter, loginController);

router.post("/google", googleRateLimiter, googleController);

router.post("/refresh", refreshRateLimiter, refreshController);

router.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  forgotPasswordController,
);

router.post(
  "/forgot-password/verify",
  forgotPasswordVerifyRateLimiter,
  forgotPasswordVerifyController,
);

router.post(
  "/reset-password",
  resetPasswordRateLimiter,
  resetPasswordController,
);

/*
|--------------------------------------------------------------------------
| Authenticated APIs
|--------------------------------------------------------------------------
*/

router.post("/logout", authenticate, logoutController);

router.post("/logout-all", authenticate, logoutAllController);

router.get("/me", authenticateStandard, meController);

router.post("/consent", authenticateStandard, consentController);

router.patch("/me", authenticateStandard, updateMeController);

router.put(
  "/me/photo",
  authenticateStandard,
  profilePhotoRateLimiter,
  profilePhotoUpload,
  uploadMePhotoController,
);

router.delete(
  "/me/photo",
  authenticateStandard,
  profilePhotoRateLimiter,
  deleteMePhotoController,
);

router.post(
  "/phone/verify",
  authenticate,
  contactChangeRateLimiter,
  accountPhoneVerifyController,
);

router.post(
  "/email/change/request",
  authenticate,
  requireRecentAuthentication,
  contactChangeRateLimiter,
  emailChangeRequestController,
);

router.post(
  "/email/change/verify",
  authenticate,
  contactChangeRateLimiter,
  emailChangeVerifyController,
);

router.post(
  "/phone/change/request",
  authenticate,
  requireRecentAuthentication,
  contactChangeRateLimiter,
  phoneChangeRequestController,
);

router.post(
  "/phone/change/verify",
  authenticate,
  contactChangeRateLimiter,
  phoneChangeVerifyController,
);

router.post(
  "/change-password",
  authenticate,
  authenticatedPasswordRateLimiter,
  changePasswordController,
);

/*
|--------------------------------------------------------------------------
| Set First Password
|--------------------------------------------------------------------------
|
| Typical use:
|
| Google login
| -> no password yet
| -> verified email exists
| -> user wants to enable email/password login
|
| Adding a permanent authentication method is sensitive,
| therefore the current session must be recently authenticated.
|
*/

router.post(
  "/set-password",
  authenticate,
  requireRecentAuthentication,
  authenticatedPasswordRateLimiter,
  setPasswordController,
);

export default router;
