import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("product_translations", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    product_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "products",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    language_code: {
      type: DataTypes.STRING(10),
      allowNull: false,

      references: {
        model: "languages",
        key: "code",
      },

      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    short_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    description: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },

    care_instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    size_and_fit_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    seo_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    seo_description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  await queryInterface.addIndex(
    "product_translations",
    ["product_id", "language_code"],
    {
      name: "uq_product_translations_product_language",
      unique: true,
    },
  );

  await queryInterface.addIndex("product_translations", ["language_code"], {
    name: "idx_product_translations_language",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("product_translations");
}
