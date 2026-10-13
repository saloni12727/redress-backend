import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("product_attribute_values", {
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

    variant_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,

      references: {
        model: "product_variants",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    attribute_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "attributes",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    attribute_value_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,

      references: {
        model: "attribute_values",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    value_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    value_decimal: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: true,
    },

    value_boolean: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },

    unit_code: {
      type: DataTypes.STRING(20),
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
    "product_attribute_values",
    ["product_id", "attribute_id"],
    {
      name: "idx_product_attribute_values_product_attribute",
    },
  );

  await queryInterface.addIndex("product_attribute_values", ["variant_id"], {
    name: "idx_product_attribute_values_variant",
  });

  await queryInterface.addIndex(
    "product_attribute_values",
    ["attribute_value_id"],
    {
      name: "idx_product_attribute_values_option",
    },
  );
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("product_attribute_values");
}
