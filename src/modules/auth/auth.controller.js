import { env } from "../../config/env.js";

import { getAuthConfig } from "../../config/auth.config.js";

import {
  resolveClientType,
  UntrustedOriginError,
} from "../../utils/client-context.js";

import {
  AuthServiceError,
  acceptPrivacyConsent,
  deleteCurrentUserPhoto,
  getCurrentUser,
  googleLogin,
  login,
  logout,
  logoutAll,
  refresh,
  requestCurrentAccountEmailChange,
  requestCurrentAccountPhoneChange,
  sendOtp,
  signup,
  updateCurrentUser,
  uploadCurrentUserPhoto,
  verifyCurrentAccountEmailChange,
  verifyCurrentAccountPhone,
  verifyCurrentAccountPhoneChange,
  verifyOtp,
} from "./auth.service.js";

import {
  accountPhoneVerifySchema,
  consentSubmissionSchema,
  emailChangeRequestSchema,
  emailChangeVerifySchema,
  googleSchema,
  loginSchema,
  logoutSchema,
  otpSendSchema,
  otpVerifySchema,
  phoneChangeRequestSchema,
  phoneChangeVerifySchema,
  refreshSchema,
  signupSchema,
  updateMeSchema,
} from "./auth.validation.js";

function getAuthCookiePath() {
  const prefix = env.API_PREFIX.replace(/\/+$/, "");

  return `${prefix}/auth`;
}

function usesSignupConsentContract(req) {
  return req.get("x-app-contract")?.trim().toLowerCase() === "signup-consent";
}

function sendValidationError(res, validationError) {
  return res.status(400).json({
    success: false,

    data: null,

    message: "The request contains invalid or unsupported fields.",

    errorCode: "VALIDATION",

    messageKey: "errorValidation",

    details: {
      retryable: false,

      fields: validationError.flatten().fieldErrors,
    },
  });
}

function handleControllerError(error, res, next) {
  if (error instanceof UntrustedOriginError) {
    return res.status(403).json({
      success: false,

      data: null,

      message: "This request is not allowed from the current origin.",

      errorCode: "FORBIDDEN",

      messageKey: "errorForbidden",

      details: {
        retryable: false,

        reason: "untrusted_origin",
      },
    });
  }

  if (error instanceof AuthServiceError) {
    return res.status(error.statusCode).json({
      success: false,

      data: null,

      message: "The request could not be completed.",

      errorCode: error.errorCode,

      messageKey: error.messageKey,

      details: error.details,
    });
  }

  return next(error);
}

function refreshCookieOptions() {
  const config = getAuthConfig();

  return {
    httpOnly: true,

    secure: config.cookieSecure,

    sameSite: config.cookieSameSite,

    path: getAuthCookiePath(),

    maxAge: config.refreshTtlSeconds * 1000,
  };
}

