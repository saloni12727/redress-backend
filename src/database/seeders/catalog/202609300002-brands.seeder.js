import { Op, QueryTypes } from "sequelize";

const BRANDS = [
  {
    code: "redress_essentials",

    name: "Redress Essentials",

    slug: "redress-essentials",
  },

  {
    code: "urban_loom",

    name: "Urban Loom",

    slug: "urban-loom",
  },

  {
    code: "modaviva",

    name: "ModaViva",

    slug: "modaviva",
  },

  {
    code: "north_thread",

    name: "North Thread",

    slug: "north-thread",
  },

  {
    code: "velora",

    name: "Velora",

    slug: "velora",
  },

  {
    code: "atelier_nova",

    name: "Atelier Nova",

    slug: "atelier-nova",
  },
];

const BRAND_CODES = BRANDS.map((brand) => brand.code);

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const existing = await queryInterface.sequelize.query(
      `
          SELECT code
          FROM brands
          WHERE code IN (:codes)
        `,
      {
        replacements: {
          codes: BRAND_CODES,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const existingCodes = new Set(existing.map((brand) => brand.code));

    const now = new Date();

    const rows = BRANDS.filter((brand) => !existingCodes.has(brand.code)).map(
      (brand) => ({
        ...brand,

        logo_key: null,

        website_url: null,

        is_active: true,

        created_at: now,

        updated_at: now,

        deleted_at: null,
      }),
    );

    if (rows.length > 0) {
      await queryInterface.bulkInsert("brands", rows, {
        transaction,
      });
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}

export async function down({ context: queryInterface }) {
  await queryInterface.bulkDelete("brands", {
    code: {
      [Op.in]: BRAND_CODES,
    },
  });
}
