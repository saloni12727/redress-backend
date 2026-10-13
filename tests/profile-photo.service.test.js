import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

const s3Storage = vi.hoisted(() => ({
  uploadObject: vi.fn(),
}));

vi.mock("../src/services/s3.service.js", () => s3Storage);

import {
  optimizeProfilePhoto,
  ProfilePhotoValidationError,
  uploadProfilePhoto,
} from "../src/services/profile-photo.service.js";

describe("profile photo processing", () => {
  it("validates, strips metadata and converts an image to WebP", async () => {
    const input = await sharp({
      create: {
        width: 512,
        height: 384,
        channels: 3,
        background: "#b91c1c",
      },
    })
      .png()
      .withMetadata({ comment: "must not survive" })
      .toBuffer();

    const result = await optimizeProfilePhoto({
      buffer: input,
      contentType: "image/png",
    });
    const metadata = await sharp(result.buffer).metadata();

    expect(result.contentType).toBe("image/webp");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(384);
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects a declared MIME type that does not match the decoded image", async () => {
    const input = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 3,
        background: "#111827",
      },
    })
      .png()
      .toBuffer();

    await expect(
      optimizeProfilePhoto({ buffer: input, contentType: "image/jpeg" }),
    ).rejects.toMatchObject({
      name: "ProfilePhotoValidationError",
      reason: "profile_photo_type_mismatch",
    });
  });

  it("detects a supported image when multipart reports a generic MIME type", async () => {
    const input = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 3,
        background: "#111827",
      },
    })
      .webp()
      .toBuffer();

    const result = await optimizeProfilePhoto({
      buffer: input,
      contentType: "application/octet-stream",
    });

    expect(result.contentType).toBe("image/webp");
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
  });

  it("rejects decoded image formats outside the profile policy", async () => {
    const input = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 3,
        background: "#111827",
      },
    })
      .tiff()
      .toBuffer();

    await expect(
      optimizeProfilePhoto({
        buffer: input,
        contentType: "image/tiff",
      }),
    ).rejects.toMatchObject({
      name: "ProfilePhotoValidationError",
      reason: "unsupported_profile_photo_type",
    });
  });

  it("rejects a claimed MIME type outside the profile policy", async () => {
    const input = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 3,
        background: "#111827",
      },
    })
      .png()
      .toBuffer();

    await expect(
      optimizeProfilePhoto({
        buffer: input,
        contentType: "image/x-png",
      }),
    ).rejects.toMatchObject({
      name: "ProfilePhotoValidationError",
      reason: "unsupported_profile_photo_type",
    });
  });

  it("rejects content that cannot be decoded as an image", async () => {
    await expect(
      optimizeProfilePhoto({
        buffer: Buffer.from("not an image"),
        contentType: "image/jpeg",
      }),
    ).rejects.toMatchObject({
      name: "ProfilePhotoValidationError",
      reason: "profile_photo_invalid",
    });
  });

  it("rejects images that are too small", async () => {
    const input = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: "#111827",
      },
    })
      .jpeg()
      .toBuffer();

    await expect(
      optimizeProfilePhoto({ buffer: input, contentType: "image/jpeg" }),
    ).rejects.toBeInstanceOf(ProfilePhotoValidationError);
  });

  it("stores the optimized photo through the centralized S3 service", async () => {
    s3Storage.uploadObject.mockResolvedValue({ etag: "etag-1" });
    const optimizedImage = {
      buffer: Buffer.from("optimized-webp"),
      contentType: "image/webp",
      width: 256,
      height: 192,
      sizeBytes: 1234,
    };

    await expect(
      uploadProfilePhoto({
        storageKey: "profiles/account-1/photo.webp",
        accountId: "account-1",
        optimizedImage,
      }),
    ).resolves.toEqual({ etag: "etag-1" });

    expect(s3Storage.uploadObject).toHaveBeenCalledWith({
      key: "profiles/account-1/photo.webp",
      expectedPrefix: "profiles",
      buffer: optimizedImage.buffer,
      contentType: "image/webp",
      contentDisposition: "inline",
      cacheControl: "private, max-age=300",
      serverSideEncryption: "AES256",
      metadata: {
        "account-id": "account-1",
        width: "256",
        height: "192",
      },
    });
  });
});
