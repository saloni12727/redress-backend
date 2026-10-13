export class AdminBrandError extends Error {
  constructor(message, { statusCode = 422, code = "BRAND_INVALID" } = {}) {
    super(message);
    this.name = "AdminBrandError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function brandNotFound() {
  return new AdminBrandError("The requested brand could not be found.", {
    statusCode: 404,
    code: "BRAND_NOT_FOUND",
  });
}
