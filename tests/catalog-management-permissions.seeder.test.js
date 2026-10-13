import { describe, expect, it, vi } from "vitest";

import { up } from "../src/database/seeders/core/202610080007-catalog-management-permissions.seeder.js";

describe("Catalog management permissions seeder", () => {
  it("adds catalog permissions and grants them to Super Admin", async () => {
    const transaction = { commit: vi.fn(), rollback: vi.fn() };
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 201, code: "platform.catalog.view" },
        { id: 202, code: "platform.catalog.create" },
        { id: 203, code: "platform.catalog.update" },
        { id: 204, code: "platform.catalog.delete" },
      ])
      .mockResolvedValueOnce([{ id: 7 }])
      .mockResolvedValueOnce([]);
    const queryInterface = {
      sequelize: {
        transaction: vi.fn().mockResolvedValue(transaction),
        query,
      },
      bulkInsert: vi.fn(),
    };

    await up({ context: queryInterface });

    const [, insertedPermissions] = queryInterface.bulkInsert.mock.calls[0];
    const [, insertedAssignments] = queryInterface.bulkInsert.mock.calls[1];

    expect(insertedPermissions.map((permission) => permission.code)).toEqual(
      expect.arrayContaining([
        "platform.catalog.view",
        "platform.catalog.create",
        "platform.catalog.update",
        "platform.catalog.delete",
      ]),
    );
    expect(insertedAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role_id: 7, permission_id: 201 }),
        expect.objectContaining({ role_id: 7, permission_id: 204 }),
      ]),
    );
    expect(transaction.commit).toHaveBeenCalledOnce();
  });
});
