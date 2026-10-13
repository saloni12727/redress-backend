import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const testEnvironmentFile = path.join(projectRoot, ".env.test");

if (!fs.existsSync(testEnvironmentFile)) {
  throw new Error(
    `Test server requires ${testEnvironmentFile}. Configure it with isolated test services before startup.`,
  );
}

const result = dotenv.config({
  path: testEnvironmentFile,
  override: true,
  quiet: true,
});

if (result.error) {
  throw new Error(
    `Unable to load the test environment file: ${result.error.message}`,
  );
}

process.env.NODE_ENV = "test";

// Importing server.js alone does not start it: its direct-execution guard only
// runs when `node src/server.js` is the entry point. This script is the entry
// point for the persistent test API, so explicitly start the application here.
const { registerProcessHandlers, startServer } = await import("../server.js");

registerProcessHandlers();

try {
  await startServer();
} catch (error) {
  // Keep the failed startup visible to PM2, which will apply its restart policy.
  console.error("Test API server startup failed.", error);
  process.exitCode = 1;
}
