import { Op, QueryTypes } from "sequelize";

const MEASUREMENT_TYPES = [
  {
    code: "chest_circumference",
    name_en: "Chest Circumference",
    name_it: "Circonferenza Torace",
    body_region: "chest",
    measurement_kind: "circumference",
  },

  {
    code: "bust_circumference",
    name_en: "Bust Circumference",
    name_it: "Circonferenza Seno",
    body_region: "bust",
    measurement_kind: "circumference",
  },

  {
    code: "waist_circumference",
    name_en: "Waist Circumference",
    name_it: "Circonferenza Vita",
    body_region: "waist",
    measurement_kind: "circumference",
  },

  {
    code: "hip_circumference",
    name_en: "Hip Circumference",
    name_it: "Circonferenza Fianchi",
    body_region: "hip",
    measurement_kind: "circumference",
  },

  {
    code: "shoulder_width",
    name_en: "Shoulder Width",
    name_it: "Larghezza Spalle",
    body_region: "shoulder",
    measurement_kind: "width",
  },

  {
    code: "sleeve_length",
    name_en: "Sleeve Length",
    name_it: "Lunghezza Manica",
    body_region: "arm",
    measurement_kind: "length",
  },

  {
    code: "garment_length",
    name_en: "Garment Length",
    name_it: "Lunghezza Capo",
    body_region: "body",
    measurement_kind: "length",
  },

  {
    code: "neck_circumference",
    name_en: "Neck Circumference",
    name_it: "Circonferenza Collo",
    body_region: "neck",
    measurement_kind: "circumference",
  },

  {
    code: "bicep_circumference",
    name_en: "Bicep Circumference",
    name_it: "Circonferenza Bicipite",
    body_region: "arm",
    measurement_kind: "circumference",
  },

  {
    code: "thigh_circumference",
    name_en: "Thigh Circumference",
    name_it: "Circonferenza Coscia",
    body_region: "leg",
    measurement_kind: "circumference",
  },

  {
    code: "inseam_length",
    name_en: "Inseam Length",
    name_it: "Lunghezza Interna Gamba",
    body_region: "leg",
    measurement_kind: "length",
  },

  {
    code: "outseam_length",
    name_en: "Outseam Length",
    name_it: "Lunghezza Esterna Gamba",
    body_region: "leg",
    measurement_kind: "length",
  },

  {
    code: "front_rise",
    name_en: "Front Rise",
    name_it: "Altezza Cavallo Anteriore",
    body_region: "waist",
    measurement_kind: "length",
  },

  {
    code: "back_rise",
    name_en: "Back Rise",
    name_it: "Altezza Cavallo Posteriore",
    body_region: "waist",
    measurement_kind: "length",
  },

  {
    code: "leg_opening",
    name_en: "Leg Opening",
    name_it: "Apertura Fondo Gamba",
    body_region: "leg",
    measurement_kind: "circumference",
  },

  {
    code: "skirt_length",
    name_en: "Skirt Length",
    name_it: "Lunghezza Gonna",
    body_region: "body",
    measurement_kind: "length",
  },

  {
    code: "dress_length",
    name_en: "Dress Length",
    name_it: "Lunghezza Abito",
    body_region: "body",
    measurement_kind: "length",
  },
];

const CODES = MEASUREMENT_TYPES.map((item) => item.code);

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const existing = await queryInterface.sequelize.query(
      `
          SELECT code
          FROM garment_measurement_types
          WHERE code IN (:codes)
        `,
      {
        replacements: {
          codes: CODES,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const existingCodes = new Set(existing.map((row) => row.code));

    const now = new Date();

    const rows = MEASUREMENT_TYPES.filter(
      (item) => !existingCodes.has(item.code),
    ).map((item, index) => ({
      ...item,

      unit_code: "cm",

      sort_order: (index + 1) * 10,

      is_active: true,

      created_at: now,

      updated_at: now,
    }));

    if (rows.length > 0) {
      await queryInterface.bulkInsert("garment_measurement_types", rows, {
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
  await queryInterface.bulkDelete("garment_measurement_types", {
    code: {
      [Op.in]: CODES,
    },
  });
}
