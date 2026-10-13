import { describe, expect, it } from "vitest";

import { isAllowedCorsOrigin } from "../src/config/cors.config.js";

const baseConfiguration = {
  CORS_ORIGINS: ["https://admin.example.com"],
};

describe("CORS origin policy", () => {
  it("allows configured origins and the deployed Redress web/API origins", () => {
    expect(
      isAllowedCorsOrigin("https://admin.example.com", {
        ...baseConfiguration,
        NODE_ENV: "production",
      }),
    ).toBe(true);
    expect(
      isAllowedCorsOrigin("https://redress.cyberimpulses.com", {
        ...baseConfiguration,
        NODE_ENV: "production",
      }),
    ).toBe(true);
    expect(
      isAllowedCorsOrigin("https://redressbackend.cyberimpulses.com", {
        ...baseConfiguration,
        NODE_ENV: "production",
      }),
    ).toBe(true);
  });

  it("allows loopback hosts and arbitrary development ports only outside production", () => {
    for (const origin of [
      "http://localhost:4108",
      "http://127.0.0.1:3108",
      "https://localhost:5173",
      "http://[::1]:8080",
    ]) {
      expect(
        isAllowedCorsOrigin(origin, {
          ...baseConfiguration,
          NODE_ENV: "development",
        }),
      ).toBe(true);
    }

    expect(
      isAllowedCorsOrigin("http://localhost:4108", {
        ...baseConfiguration,
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });

  it("rejects arbitrary origins and malformed origin values", () => {
    for (const origin of [
      "https://evil.example",
      "https://redress.cyberimpulses.com.evil.example",
      "null",
      "https://user@redress.cyberimpulses.com",
      "https://redress.cyberimpulses.com/path",
    ]) {
      expect(
        isAllowedCorsOrigin(origin, {
          ...baseConfiguration,
          NODE_ENV: "production",
        }),
      ).toBe(false);
    }
  });
});
