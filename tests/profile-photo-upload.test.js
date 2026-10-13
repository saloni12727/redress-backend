import express from "express";
import request from "supertest";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { profilePhotoUpload } from "../src/middleware/profile-photo-upload.js";
import { optimizeProfilePhoto } from "../src/services/profile-photo.service.js";

function createUploadApp() {
  const app = express();

  app.put("/photo", profilePhotoUpload, async (req, res, next) => {
    try {
      const optimized = await optimizeProfilePhoto(req.profilePhoto);
      return res.status(200).json({
        contentType: optimized.contentType,
        width: optimized.width,
        height: optimized.height,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, req, res, next) => {
    return res.status(error.statusCode ?? 500).json({
      reason: error.details?.reason ?? error.message,
    });
  });

  return app;
}

async function createWebpImage() {
  return sharp({
    create: {
      width: 256,
      height: 256,
      channels: 3,
      background: "#2563eb",
    },
  })
    .webp()
    .toBuffer();
}

describe("profile photo upload middleware", () => {
  it("reports a missing file when the request sends no body", async () => {
    const response = await request(createUploadApp())
      .put("/photo")
      .set("Content-Length", "0");

    expect(response.status).toBe(422);
    expect(response.body.reason).toBe("profile_photo_required");
  });

  it("passes generic multipart MIME through to content-based validation", async () => {
    const response = await request(createUploadApp())
      .put("/photo")
      .attach("image", await createWebpImage(), {
        filename: "profile.webp",
        contentType: "application/octet-stream",
      })
      .field("note", "profile upload");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      contentType: "image/webp",
      width: 256,
      height: 256,
    });
  });

  it("passes raw image bytes with a generic MIME type to content validation", async () => {
    const response = await request(createUploadApp())
      .put("/photo")
      .set("Content-Type", "application/octet-stream")
      .send(await createWebpImage());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      contentType: "image/webp",
      width: 256,
      height: 256,
    });
  });
});
