import { beforeEach, describe, expect, it, vi } from "vitest";

import { Op } from "sequelize";

const state = vi.hoisted(() => ({
  findAndCountAll: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../src/models/home-placement.model.js", () => ({
  default: {
    findAndCountAll: state.findAndCountAll,

    findOne: vi.fn(),

    create: vi.fn(),
  },
}));

vi.mock("../src/config/database.js", () => ({
  sequelize: {
    query: state.query,
  },
}));

import { findPlacements } from "../src/modules/admin-home/admin-home.repository.js";

describe("Admin Home repository listing filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    state.findAndCountAll.mockResolvedValue({
      rows: [],
      count: 0,
    });
  });

  it("returns only placements that are currently live for status=live", async () => {
    await findPlacements({
      page: 1,

      limit: 20,

      status: "live",

      sectionKey: undefined,

      startsBefore: undefined,

      endsAfter: undefined,
    });

    const options = state.findAndCountAll.mock.calls[0][0];

    const { where } = options;

    expect(where.source).toBe("admin");

    expect(where.status).toBe("live");

    expect(where[Op.and]).toHaveLength(2);

    const startWindow = where[Op.and][0][Op.or];

    const endWindow = where[Op.and][1][Op.or];

    expect(startWindow[0]).toEqual({
      startsAt: null,
    });

    expect(startWindow[1].startsAt[Op.lte]).toBeInstanceOf(Date);

    expect(endWindow[0]).toEqual({
      endsAt: null,
    });

    expect(endWindow[1].endsAt[Op.gt]).toBeInstanceOf(Date);
  });

  it("keeps scheduled and expired as separate effective-status filters", async () => {
    await findPlacements({
      page: 1,

      limit: 20,

      status: "scheduled",

      sectionKey: undefined,

      startsBefore: undefined,

      endsAfter: undefined,
    });

    let where = state.findAndCountAll.mock.calls[0][0].where;

    expect(where.status).toBe("live");

    expect(where.startsAt[Op.gt]).toBeInstanceOf(Date);

    state.findAndCountAll.mockClear();

    await findPlacements({
      page: 1,

      limit: 20,

      status: "expired",

      sectionKey: undefined,

      startsBefore: undefined,

      endsAfter: undefined,
    });

    where = state.findAndCountAll.mock.calls[0][0].where;

    expect(where.status).toBe("live");

    expect(where.endsAt[Op.lte]).toBeInstanceOf(Date);
  });
});
