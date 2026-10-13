import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("Admin catalog routes", () => {
  it("requires authentication before every catalog master-data operation", async () => {
    const resources = [
      "colors",
      "size-systems",
      "sizes",
      "fit-profiles",
      "attributes",
      "attribute-values",
      "category-attributes",
    ];
    const paths = resources.flatMap((resource) => [
      ["get", `/admin/catalog/${resource}`],
      ["post", `/admin/catalog/${resource}`],
      ["get", `/admin/catalog/${resource}/1`],
      ["patch", `/admin/catalog/${resource}/1`],
      ["delete", `/admin/catalog/${resource}/1`],
    ]);

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
