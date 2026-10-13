export class VendorManagementError extends Error {
  constructor(message, { statusCode = 422, code = "VENDOR_MANAGEMENT_INVALID" } = {}) {
    super(message);
    this.name = "VendorManagementError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
