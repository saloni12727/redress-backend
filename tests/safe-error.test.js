import { describe, expect, it } from "vitest";

import { safeErrorForLog } from "../src/utils/safe-error.js";

describe("safeErrorForLog", () => {
  it("does not copy arbitrary sensitive properties", () => {
    const error = new SyntaxError("Invalid JSON");
    error.body = '{"password":"secret"}';
    error.token = "private-token";
    error.code = "BAD_JSON";

    expect(safeErrorForLog(error)).toEqual({
      name: "SyntaxError",
      message: "Invalid JSON",
      code: "BAD_JSON",
    });
  });
});
