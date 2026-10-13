import { z } from "zod";

export const guestSessionSchema = z
  .object({
    installationId: z.string().uuid().optional(),

    platform: z.enum(["android", "ios", "web"]).optional(),

    appVersion: z.string().trim().min(1).max(50).optional(),

    locale: z.enum(["it", "en"]).optional(),
  })
  .strict();
