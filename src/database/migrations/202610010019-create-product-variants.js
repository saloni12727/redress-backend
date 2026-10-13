import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("product_variants", {
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

    size_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,

      references: {
        model: "sizes",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    color_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,

      references: {
        model: "colors",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    sku: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },

    barcode: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },

    regular_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    sale_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },

    cost_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },

    sale_start_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    sale_end_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    weight_value: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },

    weight_unit: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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

    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await queryInterface.addIndex("product_variants", ["sku"], {
    name: "uq_product_variants_sku",
    unique: true,
  });

  await queryInterface.addIndex("product_variants", ["barcode"], {
    name: "uq_product_variants_barcode",
    unique: true,
  });

  await queryInterface.addIndex(
    "product_variants",
    ["product_id", "size_id", "color_id"],
    {
      name: "uq_product_variants_product_size_color",
      unique: true,
    },
  );

  await queryInterface.addIndex(
    "product_variants",
    ["product_id", "is_active"],
    {
      name: "idx_product_variants_product_active",
    },
  );

  await queryInterface.addIndex("product_variants", ["size_id"], {
    name: "idx_product_variants_size",
  });

  await queryInterface.addIndex("product_variants", ["color_id"], {
    name: "idx_product_variants_color",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("product_variants");
}
