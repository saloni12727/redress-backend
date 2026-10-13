import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("attribute_values", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    attribute_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "attributes",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    label_en: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    label_it: {
      type: DataTypes.STRING(150),
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

  await queryInterface.addIndex("attribute_values", ["attribute_id", "code"], {
    name: "uq_attribute_values_attribute_code",
    unique: true,
  });

  await queryInterface.addIndex(
    "attribute_values",
    ["attribute_id", "is_active"],
    {
      name: "idx_attribute_values_attribute_active",
    },
  );
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("attribute_values");
}
