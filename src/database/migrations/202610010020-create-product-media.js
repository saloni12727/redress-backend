import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("product_media", {
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

    media_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "image",
    },

    storage_key: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },

    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    alt_text: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    width: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    height: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    duration_seconds: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    sort_order: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    is_primary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    moderation_status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "pending",
    },

    approved_at: {
      type: DataTypes.DATE,
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

    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await queryInterface.addIndex("product_media", ["product_id", "sort_order"], {
    name: "idx_product_media_product_sort",
  });

  await queryInterface.addIndex("product_media", ["variant_id"], {
    name: "idx_product_media_variant",
  });

  await queryInterface.addIndex("product_media", ["moderation_status"], {
    name: "idx_product_media_moderation",
  });

  await queryInterface.addIndex("product_media", ["product_id", "is_primary"], {
    name: "idx_product_media_primary",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("product_media");
}
