import { AppError } from "../../utils/app-error.js";

export function shopperFitError(
  message,
  {
    statusCode = 422,
    reason = undefined,
    fields = undefined,
    retryable = false,
    details = {},
  } = {},
) {
  return new AppError({
    message,
    statusCode,
    errorCode:
      statusCode === 404
        ? "NOT_FOUND"
        : statusCode === 409
          ? "CONFLICT"
          : statusCode === 503
            ? "SERVICE_UNAVAILABLE"
            : "UNPROCESSABLE",
    messageKey:
      statusCode === 404
        ? "errorNotFound"
        : statusCode === 409
          ? "errorConflict"
          : statusCode === 503
            ? "errorServiceUnavailable"
            : "errorUnprocessable",
    details: {
      retryable,
      ...(reason ? { reason } : {}),
      ...(fields ? { fields } : {}),
      ...details,
    },
  });
}

export const bodyProfileNotFound = () =>
  shopperFitError("The requested body profile could not be found.", {
    statusCode: 404,
  });
