import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { safeErrorForLog } from "../utils/safe-error.js";
import { catalogSeeder } from "./catalog-seeder.js";
import {
  connectDatabase,
  disconnectDatabase,
  sequelize,
} from "../config/database.js";
import { runDevelopmentDatabaseSync } from "./development-sync.service.js";
import { migrator } from "./migrator.js";
import { coreSeeder } from "./seeder.js";

/* Register every Sequelize model and association before model-first sync. */
import "../models/index.js";

try {
  await runDevelopmentDatabaseSync({
    env,
    logger,
    connectDatabase,
    disconnectDatabase,
    migrator,
    coreSeeder,
    catalogSeeder,
    syncModels: () => sequelize.sync(),
  });
} catch (error) {
  logger.fatal(
    {
      component: "db-sync-dev",
      error: safeErrorForLog(error, { includeStack: env.NODE_ENV === "development" }),
    },
    "Development database synchronization failed",
  );

  process.exitCode = 1;
}
