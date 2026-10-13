import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("Admin product approval routes", () => {
  it("requires authentication before every approval operation", async () => {
    const paths = [["get", "/admin/products/submissions"], ["get", "/admin/products/1"], ["post", "/admin/products/1/approve"], ["post", "/admin/products/1/reject"], ["post", "/admin/products/1/publish"], ["post", "/admin/products/1/unpublish"]];
    const responses = await Promise.all(paths.map(([method, path]) => request(app)[method](`${env.API_PREFIX}${path}`)));
    for (const response of responses) expect(response.body).toEqual({ success: false, data: null, message: "Authentication is required to access this resource." });
  });
});
