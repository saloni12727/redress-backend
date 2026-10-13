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

async function uniqueIndexExistsForColumn(
  queryInterface,
  tableName,
  columnName,
) {
  const indexes = await queryInterface.showIndex(tableName);

  return indexes.some((index) => {
    if (!index.unique) {
      return false;
    }

    const fields = (index.fields ?? []).map(
      (field) => field.attribute ?? field.name,
    );

    return fields.length === 1 && fields[0] === columnName;
  });
}

export async function up({ context: queryInterface }) {
  const cartsExists = await tableExists(queryInterface, "carts");

  /*
   * Development DB may already
   * have carts through model sync.
   *
   * Server/test may not.
   *
   * Therefore this migration
   * safely handles both cases.
   */
  if (!cartsExists) {
    await queryInterface.createTable("carts", {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,

        allowNull: false,

        autoIncrement: true,

        primaryKey: true,
      },

      account_id: {
        type: DataTypes.BIGINT.UNSIGNED,

        allowNull: true,

        references: {
          model: "accounts",

          key: "id",
        },

        onUpdate: "CASCADE",

        onDelete: "CASCADE",
      },

      guest_session_uuid: {
        type: DataTypes.CHAR(36),

        allowNull: true,

        references: {
          model: "guest_sessions",

          key: "session_uuid",
        },

        onUpdate: "CASCADE",

        onDelete: "CASCADE",
      },

      currency_code: {
        type: DataTypes.CHAR(3),

        allowNull: false,

        defaultValue: "EUR",
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
  } else {
    const columns = await queryInterface.describeTable("carts");

    /*
     * Existing carts were account-only.
     *
     * Make account_id nullable
     * because guest carts don't
     * have an account yet.
     */
    if (columns.account_id?.allowNull === false) {
      await queryInterface.changeColumn(
        "carts",

        "account_id",

        {
          type: DataTypes.BIGINT.UNSIGNED,

          allowNull: true,

          references: {
            model: "accounts",

            key: "id",
          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE",
        },
      );
    }

    if (!columns.guest_session_uuid) {
      await queryInterface.addColumn(
        "carts",

        "guest_session_uuid",

        {
          type: DataTypes.CHAR(36),

          allowNull: true,

          references: {
            model: "guest_sessions",

            key: "session_uuid",
          },

          onUpdate: "CASCADE",

          onDelete: "CASCADE",
        },
      );
    }
  }

  /*
   * One cart per account.
   */
  if (
    !(await uniqueIndexExistsForColumn(queryInterface, "carts", "account_id"))
  ) {
    await queryInterface.addIndex(
      "carts",

      ["account_id"],

      {
        name: "uq_carts_account",

        unique: true,
      },
    );
  }

  /*
   * One cart per guest session.
   */
  if (
    !(await uniqueIndexExistsForColumn(
      queryInterface,
      "carts",
      "guest_session_uuid",
    ))
  ) {
    await queryInterface.addIndex(
      "carts",

      ["guest_session_uuid"],

      {
        name: "uq_carts_guest_session",

        unique: true,
      },
    );
  }

  /*
   * Also create cart_items
   * when a server DB does not
   * already have it.
   */
  const cartItemsExists = await tableExists(queryInterface, "cart_items");

  if (!cartItemsExists) {
    await queryInterface.createTable("cart_items", {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,

        allowNull: false,

        autoIncrement: true,

        primaryKey: true,
      },

      cart_id: {
        type: DataTypes.BIGINT.UNSIGNED,

        allowNull: false,

        references: {
          model: "carts",

          key: "id",
        },

        onUpdate: "CASCADE",

        onDelete: "CASCADE",
      },

      product_variant_id: {
        type: DataTypes.BIGINT.UNSIGNED,

        allowNull: false,

        references: {
          model: "product_variants",

          key: "id",
        },

        onUpdate: "CASCADE",

        onDelete: "CASCADE",
      },

      quantity: {
        type: DataTypes.SMALLINT.UNSIGNED,

        allowNull: false,

        defaultValue: 1,
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

  if (
    !(await indexExists(
      queryInterface,
      "cart_items",
      "uq_cart_items_cart_variant",
    ))
  ) {
    await queryInterface.addIndex(
      "cart_items",

      ["cart_id", "product_variant_id"],

      {
        name: "uq_cart_items_cart_variant",

        unique: true,
      },
    );
  }
}

export async function down({ context: queryInterface }) {
  if (!(await tableExists(queryInterface, "carts"))) {
    return;
  }

  const columns = await queryInterface.describeTable("carts");

  if (columns.guest_session_uuid) {
    /*
     * Guest-only carts cannot exist
     * after feature rollback.
     */
    await queryInterface.bulkDelete(
      "carts",

      {
        account_id: null,
      },
    );

    if (await indexExists(queryInterface, "carts", "uq_carts_guest_session")) {
      await queryInterface.removeIndex(
        "carts",

        "uq_carts_guest_session",
      );
    }

    await queryInterface.removeColumn(
      "carts",

      "guest_session_uuid",
    );
  }

  const refreshedColumns = await queryInterface.describeTable("carts");

  if (refreshedColumns.account_id?.allowNull === true) {
    await queryInterface.changeColumn(
      "carts",

      "account_id",

      {
        type: DataTypes.BIGINT.UNSIGNED,

        allowNull: false,

        references: {
          model: "accounts",

          key: "id",
        },

        onUpdate: "CASCADE",

        onDelete: "CASCADE",
      },
    );
  }
}
