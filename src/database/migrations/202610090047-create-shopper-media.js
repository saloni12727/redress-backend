import { DataTypes } from "sequelize";

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();

  return tables.some((table) => {
    if (typeof table === "string") {
      return table.toLowerCase() === tableName.toLowerCase();
    }

    return Object.values(table || {}).some(
      (value) => String(value).toLowerCase() === tableName.toLowerCase(),
    );
  });
}

async function indexExists(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName);

  return indexes.some((index) => index.name === indexName);
}

export async function up({ context: queryInterface }) {
  const exists = await tableExists(queryInterface, "shopper_media");

  if (!exists) {
    await queryInterface.createTable("shopper_media", {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      account_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "accounts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      purpose: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },

      storage_key: {
        type: DataTypes.STRING(500),
        allowNull: false,
        unique: true,
      },

      mime_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      width: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      height: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      size_bytes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      attached_at: {
        type: DataTypes.DATE,
        allowNull: true,
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
  }

  if (
    !(await indexExists(
      queryInterface,
      "shopper_media",
      "idx_shopper_media_owner_purpose_attachment",
    ))
  ) {
    await queryInterface.addIndex(
      "shopper_media",
      ["account_id", "purpose", "attached_at"],
      {
        name: "idx_shopper_media_owner_purpose_attachment",
      },
    );
  }

  if (
    !(await indexExists(
      queryInterface,
      "shopper_media",
      "idx_shopper_media_created",
    ))
  ) {
    await queryInterface.addIndex("shopper_media", ["created_at"], {
      name: "idx_shopper_media_created",
    });
  }
}

export async function down({ context: queryInterface }) {
  if (await tableExists(queryInterface, "shopper_media")) {
    await queryInterface.dropTable("shopper_media");
  }
}
