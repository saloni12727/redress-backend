import { Readable } from "node:stream";

import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  getObject: vi.fn(),
}));

vi.mock("../src/services/s3.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getObject: storage.getObject,
}));

import app from "../src/app.js";
import { env } from "../src/config/env.js";
import { createMediaUrl } from "../src/services/media-url.service.js";

describe("opaque media delivery route", () => {
  beforeEach(() => {
    storage.getObject.mockReset();
  });

  it("streams the object with safe image headers and does not redirect to S3", async () => {
    storage.getObject.mockResolvedValue({
      Body: Readable.from(Buffer.from("webp image")),
      ContentType: "image/webp",
      ContentLength: 10,
      ETag: '"media-etag"',
    });

    const mediaUrl = new URL(createMediaUrl("profiles/7/photo.webp"));
    const response = await request(app).get(mediaUrl.pathname);

    expect(storage.getObject).toHaveBeenCalledWith("profiles/7/photo.webp");
    expect(response.status).toBe(200);
    expect(response.headers.location).toBeUndefined();
    expect(response.headers["content-type"]).toContain("image/webp");
    expect(response.headers["content-disposition"]).toBe("inline");
    expect(response.headers["cache-control"]).toBe("private, max-age=300");
    expect(response.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["content-length"]).toBe("10");
    expect(response.headers.etag).toBe('"media-etag"');
    expect(response.body).toEqual(Buffer.from("webp image"));
  });

  it("returns not found for invalid tokens without contacting S3", async () => {
    const response = await request(app).get(`${env.API_PREFIX}/media/not-a-token`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "Media object not found",
    });
    expect(storage.getObject).not.toHaveBeenCalled();
  });

  it("maps missing S3 objects to not found and provider failures to safe 503 responses", async () => {
    storage.getObject.mockRejectedValueOnce({
      name: "NoSuchKey",
      $metadata: { httpStatusCode: 404 },
    });
    const notFound = await request(app).get(
      new URL(createMediaUrl("profiles/7/missing.webp")).pathname,
    );
    expect(notFound.status).toBe(404);
    expect(notFound.body).toEqual({
      success: false,
      data: null,
      message: "Media object not found",
    });

    storage.getObject.mockRejectedValueOnce(
      Object.assign(new Error("bucket or credentials leaked"), {
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403, requestId: "request-1" },
      }),
    );
    const unavailable = await request(app).get(
      new URL(createMediaUrl("profiles/7/private.webp")).pathname,
    );
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toEqual({
      success: false,
      data: null,
      message: "An unexpected error occurred. Please try again later.",
    });
    expect(JSON.stringify(unavailable.body)).not.toContain("bucket");
    expect(JSON.stringify(unavailable.body)).not.toContain("credentials");
  });

  it("does not serve unsupported object content types", async () => {
    storage.getObject.mockResolvedValue({
      Body: Readable.from(Buffer.from("<script>bad</script>")),
      ContentType: "text/html",
    });

    const response = await request(app).get(
      new URL(createMediaUrl("profiles/7/photo.webp")).pathname,
    );

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "An unexpected error occurred. Please try again later.",
    });
    expect(response.headers["content-type"]).toContain("application/json");
  });
});
