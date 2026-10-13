import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("category_attributes", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    category_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "categories",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    attribute_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "attributes",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    is_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    is_filterable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    is_variant_attribute: {
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

  await queryInterface.addIndex(
    "category_attributes",
    ["category_id", "attribute_id"],
    {
      name: "uq_category_attributes_category_attribute",
      unique: true,
    },
  );

  await queryInterface.addIndex("category_attributes", ["attribute_id"], {
    name: "idx_category_attributes_attribute",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("category_attributes");
}
