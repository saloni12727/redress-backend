import { Op } from "sequelize";

const COLORS = [
  {
    code: "black",
    name: "Black",
    hex_code: "#000000",
  },
  {
    code: "white",
    name: "White",
    hex_code: "#FFFFFF",
  },
  {
    code: "grey",
    name: "Grey",
    hex_code: "#808080",
  },
  {
    code: "navy",
    name: "Navy",
    hex_code: "#000080",
  },
  {
    code: "blue",
    name: "Blue",
    hex_code: "#0000FF",
  },
  {
    code: "red",
    name: "Red",
    hex_code: "#FF0000",
  },
  {
    code: "green",
    name: "Green",
    hex_code: "#008000",
  },
  {
    code: "olive",
    name: "Olive",
    hex_code: "#808000",
  },
  {
    code: "yellow",
    name: "Yellow",
    hex_code: "#FFFF00",
  },
  {
    code: "orange",
    name: "Orange",
    hex_code: "#FFA500",
  },
  {
    code: "pink",
    name: "Pink",
    hex_code: "#FFC0CB",
  },
  {
    code: "purple",
    name: "Purple",
    hex_code: "#800080",
  },
  {
    code: "beige",
    name: "Beige",
    hex_code: "#F5F5DC",
  },
  {
    code: "brown",
    name: "Brown",
    hex_code: "#A52A2A",
  },
  {
    code: "maroon",
    name: "Maroon",
    hex_code: "#800000",
  },
];

const COLOR_CODES = COLORS.map((color) => color.code);

export async function up({ context: queryInterface }) {
  const now = new Date();

  const existing = await queryInterface.sequelize.query(
    `
        SELECT code
        FROM colors
        WHERE code IN (:codes)
      `,
    {
      replacements: {
        codes: COLOR_CODES,
      },

      type: queryInterface.sequelize.QueryTypes?.SELECT,
    },
  );

  const existingCodes = new Set(existing.map((color) => color.code));

  const rows = COLORS.filter((color) => !existingCodes.has(color.code)).map(
    (color, index) => ({
      ...color,

      sort_order: (index + 1) * 10,

      is_active: true,

      created_at: now,

      updated_at: now,
    }),
  );

  if (rows.length > 0) {
    await queryInterface.bulkInsert("colors", rows);
  }
}

export async function down({ context: queryInterface }) {
  await queryInterface.bulkDelete("colors", {
    code: {
      [Op.in]: COLOR_CODES,
    },
  });
}
