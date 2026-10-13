import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("Admin Home routes", () => {
  it("requires a valid admin session before any Home placement action", async () => {
    const paths = [
      ["get", "/admin/home/placements"],
      ["post", "/admin/home/placements"],
      ["get", "/admin/home/placements/1"],
      ["patch", "/admin/home/placements/1"],
      ["post", "/admin/home/placements/1/publish"],
      ["post", "/admin/home/placements/1/archive"],
      ["delete", "/admin/home/placements/1"],
    ];

    const responses = await Promise.all(
      paths.map(([method, path]) => request(app)[method](
        `${env.API_PREFIX}${path}`,
      )),
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
