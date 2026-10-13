import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("garment_measurements", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    variant_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "product_variants",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    measurement_type_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "garment_measurement_types",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    value_cm: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    tolerance_plus_cm: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },

    tolerance_minus_cm: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },

    source: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "vendor",
    },

    is_estimated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    notes: {
      type: DataTypes.STRING(500),
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
  });

  await queryInterface.addIndex(
    "garment_measurements",
    ["variant_id", "measurement_type_id"],
    {
      name: "uq_garment_measurements_variant_type",
      unique: true,
    },
  );

  await queryInterface.addIndex(
    "garment_measurements",
    ["measurement_type_id"],
    {
      name: "idx_garment_measurements_type",
    },
  );
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("garment_measurements");
}
