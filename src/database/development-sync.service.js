import { summarizeMigrationNames, writeSchemaSnapshot } from "./schema-snapshot.js";

function statusNames(items) {
  return items.map((item) => item.name);
}

async function getRunnerStatus(runner) {
  const [executed, pending] = await Promise.all([
    runner.executed(),
    runner.pending(),
  ]);

  return {
    executed: statusNames(executed),
    pending: statusNames(pending),
  };
}

/**
 * Synchronizes a development database from the model base schema, then
 * applies existing migration history and required base seed data. It
 * intentionally excludes demo data and starter-product uploads.
 */
export async function runDevelopmentDatabaseSync({
  env,
  logger,
  connectDatabase,
  disconnectDatabase,
  migrator,
  coreSeeder,
  catalogSeeder,
  syncModels = async () => undefined,
  writeSnapshot = writeSchemaSnapshot,
}) {
  if (env.NODE_ENV !== "development") {
    throw new Error("db:sync:dev can only run when NODE_ENV is development");
  }

  let connected = false;

  try {
    await connectDatabase();
    connected = true;

    /* Create only tables and indexes that do not exist in the model-first
     * schema. Do not use alter: existing database structures stay intact. */
    await syncModels();

    const appliedMigrations = await migrator.up();
    const appliedCoreSeeders = await coreSeeder.up();
    const appliedCatalogSeeders = await catalogSeeder.up();
    const snapshot = await writeSnapshot();
    const [migrations, coreSeeders, catalogSeeders] = await Promise.all([
      getRunnerStatus(migrator),
      getRunnerStatus(coreSeeder),
      getRunnerStatus(catalogSeeder),
    ]);
    const result = {
      applied: {
        migrations: summarizeMigrationNames(appliedMigrations),
        coreSeeders: summarizeMigrationNames(appliedCoreSeeders),
        catalogSeeders: summarizeMigrationNames(appliedCatalogSeeders),
      },
      snapshot,
      status: {
        migrations,
        coreSeeders,
        catalogSeeders,
      },
    };

    logger.info(
      {
        component: "db-sync-dev",
        ...result,
      },
      "Development database synchronized successfully",
    );

    return result;
  } finally {
    if (connected) {
      await disconnectDatabase();
    }
  }
}
