import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("categories", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    parent_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,

      references: {
        model: "categories",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    slug: {
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

    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await queryInterface.addIndex("categories", ["code"], {
    name: "uq_categories_code",
    unique: true,
  });

  await queryInterface.addIndex("categories", ["slug"], {
    name: "uq_categories_slug",
    unique: true,
  });

  await queryInterface.addIndex("categories", ["parent_id"], {
    name: "idx_categories_parent_id",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("categories");
}
