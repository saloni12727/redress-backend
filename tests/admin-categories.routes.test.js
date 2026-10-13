import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("Admin category routes", () => {
  it("requires a valid admin session before every category operation", async () => {
    const paths = [
      ["get", "/admin/categories"],
      ["post", "/admin/categories"],
      ["get", "/admin/categories/1"],
      ["patch", "/admin/categories/1"],
      ["delete", "/admin/categories/1"],
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
