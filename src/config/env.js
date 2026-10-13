import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { parseEnvironment } from "./env-schema.js";

const filename = fileURLToPath(import.meta.url);
const directory = path.dirname(filename);
const projectRoot = path.resolve(directory, "../..");

const allowedEnvironments = new Set(["development", "test", "production"]);
const selectedEnvironment = process.env.NODE_ENV || "development";

if (!allowedEnvironments.has(selectedEnvironment)) {
  throw new Error(`Unsupported NODE_ENV: ${selectedEnvironment}`);
}

const environmentFile = path.join(projectRoot, `.env.${selectedEnvironment}`);
const fallbackFile = path.join(projectRoot, ".env");

if (fs.existsSync(environmentFile)) {
  dotenv.config({
    path: environmentFile,
    override: false,
    quiet: true,
  });
}

// Production must never inherit missing values from a development fallback.
if (selectedEnvironment !== "production" && fs.existsSync(fallbackFile)) {
  dotenv.config({
    path: fallbackFile,
    override: false,
    quiet: true,
  });
}

export const env = parseEnvironment({
  ...process.env,
  NODE_ENV: selectedEnvironment,
});
