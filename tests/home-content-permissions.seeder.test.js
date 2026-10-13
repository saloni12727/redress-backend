import { describe, expect, it, vi } from "vitest";

import { up } from "../src/database/seeders/core/202610070006-home-content-permissions.seeder.js";

describe("Home content permissions seeder", () => {
  it("adds missing permissions and grants all of them to Super Admin", async () => {
    const transaction = {
      commit: vi.fn(),
      rollback: vi.fn(),
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 101, code: "platform.home_content.view" },
        { id: 102, code: "platform.home_content.create" },
        { id: 103, code: "platform.home_content.update" },
        { id: 104, code: "platform.home_content.publish" },
        { id: 105, code: "platform.home_content.delete" },
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
        "platform.home_content.view",
        "platform.home_content.create",
        "platform.home_content.update",
        "platform.home_content.publish",
        "platform.home_content.delete",
      ]),
    );
    expect(insertedAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role_id: 7, permission_id: 101 }),
        expect.objectContaining({ role_id: 7, permission_id: 105 }),
      ]),
    );
    expect(transaction.commit).toHaveBeenCalledOnce();
  });
});
