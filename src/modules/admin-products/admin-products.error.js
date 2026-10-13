export class AdminProductError extends Error {
  constructor(message, { statusCode = 422, code = "ADMIN_PRODUCT_INVALID" } = {}) {
    super(message);
    this.name = "AdminProductError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function adminProductNotFound() {
  return new AdminProductError("The requested product could not be found.", { statusCode: 404, code: "PRODUCT_NOT_FOUND" });
}
