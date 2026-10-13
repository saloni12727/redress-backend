import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("product_categories", {
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

    category_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "categories",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    is_primary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    sort_order: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
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
    "product_categories",
    ["product_id", "category_id"],
    {
      name: "uq_product_categories_product_category",
      unique: true,
    },
  );

  await queryInterface.addIndex("product_categories", ["category_id"], {
    name: "idx_product_categories_category",
  });

  await queryInterface.addIndex(
    "product_categories",
    ["product_id", "is_primary"],
    {
      name: "idx_product_categories_primary",
    },
  );
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("product_categories");
}
