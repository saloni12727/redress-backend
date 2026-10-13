import { describe, expect, it, vi } from "vitest";

import { requireRecentAuthentication } from "../src/middleware/require-recent-authentication.js";

function responseDouble() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);

  return response;
}

describe("recent authentication middleware", () => {
  it("allows a recently-created authenticated session", () => {
    const request = {
      auth: {
        authenticatedAt: new Date(),
      },
    };
    const response = responseDouble();
    const next = vi.fn();

    requireRecentAuthentication(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("requires reauthentication for a stale session", () => {
    const request = {
      auth: {
        authenticatedAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    };
    const response = responseDouble();
    const next = vi.fn();

    requireRecentAuthentication(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "REAUTHENTICATION_REQUIRED",
      }),
    );
  });
});
