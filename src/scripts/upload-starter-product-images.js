import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";

/*
|--------------------------------------------------------------------------
| Load Environment
|--------------------------------------------------------------------------
|
| Your project uses environment-specific env files.
|
*/

const environment = process.env.NODE_ENV ?? "development";

dotenv.config({
  path: `.env.${environment}`,
});

dotenv.config();

const { assertS3Access } = await import("../services/s3.service.js");

const { uploadProductImage } = await import("../services/image.service.js");

/*
|--------------------------------------------------------------------------
| Starter Images
|--------------------------------------------------------------------------
*/

const STARTER_IMAGES = [
  {
    productCode: "RD-W-DRESS-001",

    slots: ["main", "gallery-01"],
  },

  {
    productCode: "RD-W-JEANS-001",

    slots: ["main", "gallery-01"],
  },

  {
    productCode: "RD-M-TSHIRT-001",

    slots: ["main", "gallery-01"],
  },

  {
    productCode: "RD-M-SHIRT-001",

    slots: ["main", "gallery-01"],
  },

  {
    productCode: "RD-G-DRESS-001",

    slots: ["main", "gallery-01"],
  },

  {
    productCode: "RD-W-HEEL-001",

    slots: ["main", "gallery-01"],
  },
];

const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

const ASSET_ROOT = path.resolve(process.cwd(), "assets", "starter-products");

/*
|--------------------------------------------------------------------------
| Find Local Image
|--------------------------------------------------------------------------
*/

async function findImageFile({ productCode, slot }) {
  const productDirectory = path.join(ASSET_ROOT, productCode);

  for (const extension of SUPPORTED_EXTENSIONS) {
    const filePath = path.join(productDirectory, `${slot}${extension}`);

    try {
      await fs.access(filePath);

      return filePath;
    } catch {
      /*
       * Try next extension.
       */
    }
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Validate All Images Before Upload
|--------------------------------------------------------------------------
|
| We validate first so that missing images don't cause a half-completed
| starter upload.
|
*/

async function collectImages() {
  const images = [];

  const missing = [];

  for (const product of STARTER_IMAGES) {
    for (const slot of product.slots) {
      const filePath = await findImageFile({
        productCode: product.productCode,

        slot,
      });

      if (!filePath) {
        missing.push(`${product.productCode}/${slot}`);

        continue;
      }

      images.push({
        productCode: product.productCode,

        slot,

        filePath,
      });
    }
  }

  if (missing.length > 0) {
    throw new Error(
      [
        "Starter images are missing:",
        "",
        ...missing.map((item) => `- ${item}`),
        "",
        `Expected folder: ${ASSET_ROOT}`,
      ].join("\n"),
    );
  }

  return images;
}

/*
|--------------------------------------------------------------------------
| Main
|--------------------------------------------------------------------------
*/

async function run() {
  console.log("Checking AWS S3 access...");

  await assertS3Access();

  console.log("AWS S3 access confirmed ✅");

  const images = await collectImages();

  console.log(`Found ${images.length} starter images.`);

  for (const image of images) {
    console.log(`Uploading ${image.productCode} / ${image.slot} ...`);

    const result = await uploadProductImage({
      filePath: image.filePath,

      productCode: image.productCode,

      slot: image.slot,
    });

    console.log({
      productCode: image.productCode,

      slot: image.slot,

      storageKey: result.storageKey,

      width: result.width,

      height: result.height,

      sizeKB: Math.round(result.sizeBytes / 1024),
    });
  }

  console.log("");

  console.log("All starter product images uploaded successfully ✅");
}

try {
  await run();
} catch (error) {
  console.error("");

  console.error("Starter product image upload failed ❌");

  console.error(error?.message ?? error);

  process.exitCode = 1;
}
