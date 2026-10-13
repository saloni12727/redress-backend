export class AdminCategoryError extends Error {
  constructor(message, { statusCode = 422, code = "CATEGORY_INVALID" } = {}) {
    super(message);

    this.name = "AdminCategoryError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function categoryNotFound() {
  return new AdminCategoryError("The requested category could not be found.", {
    statusCode: 404,
    code: "CATEGORY_NOT_FOUND",
  });
}
