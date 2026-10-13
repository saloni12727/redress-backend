import { describe, expect, it } from "vitest";

import {
  resolveClientType,
  UntrustedOriginError,
} from "../src/utils/client-context.js";

describe("client origin classification", () => {
  it.each([
    "https://redress.cyberimpulses.com",
    "https://redressbackend.cyberimpulses.com",
    "http://localhost:4108",
    "http://127.0.0.1:3108",
  ])("classifies trusted browser origin %s as web", (origin) => {
    expect(resolveClientType({ get: () => origin })).toBe("web");
  });

  it("classifies requests without Origin as native", () => {
    expect(resolveClientType({ get: () => undefined })).toBe("native");
  });

  it("rejects browser origins outside the shared CORS policy", () => {
    expect(() =>
      resolveClientType({ get: () => "https://untrusted.example" }),
    ).toThrow(UntrustedOriginError);
  });
});
