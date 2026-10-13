import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("Vendor onboarding and staff routes", () => {
  it("requires authentication before every operation", async () => {
    const paths = [["post", "/vendor/onboarding"], ["get", "/vendor/onboarding"], ["patch", "/vendor/onboarding"], ["get", "/vendor/staff"], ["post", "/vendor/staff"], ["patch", "/vendor/staff/1"]];
    const responses = await Promise.all(paths.map(([method, path]) => request(app)[method](`${env.API_PREFIX}${path}`)));
    for (const response of responses) expect(response.body).toEqual({ success: false, data: null, message: "Authentication is required to access this resource." });
  });
});
