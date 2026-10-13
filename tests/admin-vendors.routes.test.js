import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("Admin vendor approval routes", () => {
  it("requires authentication before every vendor review operation", async () => {
    const paths = [
      ["get", "/admin/vendors/onboarding"],
      ["get", "/admin/vendors/1"],
      ["post", "/admin/vendors/1/approve"],
      ["post", "/admin/vendors/1/reject"],
      ["patch", "/admin/vendors/1/status"],
    ];

    const responses = await Promise.all(
      paths.map(([method, path]) => request(app)[method](`${env.API_PREFIX}${path}`)),
    );

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        data: null,
        message: "Authentication is required to access this resource.",
      });
    }
  });
});
