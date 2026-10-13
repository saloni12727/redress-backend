export class VendorProductError extends Error {
  constructor(message, { statusCode = 422, code = "VENDOR_PRODUCT_INVALID" } = {}) {
    super(message);
    this.name = "VendorProductError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function productNotFound() {
  return new VendorProductError("The requested product could not be found.", {
    statusCode: 404,
    code: "PRODUCT_NOT_FOUND",
  });
}
