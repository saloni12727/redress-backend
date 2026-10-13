export class AdminVendorError extends Error {
  constructor(message, { statusCode = 422, code = "ADMIN_VENDOR_INVALID" } = {}) {
    super(message);
    this.name = "AdminVendorError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function vendorNotFound() {
  return new AdminVendorError("The requested vendor could not be found.", {
    statusCode: 404,
    code: "VENDOR_NOT_FOUND",
  });
}
