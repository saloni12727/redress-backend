import { env } from "../../config/env.js";

import {
  changePassword,
  forgotPassword,
  PasswordServiceError,
  resetPassword,
  setPassword,
  verifyForgotPasswordOtp,
} from "./password.service.js";

import {
  changePasswordSchema,
  forgotPasswordSchema,
  forgotPasswordVerifySchema,
  resetPasswordSchema,
  setPasswordSchema,
} from "./password.validation.js";

function sendValidationError(res, validationError) {
  return res.status(400).json({
    errorCode: "VALIDATION",

    messageKey: "errorValidation",

    details: {
      retryable: false,

      fields: validationError.flatten().fieldErrors,
    },
  });
}

function handlePasswordControllerError(error, res, next) {
  if (error instanceof PasswordServiceError) {
    return res.status(error.statusCode).json({
      errorCode: error.errorCode,

      messageKey: error.messageKey,

      details: error.details,
    });
  }

  return next(error);
}

/*
|--------------------------------------------------------------------------
| POST /auth/forgot-password
|--------------------------------------------------------------------------
*/

export async function forgotPasswordController(req, res, next) {
  const parsed = forgotPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const result = await forgotPassword({
      ...parsed.data,

      locale: req.locale ?? env.APP_DEFAULT_LANGUAGE,
    });

    return res.status(202).json({
      data: result,
    });
  } catch (error) {
    return handlePasswordControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/forgot-password/verify
|--------------------------------------------------------------------------
*/

export async function forgotPasswordVerifyController(req, res, next) {
  const parsed = forgotPasswordVerifySchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const result = await verifyForgotPasswordOtp(parsed.data);

    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    return handlePasswordControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/reset-password
|--------------------------------------------------------------------------
*/

export async function resetPasswordController(req, res, next) {
  const parsed = resetPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const result = await resetPassword(parsed.data);

    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    return handlePasswordControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/change-password
|--------------------------------------------------------------------------
*/

export async function changePasswordController(req, res, next) {
  const parsed = changePasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const result = await changePassword({
      accountId: req.auth.accountId,

      sessionUuid: req.auth.sessionUuid,

      ...parsed.data,
    });

    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    return handlePasswordControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/set-password
|--------------------------------------------------------------------------
*/

export async function setPasswordController(req, res, next) {
  const parsed = setPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const result = await setPassword({
      accountId: req.auth.accountId,

      ...parsed.data,
    });

    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    return handlePasswordControllerError(error, res, next);
  }
}
