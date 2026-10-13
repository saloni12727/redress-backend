import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Cart extends Model {}

Cart.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    accountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      unique: true,
      field: "account_id",
    },

    guestSessionUuid: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      unique: true,
      field: "guest_session_uuid",
    },

    currencyCode: {
      type: DataTypes.CHAR(3),
      allowNull: false,
      defaultValue: "EUR",
      field: "currency_code",
    },
  },
  {
    sequelize,
    modelName: "Cart",
    tableName: "carts",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,

    validate: {
      exactlyOneOwner() {
        const hasAccount =
          this.accountId !== null && this.accountId !== undefined;

        const hasGuest =
          this.guestSessionUuid !== null && this.guestSessionUuid !== undefined;

        if (hasAccount === hasGuest) {
          throw new Error(
            "A cart must belong to exactly one account or guest session.",
          );
        }
      },
    },
  },
);

export default Cart;
