import express from "express";
import request from "supertest";

import { describe, expect, it, vi } from "vitest";

import { createSmartRequestLogger } from "../src/middleware/smart-request-logger.js";

function createApp(log) {
  const app = express();

  app.use(express.json());
  app.use(createSmartRequestLogger({ log }));

  app.post("/api/v1/auth/signup", (request, response) => {
    return response.status(201).json({
      success: true,
      data: { id: 1 },
      message: "Account created successfully.",
    });
  });

  app.get("/api/v1/media/:token", (request, response) => {
    return response.status(200).json({
      success: true,
      data: null,
      message: "Media retrieved successfully.",
    });
  });

  app.post("/api/v1/auth/signup/invalid", (request, response) => {
    return response.status(400).json({
      success: false,
      data: null,
      message: "The request contains invalid fields.",
      errorCode: "VALIDATION",
      details: {
        fields: {
          consent: ["Required"],
        },
      },
    });
  });

  return app;
}

describe("smart request console logging", () => {
  it("writes one concise registration success line without logging the request body", async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const app = createApp(log);

    await request(app)
      .post("/api/v1/auth/signup")
      .send({ fullName: "Umesh", password: "never-log-this" })
      .expect(201);

    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining("Registration successful for Umesh."),
    );
    expect(JSON.stringify(log.info.mock.calls)).not.toContain("never-log-this");
  });

  it("suppresses successful media-request noise", async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const app = createApp(log);

    await request(app).get("/api/v1/media/private-capability").expect(200);

    expect(log.info).not.toHaveBeenCalled();
  });

  it("groups direct validation failures in a readable failure block", async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const app = createApp(log);

    await request(app).post("/api/v1/auth/signup/invalid").send({}).expect(400);

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("API REJECTED"),
    );

    expect(log.warn.mock.calls[0][0]).toContain("Fields : consent");
  });
});
