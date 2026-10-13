import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("vendors", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    code: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },

    slug: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },

    display_name: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },

    legal_name: {
      type: DataTypes.STRING(220),
      allowNull: true,
    },

    email: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },

    phone: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "inactive",
    },

    approval_status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "pending",
    },

    commission_type: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "percentage",
    },

    commission_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    default_currency_code: {
      type: DataTypes.CHAR(3),
      allowNull: false,
    },

    country_code: {
      type: DataTypes.CHAR(2),
      allowNull: true,
    },

    tax_identifier: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    registration_number: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    website_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    logo_key: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    suspended_at: {
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

  await queryInterface.addIndex("vendors", ["code"], {
    name: "uq_vendors_code",
    unique: true,
  });

  await queryInterface.addIndex("vendors", ["slug"], {
    name: "uq_vendors_slug",
    unique: true,
  });

  await queryInterface.addIndex("vendors", ["email"], {
    name: "uq_vendors_email",
    unique: true,
  });

  await queryInterface.addIndex("vendors", ["approval_status", "status"], {
    name: "idx_vendors_approval_status",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("vendors");
}
