import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  buildProductImageKey: vi.fn(
    (productCode, slot) =>
      `products/${productCode.toLowerCase()}/${slot}.webp`,
  ),
}));

vi.mock("../src/services/s3.service.js", () => storage);

import { up } from "../src/database/seeders/demo/202610060001-repair-demo-product-media.seeder.js";

describe("demo product-media repair seeder", () => {
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

  it("repairs only the legacy keys with supplied image assets", async () => {
    await up({ context: { sequelize } });

    expect(storage.buildProductImageKey).toHaveBeenCalledTimes(12);
    expect(sequelize.query).toHaveBeenCalledTimes(13);
    expect(transaction.commit).toHaveBeenCalledOnce();
    expect(transaction.rollback).not.toHaveBeenCalled();

    const firstRepair = sequelize.query.mock.calls[0][1].replacements;
    expect(firstRepair).toMatchObject({
      productCode: "RD-W-DRESS-001",
      legacyStorageKey: "demo/products/floral-midi-dress/main.webp",
      storageKey: "products/rd-w-dress-001/main.webp",
    });

    const hideBrokenMedia = sequelize.query.mock.calls.at(-1)[1].replacements;
    expect(hideBrokenMedia.productCodes).toEqual([
      "RD-W-TOP-001",
      "RD-M-JEANS-001",
      "RD-M-SHOE-001",
      "RD-B-TSHIRT-001",
      "RD-W-SKIRT-001",
      "RD-M-JACKET-001",
    ]);
  });
});
