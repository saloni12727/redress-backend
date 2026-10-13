import { QueryTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Repair legacy demo product-media keys in production
|--------------------------------------------------------------------------
|
| This data repair deliberately lives in a migration, not a demo seeder.
| Demo seeders are blocked in production, while existing production demo
| records still need their media keys aligned with uploaded S3 objects.
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

function uploadedImageKey(productCode, slot) {
  return `products/${productCode.toLowerCase()}/${slot}.webp`;
}

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
              storageKey: uploadedImageKey(product.code, slot),
              now,
            },
            type: QueryTypes.UPDATE,
            transaction,
          },
        );
      }
    }

    /*
     * Do not expose a signed URL for legacy demo media that has no source
     * asset. The product remains public and its API image field becomes null.
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
  /* Do not restore references to non-existent objects. */
}
