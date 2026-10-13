import { DataTypes } from "sequelize";

async function indexExists(queryInterface, tableName, indexName) {
  return (await queryInterface.showIndex(tableName)).some(
    (index) => index.name === indexName,
  );
}

export async function up({ context: queryInterface }) {
  const columns = await queryInterface.describeTable("products");

  if (!columns.try_on_ready) {
    await queryInterface.addColumn("products", "try_on_ready", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: "is_featured",
    });
  }

  if (
    !(await indexExists(
      queryInterface,
      "products",
      "idx_products_public_try_on",
    ))
  ) {
    await queryInterface.addIndex(
      "products",
      ["status", "approval_status", "visibility", "try_on_ready"],
      {
        name: "idx_products_public_try_on",
      },
    );
  }
}

export async function down({ context: queryInterface }) {
  const indexes = await queryInterface.showIndex("products");

  if (indexes.some((index) => index.name === "idx_products_public_try_on")) {
    await queryInterface.removeIndex("products", "idx_products_public_try_on");
  }

  const columns = await queryInterface.describeTable("products");

  if (columns.try_on_ready) {
    await queryInterface.removeColumn("products", "try_on_ready");
  }
}
