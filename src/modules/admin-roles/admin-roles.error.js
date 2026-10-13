export class AdminRoleError extends Error {
  constructor(message, { statusCode = 422, code = "ROLE_INVALID" } = {}) {
    super(message);
    this.name = "AdminRoleError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const roleNotFound = () => new AdminRoleError("The requested role could not be found.", {
  statusCode: 404,
  code: "ROLE_NOT_FOUND",
});
