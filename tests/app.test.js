import request from "supertest";

import { describe, expect, it } from "vitest";

import app from "../src/app.js";

import { env } from "../src/config/env.js";

describe("HTTP application", () => {
  /*
    |--------------------------------------------------------------------------
    | Health
    |--------------------------------------------------------------------------
    */

  it("returns a dependency-free liveness response", async () => {
    const response = await request(app).get(`${env.API_PREFIX}/health/live`);

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      success: true,

      status: "ok",

      service: env.APP_NAME,
    });

    expect(response.headers["x-request-id"]).toBe(response.body.requestId);
  });

  /*
    |--------------------------------------------------------------------------
    | Request ID
    |--------------------------------------------------------------------------
    */

  it("preserves a valid incoming request ID", async () => {
    const response = await request(app)
      .get(`${env.API_PREFIX}/missing`)
      .set("X-Request-Id", "test-request-123");

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "Route not found",
    });

    expect(response.headers["x-request-id"]).toBe("test-request-123");
  });

  /*
    |--------------------------------------------------------------------------
    | Invalid JSON
    |--------------------------------------------------------------------------
    */

  it("returns the stable invalid JSON contract", async () => {
    const response = await request(app)
      .post(`${env.API_PREFIX}/missing`)
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "Invalid JSON request body",
    });

    /*
     * Raw invalid request body must never
     * be returned in the API response.
     */
    expect(JSON.stringify(response.body)).not.toContain('body":"{');
  });

  /*
    |--------------------------------------------------------------------------
    | CORS
    |--------------------------------------------------------------------------
    */

  it("allows configured origins", async () => {
    const origin = env.CORS_ORIGINS[0];

    const response = await request(app)
      .get(`${env.API_PREFIX}/health/live`)
      .set("Origin", origin);

    expect(response.status).toBe(200);

    expect(response.headers["access-control-allow-origin"]).toBe(origin);

    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it.each([
    "http://localhost:4108",
    "http://127.0.0.1:4108",
    "https://localhost:3108",
    "https://127.0.0.1:3108",
    "https://redress.cyberimpulses.com",
    "https://redressbackend.cyberimpulses.com",
  ])("allows the trusted application origin %s", async (origin) => {
    const response = await request(app)
      .get(`${env.API_PREFIX}/health/live`)
      .set("Origin", origin);

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("answers credentialed preflight requests with the requested API headers", async () => {
    const response = await request(app)
      .options(`${env.API_PREFIX}/auth/login`)
      .set("Origin", "http://localhost:4108")
      .set("Access-Control-Request-Method", "POST")
      .set(
        "Access-Control-Request-Headers",
        "authorization,content-type,x-guest-token",
      );

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:4108",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
    expect(response.headers["access-control-allow-headers"]).toContain(
      "X-Guest-Token",
    );
  });

  it("rejects unconfigured origins", async () => {
    const response = await request(app)
      .get(`${env.API_PREFIX}/health/live`)
      .set("Origin", "https://untrusted.example");

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "Origin is not allowed",
    });
  });

  it("rejects preflight requests from unconfigured origins", async () => {
    const response = await request(app)
      .options(`${env.API_PREFIX}/auth/login`)
      .set("Origin", "https://untrusted.example")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "Origin is not allowed",
    });
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  /*
    |--------------------------------------------------------------------------
    | Localization
    |--------------------------------------------------------------------------
    */

  it("uses Italian when language is missing", async () => {
    const response = await request(app).get(`${env.API_PREFIX}/health/live`);

    expect(response.status).toBe(200);

    expect(response.headers["content-language"]).toBe("it");
  });

  it("normalizes English Accept-Language", async () => {
    const response = await request(app)
      .get(`${env.API_PREFIX}/health/live`)
      .set("Accept-Language", "en-US");

    expect(response.status).toBe(200);

    expect(response.headers["content-language"]).toBe("en");
  });

  it("allows the lang query to override Accept-Language", async () => {
    const response = await request(app)
      .get(`${env.API_PREFIX}/health/live?lang=it`)
      .set("Accept-Language", "en-US");

    expect(response.status).toBe(200);

    expect(response.headers["content-language"]).toBe("it");
  });
});
