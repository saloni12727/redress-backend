import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("content_policies", {
    id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    sections: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    is_published: {
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
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("content_policies");
}
