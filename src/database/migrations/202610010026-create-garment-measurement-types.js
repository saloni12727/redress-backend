import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("garment_measurement_types", {
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

    body_region: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    measurement_kind: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "length",
    },

    unit_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "cm",
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

  await queryInterface.addIndex("garment_measurement_types", ["code"], {
    name: "uq_garment_measurement_types_code",
    unique: true,
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("garment_measurement_types");
}
