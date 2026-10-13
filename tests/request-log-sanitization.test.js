import { describe, expect, it } from "vitest";

import {
  serializeRequestForLog,
  serializeResponseForLog,
} from "../src/config/logger.js";

describe("request log sanitization", () => {
  it("redacts opaque media capabilities from logged request paths", () => {
    const serialized = serializeRequestForLog({
      id: "request-1",
      method: "GET",
      originalUrl: "/api/v1/media/secret-capability?download=1",
      headers: {},
      socket: {
        remoteAddress: "127.0.0.1",
        remotePort: 12345,
      },
    });

    expect(serialized.url).toBe(
      "/api/v1/media/[REDACTED]?download=1",
    );
    expect(JSON.stringify(serialized)).not.toContain("secret-capability");
  });

  it("keeps routine access logs compact and excludes request headers", () => {
    const serialized = serializeRequestForLog({
      id: "request-2",
      method: "POST",
      originalUrl: "/api/v1/auth/otp/send",
      headers: {
        authorization: "Bearer secret",
        "user-agent": "Flutter",
      },
      socket: {
        remoteAddress: "127.0.0.1",
        remotePort: 12345,
      },
    });

    expect(serialized).toEqual({
      id: "request-2",
      method: "POST",
      url: "/api/v1/auth/otp/send",
    });
  });

  it("logs only the response status for routine access entries", () => {
    expect(
      serializeResponseForLog({
        statusCode: 202,
        getHeaders: () => ({ "content-type": "application/json" }),
      }),
    ).toEqual({ statusCode: 202 });
  });
});
