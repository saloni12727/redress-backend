import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("products", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    vendor_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "vendors",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    brand_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,

      references: {
        model: "brands",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    fit_profile_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,

      references: {
        model: "fit_profiles",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    code: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },

    slug: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },

    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "draft",
    },

    approval_status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "pending",
    },

    visibility: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "hidden",
    },

    currency_code: {
      type: DataTypes.CHAR(3),
      allowNull: false,
    },

    is_featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    is_returnable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    return_window_days: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: true,
    },

    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    created_by_account_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,

      references: {
        model: "accounts",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    approved_by_account_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,

      references: {
        model: "accounts",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "SET NULL",
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

  await queryInterface.addIndex("products", ["code"], {
    name: "uq_products_code",
    unique: true,
  });

  await queryInterface.addIndex("products", ["slug"], {
    name: "uq_products_slug",
    unique: true,
  });

  await queryInterface.addIndex("products", ["vendor_id", "status"], {
    name: "idx_products_vendor_status",
  });

  await queryInterface.addIndex("products", ["brand_id"], {
    name: "idx_products_brand",
  });

  await queryInterface.addIndex("products", ["fit_profile_id"], {
    name: "idx_products_fit_profile",
  });

  await queryInterface.addIndex("products", ["approval_status", "visibility"], {
    name: "idx_products_approval_visibility",
  });

  await queryInterface.addIndex("products", ["published_at"], {
    name: "idx_products_published_at",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("products");
}
