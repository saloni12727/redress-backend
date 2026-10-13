import { connectDatabase, disconnectDatabase } from "../config/database.js";

import { logger } from "../config/logger.js";

import { demoSeeder } from "./demo-seeder.js";

function ensureDemoSeedAllowed() {
  /*
   * Development is allowed automatically.
   *
   * If UAT runs with NODE_ENV=production,
   * explicitly set:
   *
   * ALLOW_DEMO_SEED=true
   */

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_SEED !== "true"
  ) {
    throw new Error(
      "Demo seeding is blocked in production. " +
        "Set ALLOW_DEMO_SEED=true only for an approved UAT/demo environment.",
    );
  }
}

async function run() {
  const command = process.argv[2] ?? "up";

  try {
    await connectDatabase();

    if (command === "status") {
      const executed = await demoSeeder.executed();

      const pending = await demoSeeder.pending();

      logger.info(
        {
          executed: executed.map((seeder) => seeder.name),

          pending: pending.map((seeder) => seeder.name),
        },
        "Demo seeder status",
      );

      return;
    }

    ensureDemoSeedAllowed();

    if (command === "up") {
      const seeders = await demoSeeder.up();

      logger.info(
        {
          seeders: seeders.map((seeder) => seeder.name),
        },
        "Demo seeders applied",
      );

      return;
    }

    if (command === "down") {
      const seeders = await demoSeeder.down();

      logger.info(
        {
          seeders: seeders.map((seeder) => seeder.name),
        },
        "Demo seeder rolled back",
      );

      return;
    }

    throw new Error(`Unknown demo seed command: ${command}`);
  } catch (error) {
    logger.fatal(
      {
        error: {
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        },
      },
      "Demo seeder command failed",
    );

    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

await run();
