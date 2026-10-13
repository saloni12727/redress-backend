import { DataTypes } from "sequelize";

async function tableNames(queryInterface) {
  return (await queryInterface.showAllTables()).map((table) => {
    if (typeof table === "string") return table.toLowerCase();
    return String(Object.values(table ?? {})[0] ?? "").toLowerCase();
  });
}

async function indexExists(queryInterface, tableName, indexName) {
  return (await queryInterface.showIndex(tableName)).some((index) => index.name === indexName);
}

export async function up({ context: queryInterface }) {
  const tables = await tableNames(queryInterface);
  for (const required of ["orders", "order_items", "accounts"]) {
    if (!tables.includes(required)) {
      throw new Error(`Cannot create order returns before the ${required} table exists.`);
    }
  }

  const orderColumns = await queryInterface.describeTable("orders");
  for (const [column, definition] of Object.entries({
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    cancel_reason: { type: DataTypes.STRING(24), allowNull: true },
    cancel_note: { type: DataTypes.STRING(1000), allowNull: true },
  })) {
    if (!orderColumns[column]) await queryInterface.addColumn("orders", column, definition);
  }

  if (!tables.includes("order_returns")) {
    await queryInterface.createTable("order_returns", {
      id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
      order_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: "orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      account_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: "accounts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: "requested" },
      refund_status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "not_started" },
      refund_method: { type: DataTypes.STRING(32), allowNull: true },
      refund_provider: { type: DataTypes.STRING(40), allowNull: true },
      provider_refund_id: { type: DataTypes.STRING(191), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });
  }
  if (!(await indexExists(queryInterface, "order_returns", "idx_order_returns_order"))) {
    await queryInterface.addIndex("order_returns", ["order_id"], { name: "idx_order_returns_order" });
  }
  if (!(await indexExists(queryInterface, "order_returns", "idx_order_returns_account_created"))) {
    await queryInterface.addIndex("order_returns", ["account_id", "created_at"], { name: "idx_order_returns_account_created" });
  }

  if (!tables.includes("order_return_items")) {
    await queryInterface.createTable("order_return_items", {
      id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
      order_return_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: "order_returns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      order_item_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: "order_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      product_snapshot: { type: DataTypes.JSON, allowNull: false },
      quantity: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
      reason: { type: DataTypes.STRING(24), allowNull: false },
      note: { type: DataTypes.STRING(1000), allowNull: true },
      unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      line_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });
  }
  if (!(await indexExists(queryInterface, "order_return_items", "idx_order_return_items_return"))) {
    await queryInterface.addIndex("order_return_items", ["order_return_id"], { name: "idx_order_return_items_return" });
  }
  if (!(await indexExists(queryInterface, "order_return_items", "idx_order_return_items_order_item"))) {
    await queryInterface.addIndex("order_return_items", ["order_item_id"], { name: "idx_order_return_items_order_item" });
  }
}

export async function down({ context: queryInterface }) {
  const tables = await tableNames(queryInterface);
  if (tables.includes("order_return_items")) await queryInterface.dropTable("order_return_items");
  if (tables.includes("order_returns")) await queryInterface.dropTable("order_returns");
  if (tables.includes("orders")) {
    const columns = await queryInterface.describeTable("orders");
    for (const column of ["cancel_note", "cancel_reason", "cancelled_at", "delivered_at"]) {
      if (columns[column]) await queryInterface.removeColumn("orders", column);
    }
  }
}
