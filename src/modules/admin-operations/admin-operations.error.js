export class AdminOperationsError extends Error {
  constructor(message, { statusCode = 422 } = {}) {
    super(message);
    this.name = "AdminOperationsError";
    this.statusCode = statusCode;
  }
}

export function adminOperationsNotFound(message = "The requested resource could not be found.") {
  return new AdminOperationsError(message, { statusCode: 404 });
}
