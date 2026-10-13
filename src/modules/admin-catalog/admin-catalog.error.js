export class AdminCatalogError extends Error {
  constructor(message, { statusCode = 422, code = "CATALOG_INVALID" } = {}) {
    super(message);
    this.name = "AdminCatalogError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function catalogNotFound(resource) {
  return new AdminCatalogError(`The requested ${resource} could not be found.`, {
    statusCode: 404,
    code: `${resource.toUpperCase().replaceAll(" ", "_")}_NOT_FOUND`,
  });
}
