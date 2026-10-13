export function safeErrorForLog(error, { includeStack = false } = {}) {
  if (!(error instanceof Error)) {
    return {
      name: "Error",
      message: "Non-error value thrown",
    };
  }

  const safeError = {
    name: error.name,
    message: error.message,
  };

  if (typeof error.code === "string" || typeof error.code === "number") {
    safeError.code = error.code;
  }

  if (includeStack && error.stack) {
    safeError.stack = error.stack;
  }

  return safeError;
}
