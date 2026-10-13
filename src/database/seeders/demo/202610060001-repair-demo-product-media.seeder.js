import { QueryTypes } from "sequelize";

import { buildProductImageKey } from "../../../services/s3.service.js";

/*
|--------------------------------------------------------------------------
| Repair legacy demo product-media keys
|--------------------------------------------------------------------------
|
| The original demo seeder stored media under `demo/products/<slug>/...`,
| while the image uploader stores the available assets under the deterministic
| product keys returned by buildProductImageKey(). This one-time seeder repairs
| existing demo data without touching product media uploaded by vendors or
| administrators.
|
*/

const PRODUCTS_WITH_UPLOADED_IMAGES = [
  { code: "RD-W-DRESS-001", slug: "floral-midi-dress" },
  { code: "RD-W-JEANS-001", slug: "women-straight-fit-jeans" },
  { code: "RD-W-HEEL-001", slug: "classic-block-heels" },
  { code: "RD-M-TSHIRT-001", slug: "premium-cotton-tshirt" },
  { code: "RD-M-SHIRT-001", slug: "oxford-formal-shirt" },
  { code: "RD-G-DRESS-001", slug: "girls-party-dress" },
];

const PRODUCTS_WITHOUT_UPLOADED_IMAGES = [
  "RD-W-TOP-001",
  "RD-M-JEANS-001",
  "RD-M-SHOE-001",
  "RD-B-TSHIRT-001",
  "RD-W-SKIRT-001",
  "RD-M-JACKET-001",
];

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const now = new Date();

    for (const product of PRODUCTS_WITH_UPLOADED_IMAGES) {
      for (const slot of ["main", "gallery-01"]) {
        await queryInterface.sequelize.query(
          `
            UPDATE product_media media
            INNER JOIN products product ON product.id = media.product_id
            SET
              media.storage_key = :storageKey,
              media.updated_at = :now
            WHERE product.code = :productCode
              AND media.storage_key = :legacyStorageKey
              AND media.deleted_at IS NULL
          `,
          {
            replacements: {
              productCode: product.code,
              legacyStorageKey: `demo/products/${product.slug}/${slot}.webp`,
              storageKey: buildProductImageKey(product.code, slot),
              now,
            },
            type: QueryTypes.UPDATE,
            transaction,
          },
        );
      }
    }

    /*
     * Older demo rows for products without a supplied local image point to
     * non-existent `demo/products/...` S3 objects. Keep those records for
     * auditability, but stop exposing them as approved public media.
     */
    await queryInterface.sequelize.query(
      `
        UPDATE product_media media
        INNER JOIN products product ON product.id = media.product_id
        SET
          media.moderation_status = 'pending',
          media.approved_at = NULL,
          media.updated_at = :now
        WHERE product.code IN (:productCodes)
          AND media.storage_key LIKE 'demo/products/%'
          AND media.deleted_at IS NULL
      `,
      {
        replacements: {
          productCodes: PRODUCTS_WITHOUT_UPLOADED_IMAGES,
          now,
        },
        type: QueryTypes.UPDATE,
        transaction,
      },
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down() {
  /*
   * This repair is intentionally not reversed: reverting it would restore
   * references to S3 objects that do not exist.
   */
}
