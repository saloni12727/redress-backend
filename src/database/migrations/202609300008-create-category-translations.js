import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("category_translations", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    category_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "categories",
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
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
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
    "category_translations",
    ["category_id", "language_code"],
    {
      name: "uq_category_translations_category_language",

      unique: true,
    },
  );

  await queryInterface.addIndex("category_translations", ["language_code"], {
    name: "idx_category_translations_language",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("category_translations");
}
