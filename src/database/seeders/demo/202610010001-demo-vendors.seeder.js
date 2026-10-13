import { Op, QueryTypes } from "sequelize";

const VENDORS = [
  {
    code: "redress_demo_store",

    slug: "redress-demo-store",

    display_name: "Redress Demo Store",

    legal_name: "Redress Demo Store",

    email: "demo-store@redress.example",

    phone: null,

    status: "active",

    approval_status: "approved",

    commission_type: "percentage",

    commission_value: "12.00",

    default_currency_code: "EUR",

    country_code: "IT",

    tax_identifier: null,

    registration_number: null,

    website_url: null,

    logo_key: null,
  },

  {
    code: "modaviva_official",

    slug: "modaviva-official",

    display_name: "ModaViva Official",

    legal_name: "ModaViva Fashion",

    email: "modaviva@redress.example",

    phone: null,

    status: "active",

    approval_status: "approved",

    commission_type: "percentage",

    commission_value: "10.00",

    default_currency_code: "EUR",

    country_code: "IT",

    tax_identifier: null,

    registration_number: null,

    website_url: null,

    logo_key: null,
  },
];

const VENDOR_CODES = VENDORS.map((vendor) => vendor.code);

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const existing = await queryInterface.sequelize.query(
      `
          SELECT code
          FROM vendors
          WHERE code IN (:codes)
        `,
      {
        replacements: {
          codes: VENDOR_CODES,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const existingCodes = new Set(existing.map((row) => row.code));

    const now = new Date();

    const rows = VENDORS.filter(
      (vendor) => !existingCodes.has(vendor.code),
    ).map((vendor) => ({
      ...vendor,

      approved_at: now,
      suspended_at: null,

      created_at: now,
      updated_at: now,
      deleted_at: null,
    }));

    if (rows.length > 0) {
      await queryInterface.bulkInsert("vendors", rows, {
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
  await queryInterface.bulkDelete("vendors", {
    code: {
      [Op.in]: VENDOR_CODES,
    },
  });
}
