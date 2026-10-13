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
  const exists = await tableExists(queryInterface, "body_profiles");

  if (!exists) {
    await queryInterface.createTable("body_profiles", {
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

      name: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },

      relation: {
        type: DataTypes.STRING(16),
        allowNull: false,
      },

      self_owner_key: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },

      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      sex: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },

      height_cm: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: true,
      },

      weight_kg: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: true,
      },

      shoulders_cm: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: true,
      },

      chest_cm: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: true,
      },

      waist_cm: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: true,
      },

      hips_cm: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: true,
      },

      inseam_cm: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: true,
      },

      arm_length_cm: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: true,
      },

      shoe_eu: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: true,
      },

      foot_length_cm: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: true,
      },

      front_media_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },

      back_media_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },

      left_media_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },

      right_media_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },

      avatar_media_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },

      stylist: {
        type: DataTypes.JSON,
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
      "body_profiles",
      "idx_body_profiles_account_default",
    ))
  ) {
    await queryInterface.addIndex(
      "body_profiles",
      ["account_id", "is_default"],
      {
        name: "idx_body_profiles_account_default",
      },
    );
  }

  if (
    !(await indexExists(
      queryInterface,
      "body_profiles",
      "idx_body_profiles_account_updated",
    ))
  ) {
    await queryInterface.addIndex(
      "body_profiles",
      ["account_id", "updated_at"],
      {
        name: "idx_body_profiles_account_updated",
      },
    );
  }

  if (
    !(await indexExists(
      queryInterface,
      "body_profiles",
      "uq_body_profiles_live_self",
    ))
  ) {
    await queryInterface.addIndex("body_profiles", ["self_owner_key"], {
      name: "uq_body_profiles_live_self",
      unique: true,
    });
  }
}

export async function down({ context: queryInterface }) {
  if (await tableExists(queryInterface, "body_profiles")) {
    await queryInterface.dropTable("body_profiles");
  }
}
