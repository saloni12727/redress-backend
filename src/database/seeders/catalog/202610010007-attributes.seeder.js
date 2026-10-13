import { Op, QueryTypes } from "sequelize";

const ATTRIBUTES = [
  {
    code: "fabric",
    name_en: "Fabric",
    name_it: "Tessuto",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: true,
    unit_code: null,
  },

  {
    code: "pattern",
    name_en: "Pattern",
    name_it: "Fantasia",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: true,
    unit_code: null,
  },

  {
    code: "sleeve_length",
    name_en: "Sleeve Length",
    name_it: "Lunghezza Manica",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "neck_type",
    name_en: "Neck Type",
    name_it: "Tipo di Scollo",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "collar_type",
    name_en: "Collar Type",
    name_it: "Tipo di Colletto",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "occasion",
    name_en: "Occasion",
    name_it: "Occasione",
    data_type: "option",
    input_type: "multiselect",
    allows_multiple: true,
    is_filterable: true,
    is_searchable: true,
    unit_code: null,
  },

  {
    code: "closure",
    name_en: "Closure",
    name_it: "Chiusura",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "waist_rise",
    name_en: "Waist Rise",
    name_it: "Altezza Vita",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "stretchability",
    name_en: "Stretchability",
    name_it: "Elasticità",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "transparency",
    name_en: "Transparency",
    name_it: "Trasparenza",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "dress_shape",
    name_en: "Dress Shape",
    name_it: "Forma Abito",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "dress_length",
    name_en: "Dress Length",
    name_it: "Lunghezza Abito",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "upper_material",
    name_en: "Upper Material",
    name_it: "Materiale Tomaia",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "sole_material",
    name_en: "Sole Material",
    name_it: "Materiale Suola",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "heel_type",
    name_en: "Heel Type",
    name_it: "Tipo di Tacco",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "heel_height_cm",
    name_en: "Heel Height",
    name_it: "Altezza Tacco",
    data_type: "decimal",
    input_type: "number",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: "cm",
  },

  {
    code: "toe_shape",
    name_en: "Toe Shape",
    name_it: "Forma Punta",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "shoe_width",
    name_en: "Shoe Width",
    name_it: "Larghezza Scarpa",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: false,
    unit_code: null,
  },

  {
    code: "bag_type",
    name_en: "Bag Type",
    name_it: "Tipo di Borsa",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: true,
    unit_code: null,
  },

  {
    code: "jewellery_type",
    name_en: "Jewellery Type",
    name_it: "Tipo di Gioiello",
    data_type: "option",
    input_type: "select",
    allows_multiple: false,
    is_filterable: true,
    is_searchable: true,
    unit_code: null,
  },
];

const ATTRIBUTE_CODES = ATTRIBUTES.map((attribute) => attribute.code);

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const existing = await queryInterface.sequelize.query(
      `
          SELECT code
          FROM attributes
          WHERE code IN (:codes)
        `,
      {
        replacements: {
          codes: ATTRIBUTE_CODES,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const existingCodes = new Set(existing.map((row) => row.code));

    const now = new Date();

    const rows = ATTRIBUTES.filter(
      (attribute) => !existingCodes.has(attribute.code),
    ).map((attribute, index) => ({
      ...attribute,

      sort_order: (index + 1) * 10,

      is_active: true,

      created_at: now,

      updated_at: now,
    }));

    if (rows.length > 0) {
      await queryInterface.bulkInsert("attributes", rows, {
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
  await queryInterface.bulkDelete("attributes", {
    code: {
      [Op.in]: ATTRIBUTE_CODES,
    },
  });
}
