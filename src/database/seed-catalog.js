import { connectDatabase, disconnectDatabase } from "../config/database.js";

import { logger } from "../config/logger.js";

import { catalogSeeder } from "./catalog-seeder.js";

async function run() {
  const command = process.argv[2] ?? "up";

  try {
    await connectDatabase();

    if (command === "up") {
      const seeders = await catalogSeeder.up();

      logger.info(
        {
          seeders: seeders.map((seeder) => seeder.name),
        },
        "Catalog seeders applied",
      );

      return;
    }

    if (command === "down") {
      const seeders = await catalogSeeder.down();

      logger.info(
        {
          seeders: seeders.map((seeder) => seeder.name),
        },
        "Catalog seeder rolled back",
      );

      return;
    }

    if (command === "status") {
      const executed = await catalogSeeder.executed();

      const pending = await catalogSeeder.pending();

      logger.info(
        {
          executed: executed.map((seeder) => seeder.name),

          pending: pending.map((seeder) => seeder.name),
        },
        "Catalog seeder status",
      );

      return;
    }

    throw new Error(`Unknown catalog seed command: ${command}`);
  } catch (error) {
    logger.fatal(
      {
        error: {
          name: error?.name,

          message: error?.message,

          stack: error?.stack,
        },
      },
      "Catalog seeder command failed",
    );

    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

await run();
