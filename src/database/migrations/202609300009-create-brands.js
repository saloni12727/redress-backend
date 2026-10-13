import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("brands", {
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

    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    slug: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    logo_key: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    website_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
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

  await queryInterface.addIndex("brands", ["code"], {
    name: "uq_brands_code",
    unique: true,
  });

  await queryInterface.addIndex("brands", ["slug"], {
    name: "uq_brands_slug",
    unique: true,
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("brands");
}
