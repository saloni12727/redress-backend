import { DataTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Expand Home Placements For CMS
|--------------------------------------------------------------------------
|
| The original Home-placement table provides safe catalog targets and public
| scheduling. This migration adds the metadata required for the Super Admin
| CMS described in the Flutter Home flow: typed links, display labels, image
| upload metadata, content origin, and publication audit records.
|
| Values remain nullable so existing draft records can be migrated safely.
| The future Admin Home module owns validation for section, status, link type,
| locale completeness, schedule, and target compatibility.
|
*/

const AUDIT_COLUMNS = [
  {
    name: "created_by_account_id",
    indexName: "idx_home_placements_created_by",
  },
  {
    name: "updated_by_account_id",
    indexName: "idx_home_placements_updated_by",
  },
  {
    name: "published_by_account_id",
    indexName: "idx_home_placements_published_by",
  },
];

function accountReferenceColumn() {
  return {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    references: { model: "accounts", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  };
}

export async function up({ context: queryInterface }) {
  await queryInterface.addColumn("home_placements", "link_path", {
    type: DataTypes.STRING(500),
    allowNull: true,
  });

  await queryInterface.addColumn("home_placements", "link_query", {
    type: DataTypes.JSON,
    allowNull: true,
  });

  await queryInterface.addColumn("home_placements", "external_url", {
    type: DataTypes.STRING(2048),
    allowNull: true,
  });

  /*
   * Offers will receive their own relational module later. Until then, this
   * holds only the approved public offer summary required by the Home feed;
   * it is never an arbitrary client redirect.
   */
  await queryInterface.addColumn("home_placements", "offer_payload", {
    type: DataTypes.JSON,
    allowNull: true,
  });

  await queryInterface.addColumn("home_placements", "badge_en", {
    type: DataTypes.STRING(100),
    allowNull: true,
  });

  await queryInterface.addColumn("home_placements", "badge_it", {
    type: DataTypes.STRING(100),
    allowNull: true,
  });

  await queryInterface.addColumn("home_placements", "discount_label_en", {
    type: DataTypes.STRING(100),
    allowNull: true,
  });

  await queryInterface.addColumn("home_placements", "discount_label_it", {
    type: DataTypes.STRING(100),
    allowNull: true,
  });

  await queryInterface.addColumn("home_placements", "image_content_type", {
    type: DataTypes.STRING(100),
    allowNull: true,
  });

  await queryInterface.addColumn("home_placements", "image_size_bytes", {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  });

  await queryInterface.addColumn("home_placements", "source", {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "admin",
  });

  for (const column of AUDIT_COLUMNS) {
    await queryInterface.addColumn(
      "home_placements",
      column.name,
      accountReferenceColumn(),
    );
  }

  await queryInterface.addColumn("home_placements", "published_at", {
    type: DataTypes.DATE,
    allowNull: true,
  });

  await queryInterface.addIndex("home_placements", ["source", "status"], {
    name: "idx_home_placements_source_status",
  });

  for (const column of AUDIT_COLUMNS) {
    await queryInterface.addIndex("home_placements", [column.name], {
      name: column.indexName,
    });
  }
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeIndex(
    "home_placements",
    "idx_home_placements_source_status",
  );

  for (const column of [...AUDIT_COLUMNS].reverse()) {
    await queryInterface.removeIndex("home_placements", column.indexName);
  }

  const columns = [
    "published_at",
    ...[...AUDIT_COLUMNS].reverse().map((column) => column.name),
    "source",
    "image_size_bytes",
    "image_content_type",
    "discount_label_it",
    "discount_label_en",
    "badge_it",
    "badge_en",
    "offer_payload",
    "external_url",
    "link_query",
    "link_path",
  ];

  for (const column of columns) {
    await queryInterface.removeColumn("home_placements", column);
  }
}
