import request from "supertest";

import { describe, expect, it } from "vitest";

import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("OpenAPI contract", () => {
  it("publishes every API route used by clients and operations", async () => {
    const response = await request(app).get(
      `${env.API_PREFIX}/docs/openapi.json`,
    );

    expect(response.status).toBe(200);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.paths).toEqual(
      expect.objectContaining({
        "/auth/login": expect.any(Object),
        "/auth/otp/send": expect.any(Object),
        "/auth/otp/verify": expect.any(Object),
        "/auth/signup": expect.any(Object),
        "/auth/google": expect.any(Object),
        "/auth/refresh": expect.any(Object),
        "/auth/logout": expect.any(Object),
        "/auth/logout-all": expect.any(Object),
        "/auth/me": expect.any(Object),
        "/auth/me/photo": expect.any(Object),
        "/auth/consent": expect.any(Object),
        "/media": expect.any(Object),
        "/media/{token}": expect.any(Object),
        "/body-profiles": expect.any(Object),
        "/body-profiles/self": expect.any(Object),
        "/body-profiles/{id}": expect.any(Object),
        "/body-profiles/{id}/estimate": expect.any(Object),
        "/shopper/fit-setup/skip": expect.any(Object),
        "/fit/measurements/estimate": expect.any(Object),
        "/content/policies/privacy": expect.any(Object),
        "/auth/forgot-password": expect.any(Object),
        "/auth/forgot-password/verify": expect.any(Object),
        "/auth/reset-password": expect.any(Object),
        "/auth/change-password": expect.any(Object),
        "/auth/set-password": expect.any(Object),
        "/auth/email/change/request": expect.any(Object),
        "/auth/email/change/verify": expect.any(Object),
        "/auth/phone/change/request": expect.any(Object),
        "/auth/phone/change/verify": expect.any(Object),
        "/auth/phone/verify": expect.any(Object),
        "/guest/sessions": expect.any(Object),
        "/health": expect.any(Object),
        "/health/live": expect.any(Object),
        "/health/ready": expect.any(Object),
        "/docs": expect.any(Object),
        "/docs/openapi.json": expect.any(Object),
        "/home/feed": expect.any(Object),
        "/admin/home/placements": expect.any(Object),
        "/admin/home/placements/{id}": expect.any(Object),
        "/admin/home/placements/{id}/publish": expect.any(Object),
        "/admin/home/placements/{id}/archive": expect.any(Object),
        "/admin/categories": expect.any(Object),
        "/admin/categories/{id}": expect.any(Object),
        "/admin/brands": expect.any(Object),
        "/admin/brands/{id}": expect.any(Object),
        "/admin/catalog/colors": expect.any(Object),
        "/admin/catalog/colors/{id}": expect.any(Object),
        "/admin/catalog/size-systems": expect.any(Object),
        "/admin/catalog/size-systems/{id}": expect.any(Object),
        "/admin/catalog/sizes": expect.any(Object),
        "/admin/catalog/sizes/{id}": expect.any(Object),
        "/admin/catalog/fit-profiles": expect.any(Object),
        "/admin/catalog/fit-profiles/{id}": expect.any(Object),
        "/admin/catalog/attributes": expect.any(Object),
        "/admin/catalog/attributes/{id}": expect.any(Object),
        "/admin/catalog/attribute-values": expect.any(Object),
        "/admin/catalog/attribute-values/{id}": expect.any(Object),
        "/admin/catalog/category-attributes": expect.any(Object),
        "/admin/catalog/category-attributes/{id}": expect.any(Object),
        "/admin/products/submissions": expect.any(Object),
        "/admin/products/{id}": expect.any(Object),
        "/admin/products/{id}/approve": expect.any(Object),
        "/admin/products/{id}/reject": expect.any(Object),
        "/admin/products/{id}/publish": expect.any(Object),
        "/admin/products/{id}/unpublish": expect.any(Object),
        "/admin/vendors/onboarding": expect.any(Object),
        "/admin/vendors/{id}": expect.any(Object),
        "/admin/vendors/{id}/approve": expect.any(Object),
        "/admin/vendors/{id}/reject": expect.any(Object),
        "/admin/vendors/{id}/status": expect.any(Object),
        "/vendor/products": expect.any(Object),
        "/vendor/products/{id}": expect.any(Object),
        "/vendor/products/{id}/categories": expect.any(Object),
        "/vendor/products/{id}/variants": expect.any(Object),
        "/vendor/products/{id}/variants/{variantId}": expect.any(Object),
        "/vendor/products/{id}/variants/{variantId}/inventory": expect.any(Object),
        "/vendor/products/{id}/size-chart": expect.any(Object),
        "/vendor/products/{id}/variants/{variantId}/size-chart": expect.any(Object),
        "/vendor/products/{id}/attributes": expect.any(Object),
        "/vendor/products/{id}/variants/{variantId}/attributes": expect.any(Object),
        "/vendor/products/{id}/media": expect.any(Object),
        "/vendor/products/{id}/media/{mediaId}": expect.any(Object),
        "/vendor/products/{id}/submit": expect.any(Object),
        "/vendor/onboarding": expect.any(Object),
        "/vendor/staff": expect.any(Object),
        "/vendor/staff/{staffId}": expect.any(Object),
        "/catalog/brands": expect.any(Object),
        "/catalog/categories": expect.any(Object),
        "/catalog/filters": expect.any(Object),
        "/catalog/products": expect.any(Object),
        "/catalog/products/{slug}": expect.any(Object),
        "/cart": expect.any(Object),
        "/cart/merge": expect.any(Object),
        "/orders/{id}/tracking": expect.any(Object),
        "/returns": expect.any(Object),
        "/returns/{id}": expect.any(Object),
        "/returns/{id}/cancel": expect.any(Object),
        "/wishlist": expect.any(Object),
        "/wishlist/{productId}": expect.any(Object),
      }),
    );
    expect(response.body.servers).toEqual([
      {
        url: env.API_PREFIX,
        description: "Current host",
      },
    ]);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("serves an interactive Swagger UI with locally hosted assets", async () => {
    const [page, config, stylesheet] = await Promise.all([
      request(app).get(`${env.API_PREFIX}/docs`),
      request(app).get(`${env.API_PREFIX}/docs/swagger-config.js`),
      request(app).get(`${env.API_PREFIX}/docs/assets/swagger-ui.css`),
    ]);

    expect(page.status).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.text).toContain(
      `${env.API_PREFIX}/docs/assets/swagger-ui-bundle.js`,
    );
    expect(page.text).toContain(`${env.API_PREFIX}/docs/swagger-config.js`);

    expect(config.status).toBe(200);
    expect(config.headers["content-type"]).toContain("application/javascript");
    expect(config.text).toContain(`${env.API_PREFIX}/docs/openapi.json`);

    expect(stylesheet.status).toBe(200);
    expect(stylesheet.headers["content-type"]).toContain("text/css");
    expect(stylesheet.headers["cache-control"]).toContain("immutable");
  });
});
