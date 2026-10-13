import { connectDatabase, disconnectDatabase } from "../config/database.js";

import { logger } from "../config/logger.js";

import { safeErrorForLog } from "../utils/safe-error.js";

import { coreSeeder } from "./seeder.js";

/*
|--------------------------------------------------------------------------
| Seeder Command
|--------------------------------------------------------------------------
|
| Supported:
|
| up
| down
| status
|
*/

const command = process.argv[2] || "status";

/*
|--------------------------------------------------------------------------
| Run
|--------------------------------------------------------------------------
*/

async function run() {
  await connectDatabase();

  try {
    /*
    |--------------------------------------------------------------------------
    | UP
    |--------------------------------------------------------------------------
    */

    if (command === "up") {
      const seeders = await coreSeeder.up();

      logger.info(
        {
          seeders: seeders.map((seeder) => seeder.name),
        },

        "Core seeders applied",
      );

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | DOWN
    |--------------------------------------------------------------------------
    |
    | Reverts only the latest executed core seeder.
    |
    */

    if (command === "down") {
      const seeders = await coreSeeder.down();

      logger.info(
        {
          seeders: seeders.map((seeder) => seeder.name),
        },

        "Core seeder reverted",
      );

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | STATUS
    |--------------------------------------------------------------------------
    */

    if (command === "status") {
      const [executed, pending] = await Promise.all([
        coreSeeder.executed(),

        coreSeeder.pending(),
      ]);

      logger.info(
        {
          executed: executed.map((seeder) => seeder.name),

          pending: pending.map((seeder) => seeder.name),
        },

        "Core seeder status",
      );

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Invalid Command
    |--------------------------------------------------------------------------
    */

    throw new Error(`Unsupported seeder command: ${command}`);
  } finally {
    await disconnectDatabase();
  }
}

/*
|--------------------------------------------------------------------------
| Execute
|--------------------------------------------------------------------------
*/

run().catch((error) => {
  logger.fatal(
    {
      error: safeErrorForLog(error, {
        includeStack: true,
      }),
    },

    "Core seeder command failed",
  );

  process.exitCode = 1;
});
