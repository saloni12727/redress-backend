import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class BodyProfile extends Model {}

BodyProfile.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    accountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "account_id",
    },

    name: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },

    relation: {
      type: DataTypes.STRING(16),
      allowNull: false,
      validate: {
        isIn: [["self", "partner", "child", "other"]],
      },
    },

    /*
     * MySQL does not support a normal partial unique index.
     *
     * For a live self profile this contains accountId.
     * For partner / child / other it remains null.
     *
     * This allows:
     * - one self profile
     * - multiple other profiles
     */
    selfOwnerKey: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "self_owner_key",
      unique: true,
    },

    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_default",
    },

    sex: {
      type: DataTypes.STRING(16),
      allowNull: true,
      validate: {
        isIn: [["male", "female"]],
      },
    },

    heightCm: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: true,
      field: "height_cm",
    },

    weightKg: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: true,
      field: "weight_kg",
    },

    shouldersCm: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: true,
      field: "shoulders_cm",
    },

    chestCm: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: true,
      field: "chest_cm",
    },

    waistCm: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: true,
      field: "waist_cm",
    },

    hipsCm: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: true,
      field: "hips_cm",
    },

    inseamCm: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: true,
      field: "inseam_cm",
    },

    armLengthCm: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: true,
      field: "arm_length_cm",
    },

    shoeEu: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: true,
      field: "shoe_eu",
    },

    footLengthCm: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: true,
      field: "foot_length_cm",
    },

    frontMediaId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "front_media_id",
    },

    backMediaId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "back_media_id",
    },

    leftMediaId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "left_media_id",
    },

    rightMediaId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "right_media_id",
    },

    avatarMediaId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "avatar_media_id",
    },

    stylist: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,

    modelName: "BodyProfile",

    tableName: "body_profiles",

    /*
     * IMPORTANT:
     *
     * Keep JavaScript attributes as:
     *
     * createdAt
     * updatedAt
     * deletedAt
     *
     * Sequelize automatically maps them to:
     *
     * created_at
     * updated_at
     * deleted_at
     *
     * because underscored = true.
     */

    timestamps: true,

    paranoid: true,

    underscored: true,

    indexes: [
      {
        fields: ["account_id", "is_default"],
        name: "idx_body_profiles_account_default",
      },

      {
        fields: ["account_id", "updated_at"],
        name: "idx_body_profiles_account_updated",
      },

      {
        unique: true,
        fields: ["self_owner_key"],
        name: "uq_body_profiles_live_self",
      },
    ],
  },
);

export default BodyProfile;
