import request from "supertest";

import { describe, expect, it } from "vitest";

import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("shopper fit route security", () => {
  it.each([
    ["get", "/body-profiles"],
    ["post", "/body-profiles"],
    ["put", "/body-profiles/self"],
    ["get", "/body-profiles/1"],
    ["patch", "/body-profiles/1"],
    ["delete", "/body-profiles/1"],
    ["post", "/body-profiles/1/estimate"],
    ["post", "/media"],
    ["post", "/shopper/fit-setup/skip"],
    ["post", "/fit/measurements/estimate"],
    ["post", "/auth/consent"],
  ])("requires standard Bearer authentication for %s %s", async (method, path) => {
    const response = await request(app)[method](`${env.API_PREFIX}${path}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "Authentication is required to access this resource.",
    });
  });
});
