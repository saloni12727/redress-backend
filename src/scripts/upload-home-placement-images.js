import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const assetsDirectory = path.join(projectRoot, "assets", "home-placement");
const environmentArgument = process.argv.find((argument) =>
  argument.startsWith("--environment="),
);
const environment = environmentArgument?.slice("--environment=".length);

if (!new Set(["development", "test"]).has(environment)) {
  throw new Error(
    "Use --environment=development or --environment=test. Home test assets cannot be uploaded to production.",
  );
}

const environmentFile = path.join(projectRoot, `.env.${environment}`);
if (!(await fs.stat(environmentFile).catch(() => null))?.isFile()) {
  throw new Error(`Home image upload requires ${environmentFile}.`);
}

const dotenvResult = dotenv.config({
  path: environmentFile,
  override: true,
  quiet: true,
});

if (dotenvResult.error) {
  throw new Error(
    `Unable to load the ${environment} environment file: ${dotenvResult.error.message}`,
  );
}

process.env.NODE_ENV = environment;

const IMAGES = [
  {
    fileName: "banner-women.jpg",
    storageKey: "home/banners/test-women.webp",
    sectionKey: "hero",
  },
  {
    fileName: "banner-men.jpg",
    storageKey: "home/banners/test-men.webp",
    sectionKey: "hero",
  },
  {
    fileName: "brand-modaviva.jpg",
    storageKey: "home/brands/test-modaviva.webp",
    sectionKey: "top_brand",
  },
  {
    fileName: "brand-velora.jpg",
    storageKey: "home/brands/test-velora.webp",
    sectionKey: "top_brand",
  },
  {
    fileName: "brand-redress-essentials.jpg",
    storageKey: "home/brands/test-redress-essentials.webp",
    sectionKey: "top_brand",
  },
  {
    fileName: "brand-urban-loom.jpg",
    storageKey: "home/brands/test-urban-loom.webp",
    sectionKey: "top_brand",
  },
  {
    fileName: "brand-north-thread.jpg",
    storageKey: "home/brands/test-north-thread.webp",
    sectionKey: "top_brand",
  },
  {
    fileName: "brand-atelier-nova.jpg",
    storageKey: "home/brands/test-atelier-nova.webp",
    sectionKey: "top_brand",
  },
  {
    fileName: "category-women.jpg",
    storageKey: "home/audience/test-women.webp",
    sectionKey: "audience",
  },
  {
    fileName: "category-men.jpg",
    storageKey: "home/audience/test-men.webp",
    sectionKey: "audience",
  },
  {
    fileName: "category-kids.jpg",
    storageKey: "home/audience/test-kids.webp",
    sectionKey: "audience",
  },
  {
    fileName: "lookbook-women.jpg",
    storageKey: "home/lookbook/test-women.webp",
    sectionKey: "lookbook",
  },
  {
    fileName: "lookbook-men.jpg",
    storageKey: "home/lookbook/test-men.webp",
    sectionKey: "lookbook",
  },
  {
    fileName: "offer-weekend.jpg",
    storageKey: "home/offers/test-weekend.webp",
    sectionKey: "offer",
  },
  {
    fileName: "offer-daily.jpg",
    storageKey: "home/offers/test-daily.webp",
    sectionKey: "offer",
  },
  {
    fileName: "banner-women.jpg",
    storageKey: "home/promotion/test-style-studio.webp",
    sectionKey: "promotion",
  },
];

async function run() {
  const [{ assertS3Access }, { getImageUploadPolicy }, { processImage }, { uploadProcessedImage }, { HOME_IMAGE_RULES }] =
    await Promise.all([
      import("../services/s3.service.js"),
      import("../config/media.config.js"),
      import("../services/media/image-processor.service.js"),
      import("../services/media/media-storage.service.js"),
      import("../modules/admin-home/admin-home.constants.js"),
    ]);
  const policy = getImageUploadPolicy("homePlacement");
  const uploads = [];

  for (const image of IMAGES) {
    const filePath = path.join(assetsDirectory, image.fileName);
    const rule = HOME_IMAGE_RULES[image.sectionKey];
    const buffer = await sharp(await fs.readFile(filePath))
      .rotate()
      .resize({
        width: rule.width,
        height: rule.height,
        fit: "cover",
        position: "attention",
      })
      .jpeg({ quality: 90 })
      .toBuffer();
    const processedImage = await processImage({
      buffer,
      claimedMimeType: "image/jpeg",
      policy,
    });

    uploads.push({ ...image, processedImage });
  }

  await assertS3Access();

  for (const { fileName, storageKey, sectionKey, processedImage } of uploads) {
    const result = await uploadProcessedImage({
      processedImage,
      storageKey,
      cacheControl: "private, max-age=300",
      metadata: {
        "asset-source": "unsplash",
        "home-placement-asset": fileName.replace(/\.jpg$/, ""),
        "section-key": sectionKey,
      },
    });

    console.log(
      `${fileName} -> ${result.storageKey} (${result.width}x${result.height}, ${result.sizeBytes} bytes)`,
    );
  }

  console.log(`Uploaded ${uploads.length} Home placement images to the ${environment} S3 bucket.`);
}

run().catch((error) => {
  console.error("Home placement image upload failed:", error?.message ?? error);
  process.exitCode = 1;
});
