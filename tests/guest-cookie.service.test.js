import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config/auth.config.js", () => ({
  getAuthConfig: () => ({
    guestCookieName: "redress_guest",
    cookieSecure: true,
    cookieSameSite: "none",
    guestTtlSeconds: 3600,
  }),
}));

vi.mock("../src/config/env.js", () => ({
  env: { API_PREFIX: "/api/v1/" },
}));

import {
  clearGuestCookie,
  setGuestCookie,
} from "../src/modules/guest/guest-cookie.service.js";

describe("guest cookie helpers", () => {
  it("clears the HttpOnly guest cookie with the same path and attributes", () => {
    const response = { clearCookie: vi.fn() };

    clearGuestCookie(response);

    expect(response.clearCookie).toHaveBeenCalledWith("redress_guest", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/api/v1",
    });
  });

  it("sets the web guest cookie as HttpOnly", () => {
    const response = { cookie: vi.fn() };

    setGuestCookie(response, "guest-token");

    expect(response.cookie).toHaveBeenCalledWith("redress_guest", "guest-token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/api/v1",
      maxAge: 3_600_000,
    });
  });
});
