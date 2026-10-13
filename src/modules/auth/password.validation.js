import { z } from "zod";

import { strongPasswordSchema } from "./auth.validation.js";

const emailAddress = z.string().trim().email().max(254);

/*
|--------------------------------------------------------------------------
| Forgot password
|--------------------------------------------------------------------------
*/

export const forgotPasswordSchema = z
  .object({
    email: emailAddress,
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Verify forgot-password OTP
|--------------------------------------------------------------------------
*/

export const forgotPasswordVerifySchema = z
  .object({
    email: emailAddress,

    otp: z.string().regex(/^\d{6}$/),
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Reset password using resetToken
|--------------------------------------------------------------------------
*/

export const resetPasswordSchema = z
  .object({
    resetToken: z.string().min(32).max(512),

    newPassword: strongPasswordSchema,
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Change existing password
|--------------------------------------------------------------------------
*/

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),

    newPassword: strongPasswordSchema,
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],

    message: "New password must be different from current password",
  });

/*
|--------------------------------------------------------------------------
| Set first password
|--------------------------------------------------------------------------
|
| Used mainly for authenticated Google users who have:
|
| emailVerified = true
| hasPassword = false
|
*/

export const setPasswordSchema = z
  .object({
    newPassword: strongPasswordSchema,
  })
  .strict();
