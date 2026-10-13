export class AppError extends Error {
  constructor({
    message = "Application error",

    statusCode = 500,

    errorCode = "INTERNAL",

    messageKey = "errorGeneric",

    details = {
      retryable: true,
    },
  } = {}) {
    super(message);

    this.name = "AppError";

    this.statusCode = statusCode;

    this.errorCode = errorCode;

    this.messageKey = messageKey;

    this.details = details;

    Error.captureStackTrace?.(this, this.constructor);
  }
}
