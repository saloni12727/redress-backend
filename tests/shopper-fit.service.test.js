import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  transaction: null,
  profile: null,
  sequelize: {
    transaction: vi.fn(),
    literal: vi.fn(),
  },
  Account: {
    update: vi.fn(),
  },
  BodyProfile: {
    findOne: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  ShopperMedia: {
    findAll: vi.fn(),
  },
}));

vi.mock("../src/config/database.js", () => ({
  sequelize: state.sequelize,
}));

vi.mock("../src/config/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../src/config/media.config.js", () => ({
  getImageUploadPolicy: vi.fn(),
}));

vi.mock("../src/models/index.js", () => ({
  Account: state.Account,
  BodyProfile: state.BodyProfile,
  ShopperMedia: state.ShopperMedia,
}));

vi.mock("../src/services/media-url.service.js", () => ({
  resolveMediaUrlToken: vi.fn(),
}));

vi.mock("../src/services/media/media-storage.service.js", () => ({
  deleteStoredMedia: vi.fn(),
  getMediaUrl: vi.fn(),
  processAndUploadImage: vi.fn(),
}));

vi.mock("../src/services/media/image-processor.service.js", () => ({
  MediaValidationError: class MediaValidationError extends Error {},
  processImage: vi.fn(),
}));

vi.mock("../src/services/s3.service.js", () => ({
  buildBodyPhotoKey: vi.fn(),
}));

import {
  deleteBodyProfile,
  updateBodyProfile,
} from "../src/modules/shopper-fit/shopper-fit.service.js";

function makeProfile(relation) {
  return {
    id: 15,
    accountId: 9,
    name: "Family member",
    relation,
    isDefault: false,
    sex: null,
    heightCm: 170,
    weightKg: 60,
    shouldersCm: null,
    chestCm: null,
    waistCm: null,
    hipsCm: null,
    inseamCm: null,
    armLengthCm: null,
    shoeEu: null,
    footLengthCm: null,
    frontMediaId: null,
    backMediaId: null,
    leftMediaId: null,
    rightMediaId: null,
    avatarMediaId: null,
    stylist: null,
    updatedAt: new Date("2026-10-09T10:00:00.000Z"),
    update: vi.fn(async function update(values) {
      Object.assign(this, values);
    }),
    destroy: vi.fn(),
  };
}

describe("shopper fit profile relation updates and deletion", () => {
  beforeEach(() => {
    state.transaction = {
      finished: false,
      LOCK: { UPDATE: "UPDATE" },
      commit: vi.fn(async () => {
        state.transaction.finished = "commit";
      }),
      rollback: vi.fn(async () => {
        state.transaction.finished = "rollback";
      }),
    };
    state.profile = makeProfile("partner");
    state.sequelize.transaction.mockReset().mockResolvedValue(state.transaction);
    state.BodyProfile.findOne.mockReset().mockImplementation(async () => state.profile);
    state.BodyProfile.count.mockReset().mockResolvedValue(2);
    state.BodyProfile.update.mockReset();
    state.ShopperMedia.findAll.mockReset().mockResolvedValue([]);
    state.Account.update.mockReset();
  });

  it.each(["partner", "child", "other"])(
    "allows a non-self profile to change relation to %s",
    async (relation) => {
      const result = await updateBodyProfile({
        accountId: 9,
        profileId: 15,
        payload: { relation },
      });

      expect(state.profile.update).toHaveBeenCalledWith(
        { relation },
        { transaction: state.transaction },
      );
      expect(result.relation).toBe(relation);
      expect(state.transaction.commit).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["self", "child"],
    ["partner", "self"],
  ])(
    "rejects changing relation from %s to %s",
    async (currentRelation, requestedRelation) => {
      state.profile = makeProfile(currentRelation);

      await expect(
        updateBodyProfile({
          accountId: 9,
          profileId: 15,
          payload: { relation: requestedRelation },
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        details: {
          fields: { relation: "immutable" },
        },
      });

      expect(state.profile.update).not.toHaveBeenCalled();
      expect(state.transaction.rollback).toHaveBeenCalledOnce();
    },
  );

  it("deletes a family profile and keeps the self profile protected", async () => {
    await deleteBodyProfile({ accountId: 9, profileId: 15 });

    expect(state.profile.destroy).toHaveBeenCalledWith({
      transaction: state.transaction,
    });
    expect(state.transaction.commit).toHaveBeenCalledOnce();

    state.profile = makeProfile("self");
    await expect(
      deleteBodyProfile({ accountId: 9, profileId: 15 }),
    ).rejects.toMatchObject({
      statusCode: 422,
      details: { reason: "self_required" },
    });
    expect(state.profile.destroy).not.toHaveBeenCalled();
  });
});
