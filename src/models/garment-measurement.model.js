import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class GarmentMeasurement extends Model {}

GarmentMeasurement.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    variantId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "variant_id",
    },

    measurementTypeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "measurement_type_id",
    },

    valueCm: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: "value_cm",
    },

    tolerancePlusCm: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
      field: "tolerance_plus_cm",
    },

    toleranceMinusCm: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
      field: "tolerance_minus_cm",
    },

    source: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "vendor",

      validate: {
        isIn: [["vendor", "admin", "import", "estimated"]],
      },
    },

    isEstimated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_estimated",
    },

    notes: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    sequelize,

    modelName: "GarmentMeasurement",

    tableName: "garment_measurements",

    timestamps: true,

    createdAt: "created_at",

    updatedAt: "updated_at",

    underscored: true,
  },
);

export default GarmentMeasurement;
