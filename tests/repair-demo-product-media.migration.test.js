import { beforeEach, describe, expect, it, vi } from "vitest";

import { up } from "../src/database/migrations/202610060041-repair-demo-product-media-keys.js";

describe("repair demo product-media migration", () => {
  const transaction = {
    commit: vi.fn(),
    rollback: vi.fn(),
  };

  const sequelize = {
    transaction: vi.fn(async () => transaction),
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repairs production media without requiring the demo seeder", async () => {
    await up({ context: { sequelize } });

    expect(sequelize.query).toHaveBeenCalledTimes(13);
    expect(transaction.commit).toHaveBeenCalledOnce();
    expect(transaction.rollback).not.toHaveBeenCalled();

    expect(sequelize.query.mock.calls[0][1].replacements).toMatchObject({
      productCode: "RD-W-DRESS-001",
      legacyStorageKey: "demo/products/floral-midi-dress/main.webp",
      storageKey: "products/rd-w-dress-001/main.webp",
    });

    expect(sequelize.query.mock.calls.at(-1)[1].replacements.productCodes).toEqual([
      "RD-W-TOP-001",
      "RD-M-JEANS-001",
      "RD-M-SHOE-001",
      "RD-B-TSHIRT-001",
      "RD-W-SKIRT-001",
      "RD-M-JACKET-001",
    ]);
  });
});
