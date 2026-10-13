import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("Vendor product routes", () => {
  it("requires authentication before every product operation", async () => {
    const paths = [
      ["get", "/vendor/products"], ["post", "/vendor/products"], ["get", "/vendor/products/1"], ["patch", "/vendor/products/1"], ["delete", "/vendor/products/1"],
      ["put", "/vendor/products/1/categories"], ["post", "/vendor/products/1/variants"], ["patch", "/vendor/products/1/variants/2"], ["delete", "/vendor/products/1/variants/2"],
      ["patch", "/vendor/products/1/variants/2/inventory"], ["get", "/vendor/products/1/size-chart"], ["put", "/vendor/products/1/variants/2/size-chart"],
      ["get", "/vendor/products/1/attributes"], ["put", "/vendor/products/1/attributes"], ["put", "/vendor/products/1/variants/2/attributes"],
      ["post", "/vendor/products/1/media"], ["patch", "/vendor/products/1/media/2"], ["delete", "/vendor/products/1/media/2"], ["post", "/vendor/products/1/submit"],
    ];
    const responses = await Promise.all(paths.map(([method, path]) => request(app)[method](`${env.API_PREFIX}${path}`)));
    for (const response of responses) expect(response.body).toEqual({ success: false, data: null, message: "Authentication is required to access this resource." });
  });
});
