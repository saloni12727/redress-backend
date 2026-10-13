import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  uploadProcessedImage: vi.fn(),
}));

vi.mock("../src/services/media/media-storage.service.js", () => state);

import {
  optimizeProductImage,
  uploadProductImage,
} from "../src/services/image.service.js";

const temporaryDirectories = [];

async function createStarterImage() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "redress-image-"));
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, "main.png");
  const buffer = await sharp({
    create: {
      width: 700,
      height: 500,
      channels: 3,
      background: "#0f766e",
    },
  })
    .png()
    .toBuffer();

  await fs.writeFile(filePath, buffer);
  return filePath;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe("starter product image service", () => {
  it("uses the canonical processor for a local starter image", async () => {
    const result = await optimizeProductImage(await createStarterImage());

    expect(result.mimeType).toBe("image/webp");
    expect(result.contentType).toBe("image/webp");
    expect(result.width).toBe(700);
    expect(result.height).toBe(500);
  });

  it("retains deterministic product-code and slot keys for starter uploads", async () => {
    state.uploadProcessedImage.mockResolvedValue({
      storageKey: "products/rd-w-dress-001/main.webp",
      contentType: "image/webp",
      width: 700,
      height: 500,
      sizeBytes: 1234,
      etag: "etag-1",
    });

    const result = await uploadProductImage({
      filePath: await createStarterImage(),
      productCode: "RD-W-DRESS-001",
      slot: "main",
    });

    expect(state.uploadProcessedImage).toHaveBeenCalledWith(
      expect.objectContaining({
        storageKey: "products/rd-w-dress-001/main.webp",
        cacheControl: "public, max-age=86400",
      }),
    );
    expect(result).toEqual({
      storageKey: "products/rd-w-dress-001/main.webp",
      width: 700,
      height: 500,
      sizeBytes: 1234,
      mimeType: "image/webp",
      etag: "etag-1",
    });
  });
});
