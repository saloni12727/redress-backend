export async function up({ context: queryInterface }) {
  await queryInterface.sequelize.query(`
    UPDATE products

    SET return_window_days =
      CASE
        WHEN is_returnable = 1
          THEN 14

        ELSE NULL
      END

    WHERE deleted_at IS NULL

      AND (
        (
          is_returnable = 1

          AND (
            return_window_days IS NULL

            OR return_window_days <> 14
          )
        )

        OR (
          is_returnable = 0

          AND return_window_days IS NOT NULL
        )
      )
  `);
}

export async function down() {
  /*
   * Intentionally not reversible.
   *
   * Previous per-product return
   * windows cannot be reconstructed
   * safely after enforcing the
   * platform-wide policy.
   */
}
