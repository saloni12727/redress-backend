import request from "supertest";

import { describe, expect, it } from "vitest";

import app from "../src/app.js";

import { env } from "../src/config/env.js";

describe("auth route security contract", () => {
  it("requires Bearer authentication for phone_link OTP", async () => {
    const response = await request(app)
      .post(`${env.API_PREFIX}/auth/otp/send`)
      .send({
        purpose: "phone_link",

        channel: "sms",

        phone: "+393331234567",
      });

    expect(response.status).toBe(401);

    expect(response.body).toMatchObject({
      errorCode: "SESSION_CLOSED",

      details: {
        reason: "missing_token",
      },
    });
  });

  it("does not expose password_reset through generic OTP API", async () => {
    const response = await request(app)
      .post(`${env.API_PREFIX}/auth/otp/send`)
      .send({
        purpose: "password_reset",

        channel: "email",

        email: "ada@example.com",
      });

    expect(response.status).toBe(400);

    expect(response.body.errorCode).toBe("VALIDATION");
  });

  it("validates Google ID-token input before authentication", async () => {
    const response = await request(app)
      .post(`${env.API_PREFIX}/auth/google`)
      .send({
        idToken: "not-a-valid-token",
      });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe("VALIDATION");
  });

  it.each([
    ["put", "/auth/me/photo"],
    ["delete", "/auth/me/photo"],
  ])("requires authentication for %s %s", async (method, path) => {
    const response = await request(app)[method](`${env.API_PREFIX}${path}`);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      data: null,
      message: expect.any(String),
    });
  });

  it.each([
    ["/auth/email/change/request", { newEmail: "new@example.com" }],
    [
      "/auth/email/change/verify",
      { newEmail: "new@example.com", otp: "123456" },
    ],
    ["/auth/phone/change/request", { newPhone: "+393331234567" }],
    [
      "/auth/phone/change/verify",
      { newPhone: "+393331234567", otp: "123456" },
    ],
  ])("requires authentication for %s", async (path, body) => {
    const response = await request(app)
      .post(`${env.API_PREFIX}${path}`)
      .send(body);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      errorCode: "SESSION_CLOSED",
      details: { reason: "missing_token" },
    });
  });
});
