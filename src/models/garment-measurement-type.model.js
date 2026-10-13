import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class GarmentMeasurementType extends Model {}

GarmentMeasurementType.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    nameEn: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "name_en",
    },

    nameIt: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "name_it",
    },

    bodyRegion: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "body_region",
    },

    measurementKind: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "length",
      field: "measurement_kind",

      validate: {
        isIn: [["length", "width", "circumference", "height", "other"]],
      },
    },

    unitCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "cm",
      field: "unit_code",
    },

    sortOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    sequelize,

    modelName: "GarmentMeasurementType",

    tableName: "garment_measurement_types",

    timestamps: true,

    createdAt: "created_at",

    updatedAt: "updated_at",

    underscored: true,
  },
);

export default GarmentMeasurementType;
