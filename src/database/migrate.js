import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";
import { safeErrorForLog } from "../utils/safe-error.js";

import { migrator } from "./migrator.js";

const command = process.argv[2] || "status";

async function run() {
  await connectDatabase();

  try {
    if (command === "up") {
      const migrations = await migrator.up();
      logger.info(
        { migrations: migrations.map((migration) => migration.name) },
        "Migrations applied",
      );
      return;
    }

    if (command === "down") {
      const migrations = await migrator.down();
      logger.info(
        { migrations: migrations.map((migration) => migration.name) },
        "Migration reverted",
      );
      return;
    }

    if (command === "status") {
      const [executed, pending] = await Promise.all([
        migrator.executed(),
        migrator.pending(),
      ]);

      logger.info(
        {
          executed: executed.map((migration) => migration.name),
          pending: pending.map((migration) => migration.name),
        },
        "Migration status",
      );
      return;
    }

    throw new Error(`Unsupported migration command: ${command}`);
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error) => {
  logger.fatal(
    { error: safeErrorForLog(error, { includeStack: true }) },
    "Migration command failed",
  );
  process.exitCode = 1;
});
