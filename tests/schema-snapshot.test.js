import { describe, expect, it, vi } from "vitest";

import { writeSchemaSnapshot } from "../src/database/schema-snapshot.js";

describe("schema snapshot", () => {
  it("writes deterministic application-table DDL without seed metadata", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { tableName: "SequelizeMeta" },
        { tableName: "accounts" },
        { tableName: "products" },
      ])
      .mockResolvedValueOnce([
        {
          Table: "accounts",
          "Create Table": "CREATE TABLE `accounts` (\\n  `id` bigint NOT NULL AUTO_INCREMENT\\n) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4",
        },
      ])
      .mockResolvedValueOnce([
        {
          Table: "products",
          "Create Table": "CREATE TABLE `products` (\\n  `id` bigint NOT NULL AUTO_INCREMENT\\n) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4",
        },
      ]);
    const makeDirectory = vi.fn();
    const writeFile = vi.fn();

    const result = await writeSchemaSnapshot({
      query,
      outputPath: "D:/tmp/schema.latest.sql",
      makeDirectory,
      writeFile,
    });

    const [, snapshot] = writeFile.mock.calls[0];

    expect(result).toEqual({
      outputPath: "D:/tmp/schema.latest.sql",
      tableCount: 2,
      tables: ["accounts", "products"],
    });
    expect(snapshot).toContain("CREATE TABLE `accounts`");
    expect(snapshot).toContain("CREATE TABLE `products`");
    expect(snapshot).not.toContain("SequelizeMeta");
    expect(snapshot).not.toMatch(/AUTO_INCREMENT=\\d+/);
    expect(makeDirectory).toHaveBeenCalledWith("D:/tmp", { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      "D:/tmp/schema.latest.sql",
      expect.any(String),
      "utf8",
    );
  });
});
