import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("sizes", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    size_system_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "size_systems",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    label: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    sort_order: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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

  await queryInterface.addIndex("sizes", ["size_system_id", "code"], {
    name: "uq_sizes_system_code",

    unique: true,
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("sizes");
}
