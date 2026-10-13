import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("Admin brand routes", () => {
  it("requires authentication before every brand operation", async () => {
    const paths = [
      ["get", "/admin/brands"],
      ["post", "/admin/brands"],
      ["get", "/admin/brands/1"],
      ["patch", "/admin/brands/1"],
      ["delete", "/admin/brands/1"],
    ];

    const responses = await Promise.all(
      paths.map(([method, path]) =>
        request(app)[method](`${env.API_PREFIX}${path}`),
      ),
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
