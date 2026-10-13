import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("vendor_users", {
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
      onDelete: "CASCADE",
    },

    account_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "accounts",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "active",
    },

    is_owner: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    joined_at: {
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
  });

  await queryInterface.addIndex("vendor_users", ["vendor_id", "account_id"], {
    name: "uq_vendor_users_vendor_account",
    unique: true,
  });

  await queryInterface.addIndex("vendor_users", ["account_id"], {
    name: "idx_vendor_users_account",
  });

  await queryInterface.addIndex("vendor_users", ["vendor_id", "status"], {
    name: "idx_vendor_users_vendor_status",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("vendor_users");
}
