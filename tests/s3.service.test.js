import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const s3Mocks = vi.hoisted(() => ({
  send: vi.fn(),
  clientConfigs: [],
}));

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    constructor(config) {
      s3Mocks.clientConfigs.push(config);
    }

    send(command) {
      return s3Mocks.send(command);
    }
  }

  class PutObjectCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class DeleteObjectCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class GetObjectCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class HeadBucketCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class HeadObjectCommand {
    constructor(input) {
      this.input = input;
    }
  }

  return {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
  };
});

import {
  assertS3Access,
  deleteObject,
  getObject,
  objectExists,
  uploadObject,
} from "../src/services/s3.service.js";

describe("central S3 service", () => {
  beforeEach(() => {
    s3Mocks.send.mockReset();
    s3Mocks.clientConfigs.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads encrypted objects without an ACL and uses private caching by default", async () => {
    s3Mocks.send.mockResolvedValue({
      ETag: '"etag-1"',
      $metadata: { httpStatusCode: 200 },
    });

    const result = await uploadObject({
      key: "profiles/account-1/photo.webp",
      buffer: Buffer.from("image"),
      contentType: "image/webp",
      metadata: { "account-id": "account-1" },
      expectedPrefix: "profiles",
    });

    const command = s3Mocks.send.mock.calls.at(-1)[0];
    expect(command.constructor.name).toBe("PutObjectCommand");
    expect(s3Mocks.send).toHaveBeenCalledOnce();
    expect(command.input).toMatchObject({
      Bucket: "redress-test-bucket",
      Key: "profiles/account-1/photo.webp",
      ContentType: "image/webp",
      CacheControl: "private, no-store",
      ServerSideEncryption: "AES256",
    });
    expect(command.input.ACL).toBeUndefined();
    expect(command.input.Metadata).toEqual({ "account-id": "account-1" });
    expect(result).toEqual({
      key: "profiles/account-1/photo.webp",
      bucketName: "redress-test-bucket",
      etag: '"etag-1"',
    });
    expect(s3Mocks.clientConfigs[0]).toMatchObject({
      region: "us-east-1",
      maxAttempts: 3,
    });
  });

  it("rejects unsafe keys, prefix escapes, and non-buffer upload bodies", async () => {
    await expect(
      uploadObject({
        key: "../private/file.webp",
        buffer: Buffer.from("image"),
      }),
    ).rejects.toThrow("S3 object key is invalid.");

    await expect(
      getObject("profiles-elsewhere/photo.webp", {
        expectedPrefix: "profiles",
      }),
    ).rejects.toThrow("S3 object key is invalid.");

    await expect(
      uploadObject({
        key: "profiles/photo.webp",
        buffer: "not a buffer",
      }),
    ).rejects.toThrow("Upload body must be a Buffer.");

    expect(s3Mocks.send).not.toHaveBeenCalled();
  });

  it("fetches validated objects through the server-side S3 client", async () => {
    const object = { Body: "stream" };
    s3Mocks.send.mockResolvedValue(object);

    await expect(getObject("products/item/main.webp")).resolves.toBe(object);

    expect(s3Mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: "redress-test-bucket",
          Key: "products/item/main.webp",
        },
      }),
    );
  });

  it("checks bucket access and deletes only validated object keys", async () => {
    s3Mocks.send.mockResolvedValue({});

    await expect(assertS3Access()).resolves.toBe(true);
    await expect(
      deleteObject("profiles/account-1/photo.webp", {
        expectedPrefix: "profiles/",
      }),
    ).resolves.toBe(true);

    expect(s3Mocks.send.mock.calls[0][0].input).toEqual({
      Bucket: "redress-test-bucket",
    });
    expect(s3Mocks.send.mock.calls[1][0].input).toEqual({
      Bucket: "redress-test-bucket",
      Key: "profiles/account-1/photo.webp",
    });
  });

  it("reports absent objects as false but rethrows other S3 failures", async () => {
    s3Mocks.send.mockRejectedValueOnce({
      name: "NotFound",
      $metadata: { httpStatusCode: 404 },
    });
    await expect(objectExists("products/missing.webp")).resolves.toBe(false);

    const failure = new Error("Access denied");
    s3Mocks.send.mockRejectedValueOnce(failure);
    await expect(objectExists("products/forbidden.webp")).rejects.toBe(failure);
  });
});
