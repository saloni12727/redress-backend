export class CommerceError extends Error {
  constructor(message, {
    statusCode = 422,
    errorCode = statusCode === 404 ? "NOT_FOUND" : statusCode === 409 ? "CONFLICT" : "UNPROCESSABLE",
    messageKey = statusCode === 404 ? "errorNotFound" : statusCode === 409 ? "errorConflict" : "errorUnprocessable",
    details = { retryable: false },
  } = {}) {
    super(message);
    this.name = "CommerceError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.messageKey = messageKey;
    this.details = details;
  }
}

export function commerceNotFound(message = "The requested resource could not be found.") {
  return new CommerceError(message, { statusCode: 404 });
}
