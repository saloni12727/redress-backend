export class AdminHomeError extends Error {
  constructor(message, { statusCode = 422, code = "HOME_CONTENT_INVALID" } = {}) {
    super(message);
    this.name = "AdminHomeError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function placementNotFound() {
  return new AdminHomeError("The requested Home placement could not be found.", {
    statusCode: 404,
    code: "HOME_PLACEMENT_NOT_FOUND",
  });
}
