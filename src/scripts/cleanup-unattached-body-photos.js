import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";
import { cleanupUnattachedBodyPhotos } from "../modules/shopper-fit/shopper-fit.service.js";
import { safeErrorForLog } from "../utils/safe-error.js";

let connected = false;
try {
  await connectDatabase();
  connected = true;
  const result = await cleanupUnattachedBodyPhotos();
  logger.info({ component: "body-photo-cleanup", ...result }, "Unattached body-photo cleanup completed.");
} catch (error) {
  logger.error(
    { component: "body-photo-cleanup", error: safeErrorForLog(error) },
    "Unattached body-photo cleanup failed.",
  );
  process.exitCode = 1;
} finally {
  if (connected) await disconnectDatabase();
}
