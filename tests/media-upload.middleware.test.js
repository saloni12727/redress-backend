import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createImageUploadMiddleware } from "../src/middleware/media-upload.middleware.js";

const singlePolicy = {
  fieldName: "image",
  maxFiles: 1,
  maxBytes: 512,
  maxTotalBytes: 512,
  acceptedClaimedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
};

const multiplePolicy = {
  ...singlePolicy,
  fieldName: "images",
  maxFiles: 2,
  maxTotalBytes: 768,
};

function createUploadApp() {
  const app = express();

  app.put(
    "/single",
    createImageUploadMiddleware(singlePolicy),
    (request, response) =>
      response.status(200).json({
        name: request.mediaFile.originalName,
        mimeType: request.mediaFile.claimedMimeType,
        sizeBytes: request.mediaFile.sizeBytes,
      }),
  );

  app.put(
    "/multiple",
    createImageUploadMiddleware(multiplePolicy, { mode: "array" }),
    (request, response) =>
      response.status(200).json({
        count: request.mediaFiles.length,
      }),
  );

  app.put(
    "/wide-field",
    createImageUploadMiddleware(singlePolicy, { maxFieldBytes: 2 * 1024 }),
    (request, response) =>
      response.status(200).json({ noteLength: request.body.note.length }),
  );

  app.use((error, request, response, next) =>
    response.status(error.statusCode ?? 500).json({
      reason: error.details?.reason ?? error.message,
    }),
  );

  return app;
}

describe("reusable media upload middleware", () => {
  it("accepts the configured single file field and normalizes it", async () => {
    const response = await request(createUploadApp())
      .put("/single")
      .attach("image", Buffer.from("jpeg bytes"), {
        filename: "Avatar.JPG",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      name: "Avatar.JPG",
      mimeType: "image/jpeg",
      sizeBytes: 10,
    });
  });

  it("rejects a missing file and an unexpected file field", async () => {
    const app = createUploadApp();

    const missing = await request(app)
      .put("/single")
      .field("note", "no image attached");
    const wrongField = await request(app)
      .put("/single")
      .attach("photo", Buffer.from("jpeg bytes"), {
        filename: "avatar.jpg",
        contentType: "image/jpeg",
      });

    expect(missing.status).toBe(422);
    expect(missing.body.reason).toBe("media_file_required");
    expect(wrongField.status).toBe(422);
    expect(wrongField.body.reason).toBe("invalid_media_field");
  });

  it("rejects unsupported MIME claims before expensive image processing", async () => {
    const response = await request(createUploadApp())
      .put("/single")
      .attach("image", Buffer.from("plain text"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(422);
    expect(response.body.reason).toBe("unsupported_media_type");
  });

  it("enforces a per-file byte limit", async () => {
    const response = await request(createUploadApp())
      .put("/single")
      .attach("image", Buffer.alloc(513), {
        filename: "large.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(413);
    expect(response.body.reason).toBe("media_file_too_large");
  });

  it("enforces an array file-count limit", async () => {
    const response = await request(createUploadApp())
      .put("/multiple")
      .attach("images", Buffer.from("one"), {
        filename: "one.jpg",
        contentType: "image/jpeg",
      })
      .attach("images", Buffer.from("two"), {
        filename: "two.jpg",
        contentType: "image/jpeg",
      })
      .attach("images", Buffer.from("three"), {
        filename: "three.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(422);
    expect(response.body.reason).toBe("too_many_media_files");
  });

  it("allows a route to raise its bounded multipart text-field limit", async () => {
    const response = await request(createUploadApp())
      .put("/wide-field")
      .field("note", "a".repeat(1500))
      .attach("image", Buffer.from("jpeg bytes"), {
        filename: "banner.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ noteLength: 1500 });
  });
});
