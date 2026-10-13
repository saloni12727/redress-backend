import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { getImageUploadPolicy } from "../src/config/media.config.js";
import {
  MediaValidationError,
  processImage,
} from "../src/services/media/image-processor.service.js";

async function createImage({ format, width = 640, height = 480 }) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#1d4ed8",
    },
  })[format]().toBuffer();
}

async function createAnimatedWebp() {
  const firstFrame = await createImage({ format: "png" });
  const secondFrame = await sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: "#be123c",
    },
  })
    .png()
    .toBuffer();

  return sharp([firstFrame, secondFrame], {
    join: {
      animated: true,
    },
  })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
}

describe("canonical image processor", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ])("decodes a real %s and outputs optimized WebP", async (format, mimeType) => {
    const result = await processImage({
      buffer: await createImage({ format }),
      claimedMimeType: mimeType,
      policy: "profile",
    });
    const metadata = await sharp(result.buffer).metadata();

    expect(result.contentType).toBe("image/webp");
    expect(result.extension).toBe("webp");
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(metadata.format).toBe("webp");
  });

  it("rejects empty, corrupt, and falsely-claimed image data", async () => {
    await expect(
      processImage({
        buffer: Buffer.alloc(0),
        claimedMimeType: "image/jpeg",
        policy: "profile",
      }),
    ).rejects.toMatchObject({ reason: "media_file_required" });

    await expect(
      processImage({
        buffer: Buffer.from("not an image"),
        claimedMimeType: "image/jpeg",
        policy: "profile",
      }),
    ).rejects.toMatchObject({ reason: "invalid_media_file" });

    await expect(
      processImage({
        buffer: await createImage({ format: "png" }),
        claimedMimeType: "image/jpeg",
        policy: "profile",
      }),
    ).rejects.toMatchObject({ reason: "media_type_mismatch" });
  });

  it("rejects images below policy dimensions and animated media", async () => {
    await expect(
      processImage({
        buffer: await createImage({ format: "jpeg", width: 127, height: 128 }),
        claimedMimeType: "image/jpeg",
        policy: "profile",
      }),
    ).rejects.toMatchObject({ reason: "media_dimensions_too_small" });

    await expect(
      processImage({
        buffer: await createAnimatedWebp(),
        claimedMimeType: "image/webp",
        policy: "profile",
      }),
    ).rejects.toMatchObject({ reason: "animated_media_not_allowed" });
  });

  it("preserves aspect ratio and never enlarges a valid image", async () => {
    const profileResult = await processImage({
      buffer: await createImage({ format: "png", width: 800, height: 400 }),
      claimedMimeType: "image/png",
      policy: getImageUploadPolicy("profile"),
    });
    const productResult = await processImage({
      buffer: await createImage({ format: "jpeg", width: 2000, height: 1000 }),
      claimedMimeType: "image/jpeg",
      policy: "product",
    });

    expect(profileResult.width).toBe(800);
    expect(profileResult.height).toBe(400);
    expect(productResult.width).toBe(1600);
    expect(productResult.height).toBe(800);
  });

  it("accepts and optimizes Home placement artwork for its S3 namespace", async () => {
    const result = await processImage({
      buffer: await createImage({
        format: "jpeg",
        width: 1600,
        height: 900,
      }),
      claimedMimeType: "image/jpeg",
      policy: "homePlacement",
    });

    expect(result.contentType).toBe("image/webp");
    expect(result.width).toBe(1600);
    expect(result.height).toBe(900);
    expect((await sharp(result.buffer).metadata()).format).toBe("webp");

    const portrait = await processImage({
      buffer: await createImage({
        format: "jpeg",
        width: 1200,
        height: 1600,
      }),
      claimedMimeType: "image/jpeg",
      policy: "homePlacement",
    });

    expect(portrait.width).toBe(1200);
    expect(portrait.height).toBe(1600);
    expect((await sharp(portrait.buffer).metadata()).format).toBe("webp");
  });

  it("uses a dedicated validation error type", () => {
    const error = new MediaValidationError("invalid_media_file");

    expect(error).toBeInstanceOf(MediaValidationError);
    expect(error.reason).toBe("invalid_media_file");
  });
});