function setRefreshCookie(res, refreshToken) {
  const config = getAuthConfig();

  res.cookie(config.refreshCookieName, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  const config = getAuthConfig();

  const options = refreshCookieOptions();

  delete options.maxAge;

  res.clearCookie(config.refreshCookieName, options);
}

function getRefreshCookie(req) {
  const config = getAuthConfig();

  return req.cookies?.[config.refreshCookieName] ?? null;
}

function getClientContext(req, clientType) {
  return {
    clientType,

    userAgent: req.get("user-agent") ?? null,

    ipAddress: req.ip ?? null,
  };
}

/*
|--------------------------------------------------------------------------
| Flutter vs Next.js token transport
|--------------------------------------------------------------------------
*/

function sendAuthenticatedResult({
  res,
  result,
  clientType,
  statusCode,
  message = "Authentication completed successfully.",
}) {
  /*
   * Next.js/browser:
   *
   * refresh token ONLY inside HttpOnly cookie.
   */
  if (clientType === "web") {
    setRefreshCookie(res, result.refreshToken);

    const { refreshToken, ...safeResult } = result;

    return res.status(statusCode).json({
      success: true,

      data: safeResult,

      message,
    });
  }

  /*
   * Flutter:
   *
   * receives refresh token in JSON
   * and stores it in flutter_secure_storage.
   */
  return res.status(statusCode).json({
    success: true,

    data: result,

    message,
  });
}

function sendAuthOutcome({ res, result, clientType, statusCode = 200 }) {
  if (result.status === "authenticated") {
    return sendAuthenticatedResult({
      res,
      result,
      clientType,
      statusCode,
    });
  }

  /*
   * Non-authenticated intermediate outcomes:
   *
   * - signup_required
   * - login_with_password
   * - login_with_google
   * - account_exists
   */
  return res.status(statusCode).json({
    success: true,

    data: result,

    message: "The authentication step was completed successfully.",
  });
}

/*
|--------------------------------------------------------------------------
| POST /auth/otp/send
|--------------------------------------------------------------------------
*/

export async function otpSendController(req, res, next) {
  const parsed = otpSendSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const result = await sendOtp({
      ...parsed.data,

      /*
       * Present only when phone_link passed
       * through conditional authentication.
       */
      accountId: req.auth?.accountId ?? null,

      locale: req.locale ?? env.APP_DEFAULT_LANGUAGE,
      requestId: req.id,
    });

    return res.status(202).json({
      success: true,

      data: result,

      message: "The verification code was sent successfully.",
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/otp/verify
|--------------------------------------------------------------------------
*/

export async function otpVerifyController(req, res, next) {
  const parsed = otpVerifySchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const clientType = resolveClientType(req);

    const result = await verifyOtp({
      ...parsed.data,

      ...getClientContext(req, clientType),

      locale: req.locale ?? env.APP_DEFAULT_LANGUAGE,
    });

    return sendAuthOutcome({
      res,
      result,
      clientType,
      statusCode: 200,
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/signup
|--------------------------------------------------------------------------
*/

export async function signupController(req, res, next) {
  const parsed = signupSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const clientType = resolveClientType(req);

    const result = await signup({
      ...parsed.data,
      enforceSignupConsent: usesSignupConsentContract(req),

      ...getClientContext(req, clientType),

      locale: req.locale ?? env.APP_DEFAULT_LANGUAGE,
    });

    return sendAuthenticatedResult({
      res,
      result,
      clientType,
      statusCode: 201,
      message: "Account created successfully.",
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/login
|--------------------------------------------------------------------------
*/

export async function loginController(req, res, next) {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const clientType = resolveClientType(req);

    const result = await login({
      ...parsed.data,

      ...getClientContext(req, clientType),
    });

    return sendAuthenticatedResult({
      res,
      result,
      clientType,
      statusCode: 200,
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/google
|--------------------------------------------------------------------------
*/

export async function googleController(req, res, next) {
  const parsed = googleSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const clientType = resolveClientType(req);

    const result = await googleLogin({
      ...parsed.data,
      enforceSignupConsent: usesSignupConsentContract(req),

      ...getClientContext(req, clientType),

      locale: req.locale ?? env.APP_DEFAULT_LANGUAGE,
    });

    return sendAuthOutcome({
      res,
      result,
      clientType,
      statusCode: 200,
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/phone/verify
|--------------------------------------------------------------------------
*/

export async function accountPhoneVerifyController(req, res, next) {
  const parsed = accountPhoneVerifySchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const user = await verifyCurrentAccountPhone({
      accountId: req.auth.accountId,

      sessionUuid: req.auth.sessionUuid,

      ...parsed.data,
    });

    return res.status(200).json({
      data: user,
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

export async function emailChangeRequestController(req, res, next) {
  const parsed = emailChangeRequestSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const result = await requestCurrentAccountEmailChange({
      accountId: req.auth.accountId,
      newEmail: parsed.data.newEmail,
      locale: req.locale ?? env.APP_DEFAULT_LANGUAGE,
    });

    return res.status(202).json({ data: result });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

export async function emailChangeVerifyController(req, res, next) {
  const parsed = emailChangeVerifySchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const user = await verifyCurrentAccountEmailChange({
      accountId: req.auth.accountId,
      sessionUuid: req.auth.sessionUuid,
      ...parsed.data,
    });

    return res.status(200).json({ data: user });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

export async function phoneChangeRequestController(req, res, next) {
  const parsed = phoneChangeRequestSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const result = await requestCurrentAccountPhoneChange({
      accountId: req.auth.accountId,
      newPhone: parsed.data.newPhone,
      locale: req.locale ?? env.APP_DEFAULT_LANGUAGE,
    });

    return res.status(202).json({ data: result });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

export async function phoneChangeVerifyController(req, res, next) {
  const parsed = phoneChangeVerifySchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const user = await verifyCurrentAccountPhoneChange({
      accountId: req.auth.accountId,
      sessionUuid: req.auth.sessionUuid,
      ...parsed.data,
    });

    return res.status(200).json({ data: user });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/refresh
|--------------------------------------------------------------------------
*/

export async function refreshController(req, res, next) {
  const parsed = refreshSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const clientType = resolveClientType(req);

    const refreshToken =
      clientType === "web" ? getRefreshCookie(req) : parsed.data.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        errorCode: "SESSION_CLOSED",

        messageKey: "errorUnauthorized",

        details: {
          retryable: false,

          reason: "missing_refresh_token",
        },
      });
    }

    const result = await refresh({
      refreshToken,
    });

    return sendAuthenticatedResult({
      res,
      result,
      clientType,
      statusCode: 200,
    });
  } catch (error) {
    if (error instanceof AuthServiceError && error.statusCode === 401) {
      clearRefreshCookie(res);
    }

    return handleControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/logout
|--------------------------------------------------------------------------
*/

export async function logoutController(req, res, next) {
  /*
   * We accept refreshToken in native body for API-contract
   * compatibility, although sessionUuid from authenticated
   * access token is authoritative for logout.
   */
  const parsed = logoutSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    /*
     * This also performs trusted Origin check for browser calls.
     */
    resolveClientType(req);

    await logout({
      sessionUuid: req.auth.sessionUuid,
    });

    clearRefreshCookie(res);

    return res.status(204).send();
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| POST /auth/logout-all
|--------------------------------------------------------------------------
*/

export async function logoutAllController(req, res, next) {
  try {
    await logoutAll({
      accountId: req.auth.accountId,
    });

    clearRefreshCookie(res);

    return res.status(204).send();
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| GET /auth/me
|--------------------------------------------------------------------------
*/

export async function meController(req, res, next) {
  try {
    const user = await getCurrentUser({
      accountId: req.auth.accountId,
    });

    return res.status(200).json({ success: true, data: user, message: "Account profile retrieved successfully." });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

export async function consentController(req, res, next) {
  const parsed = consentSubmissionSchema.safeParse(req.body ?? {});
  if (!parsed.success) return sendValidationError(res, parsed.error);
  try {
    const user = await acceptPrivacyConsent({
      accountId: req.auth.accountId,
      consent: parsed.data.consent,
    });
    return res.status(200).json({
      success: true,
      data: { user },
      message: "Privacy consent recorded successfully.",
    });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

/*
|--------------------------------------------------------------------------
| PATCH /auth/me
|--------------------------------------------------------------------------
*/

export async function updateMeController(req, res, next) {
  const parsed = updateMeSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return sendValidationError(res, parsed.error);
  }

  try {
    const user = await updateCurrentUser({
      accountId: req.auth.accountId,

      ...parsed.data,
    });

    return res.status(200).json({ success: true, data: user, message: "Account profile updated successfully." });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

export async function uploadMePhotoController(req, res, next) {
  try {
    const user = await uploadCurrentUserPhoto({
      accountId: req.auth.accountId,
      buffer: req.profilePhoto?.buffer,
      contentType: req.profilePhoto?.contentType,
    });

    return res.status(200).json({ success: true, data: user, message: "Profile photo updated successfully." });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}

export async function deleteMePhotoController(req, res, next) {
  try {
    const user = await deleteCurrentUserPhoto({
      accountId: req.auth.accountId,
    });

    return res.status(200).json({ success: true, data: user, message: "Profile photo deleted successfully." });
  } catch (error) {
    return handleControllerError(error, res, next);
  }
}
