import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("attributes", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    name_en: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    name_it: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    data_type: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "option",
    },

    input_type: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "select",
    },

    unit_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    allows_multiple: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    is_filterable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    is_searchable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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

  await queryInterface.addIndex("attributes", ["code"], {
    name: "uq_attributes_code",
    unique: true,
  });

  await queryInterface.addIndex("attributes", ["is_active", "is_filterable"], {
    name: "idx_attributes_active_filterable",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("attributes");
}
