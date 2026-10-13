import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  class MediaValidationError extends Error {}

  return {
    MediaValidationError,

    repository: {
      catalogFilterReferencesAreValid: vi.fn(),

      createPlacement: vi.fn(),

      destroyPlacement: vi.fn(),

      findActiveBrand: vi.fn(),

      findActiveCategory: vi.fn(),

      findPlacementById: vi.fn(),

      findPublishableProduct: vi.fn(),

      updatePlacement: vi.fn(),
    },

    storage: {
      deleteStoredMedia: vi.fn(),

      getMediaUrl: vi.fn(),

      uploadProcessedImage: vi.fn(),
    },

    imageProcessor: {
      processImage: vi.fn(),
    },

    logger: {
      error: vi.fn(),
      warn: vi.fn(),
    },

    buildMediaObjectKey: vi.fn(),
  };
});

vi.mock(
  "../src/modules/admin-home/admin-home.repository.js",
  () => state.repository,
);

vi.mock("../src/services/s3.service.js", () => ({
  buildMediaObjectKey: state.buildMediaObjectKey,
}));

vi.mock("../src/services/media/media-storage.service.js", () => state.storage);

vi.mock("../src/services/media/image-processor.service.js", () => ({
  MediaValidationError: state.MediaValidationError,

  processImage: state.imageProcessor.processImage,
}));

vi.mock("../src/config/logger.js", () => ({
  logger: state.logger,
}));

import {
  archiveHomePlacement,
  createHomePlacement,
  deleteHomePlacement,
  publishHomePlacement,
  updateHomePlacement,
} from "../src/modules/admin-home/admin-home.service.js";

function placement(overrides = {}) {
  return {
    id: 101,

    sectionKey: "hero",

    targetType: "product",

    targetProductId: 41,

    targetBrandId: null,

    targetCategoryId: null,

    targetFilters: null,

    imageStorageKey: "home/hero/original.webp",

    imageWidth: 1600,

    imageHeight: 900,

    imageContentType: "image/webp",

    imageSizeBytes: 1024,

    titleEn: "Autumn edit",

    titleIt: "Selezione autunnale",

    subtitleEn: "New season styles",

    subtitleIt: "Stili di stagione",

    ctaLabelEn: "Shop now",

    ctaLabelIt: "Acquista ora",

    altTextEn: "Autumn looks",

    altTextIt: "Look autunnali",

    badgeEn: null,

    badgeIt: null,

    discountLabelEn: null,

    discountLabelIt: null,

    startsAt: null,

    endsAt: null,

    sortOrder: 2,

    status: "draft",

    source: "admin",

    createdAt: new Date("2026-10-07T10:00:00.000Z"),

    updatedAt: new Date("2026-10-07T10:00:00.000Z"),

    publishedAt: null,

    createdByAccountId: "7",

    updatedByAccountId: "7",

    publishedByAccountId: null,

    ...overrides,
  };
}

function imageFile() {
  return {
    buffer: Buffer.from("image bytes"),

    claimedMimeType: "image/jpeg",
  };
}

describe("Admin Home placement service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    state.repository.findPublishableProduct.mockResolvedValue({
      id: 41,
    });

    state.repository.findActiveBrand.mockResolvedValue({
      id: 5,
    });

    state.repository.findActiveCategory.mockResolvedValue({
      id: 3,
      slug: "women",
    });

    state.repository.catalogFilterReferencesAreValid.mockResolvedValue(true);

    state.repository.updatePlacement.mockImplementation(
      async (current, values) => Object.assign(current, values),
    );

    state.repository.destroyPlacement.mockResolvedValue(undefined);

    state.buildMediaObjectKey.mockReturnValue("home/hero/new-asset.webp");

    state.imageProcessor.processImage.mockResolvedValue({
      buffer: Buffer.from("optimized image"),

      contentType: "image/webp",

      extension: "webp",

      width: 1600,

      height: 900,

      sizeBytes: 2048,
    });

    state.storage.uploadProcessedImage.mockResolvedValue({
      storageKey: "home/hero/new-asset.webp",

      contentType: "image/webp",

      extension: "webp",

      width: 1600,

      height: 900,

      sizeBytes: 2048,
    });

    state.storage.deleteStoredMedia.mockResolvedValue(true);

    state.storage.getMediaUrl.mockReturnValue(
      "https://api.example/api/v1/media/opaque-token",
    );
  });

  it("creates an admin-owned draft and never publishes it implicitly", async () => {
    state.repository.createPlacement.mockImplementation(async (values) =>
      placement({
        ...values,

        id: 102,

        createdAt: new Date("2026-10-07T11:00:00.000Z"),

        updatedAt: new Date("2026-10-07T11:00:00.000Z"),
      }),
    );

    const result = await createHomePlacement({
      payload: {
        sectionKey: "hero",

        targetType: "product",

        targetProductId: 41,

        altTextEn: "Autumn looks",

        altTextIt: "Look autunnali",

        sortOrder: 4,
      },

      file: imageFile(),

      accountId: "7",
    });

    expect(state.repository.findPublishableProduct).toHaveBeenCalledWith(41);

    expect(state.repository.createPlacement).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "admin",

        status: "draft",

        targetProductId: 41,

        targetBrandId: null,

        imageStorageKey: "home/hero/new-asset.webp",

        createdByAccountId: "7",

        updatedByAccountId: "7",
      }),
    );

    expect(result).toMatchObject({
      id: "102",

      status: "draft",

      storedStatus: "draft",

      target: {
        type: "product",

        productId: "41",
      },
    });
  });

  it("removes a newly uploaded image when draft persistence fails", async () => {
    state.repository.createPlacement.mockRejectedValue(
      new Error("database unavailable"),
    );

    await expect(
      createHomePlacement({
        payload: {
          sectionKey: "hero",

          targetType: "product",

          targetProductId: 41,
        },

        file: imageFile(),

        accountId: "7",
      }),
    ).rejects.toThrow("database unavailable");

    expect(state.storage.deleteStoredMedia).toHaveBeenCalledTimes(1);

    expect(state.storage.deleteStoredMedia).toHaveBeenCalledWith(
      "home/hero/new-asset.webp",
    );
  });

  it("rejects a destination that the selected section cannot use", async () => {
    await expect(
      createHomePlacement({
        payload: {
          sectionKey: "audience",

          targetType: "product",

          targetProductId: 41,
        },

        file: imageFile(),

        accountId: "7",
      }),
    ).rejects.toMatchObject({
      code: "HOME_DESTINATION_NOT_ALLOWED",
    });

    expect(state.imageProcessor.processImage).not.toHaveBeenCalled();

    expect(state.repository.createPlacement).not.toHaveBeenCalled();
  });

  it("allows audience placements to target categories only", async () => {
    await expect(
      createHomePlacement({
        payload: {
          sectionKey: "audience",

          targetType: "catalog",

          targetFilters: {
            category: "women",
          },
        },

        file: imageFile(),

        accountId: "7",
      }),
    ).rejects.toMatchObject({
      code: "HOME_DESTINATION_NOT_ALLOWED",
    });

    expect(state.imageProcessor.processImage).not.toHaveBeenCalled();
  });

  it("allows only Women, Men, or Kids categories for audience placements", async () => {
    state.repository.findActiveCategory.mockResolvedValue({
      id: 12,

      slug: "dresses",
    });

    await expect(
      createHomePlacement({
        payload: {
          sectionKey: "audience",

          targetType: "category",

          targetCategoryId: 12,
        },

        file: imageFile(),

        accountId: "7",
      }),
    ).rejects.toMatchObject({
      code: "HOME_AUDIENCE_CATEGORY_NOT_ALLOWED",
    });

    expect(state.imageProcessor.processImage).not.toHaveBeenCalled();

    expect(state.repository.createPlacement).not.toHaveBeenCalled();
  });

  it("rejects target fields that do not match an existing placement target", async () => {
    state.repository.findPlacementById.mockResolvedValue(placement());

    await expect(
      updateHomePlacement({
        id: 101,

        payload: {
          targetBrandId: 5,
        },

        file: null,

        accountId: "8",
      }),
    ).rejects.toMatchObject({
      code: "HOME_DESTINATION_FIELD_NOT_ALLOWED",
    });

    expect(state.repository.updatePlacement).not.toHaveBeenCalled();
  });

  it("revalidates an existing draft image when its section changes", async () => {
    state.repository.findPlacementById.mockResolvedValue(
      placement({
        sectionKey: "top_brand",

        targetType: "brand",

        targetProductId: null,

        targetBrandId: 5,

        imageWidth: 800,

        imageHeight: 800,
      }),
    );

    await expect(
      updateHomePlacement({
        id: 101,

        payload: {
          sectionKey: "lookbook",
        },

        file: null,

        accountId: "8",
      }),
    ).rejects.toMatchObject({
      code: "HOME_IMAGE_DIMENSIONS_INVALID",
    });

    expect(state.repository.updatePlacement).not.toHaveBeenCalled();
  });

  it("removes a newly uploaded replacement if live-content validation fails", async () => {
    state.repository.findPlacementById.mockResolvedValue(
      placement({
        status: "live",

        ctaLabelIt: null,
      }),
    );

    await expect(
      updateHomePlacement({
        id: 101,

        payload: {
          titleEn: "Updated title",
        },

        file: imageFile(),

        accountId: "8",
      }),
    ).rejects.toMatchObject({
      code: "HOME_LOCALIZED_CONTENT_REQUIRED",
    });

    expect(state.repository.updatePlacement).not.toHaveBeenCalled();

    expect(state.storage.deleteStoredMedia).toHaveBeenCalledTimes(1);

    expect(state.storage.deleteStoredMedia).toHaveBeenCalledWith(
      "home/hero/new-asset.webp",
    );

    expect(state.storage.deleteStoredMedia).not.toHaveBeenCalledWith(
      "home/hero/original.webp",
    );
  });

  it("keeps the new S3 image after a successful update and removes only the superseded image", async () => {
    const draft = placement();

    state.repository.findPlacementById.mockResolvedValue(draft);

    const result = await updateHomePlacement({
      id: 101,

      payload: {
        titleEn: "Updated title",
      },

      file: imageFile(),

      accountId: "8",
    });

    expect(state.repository.updatePlacement).toHaveBeenCalledTimes(1);

    expect(state.storage.deleteStoredMedia).toHaveBeenCalledTimes(1);

    expect(state.storage.deleteStoredMedia).toHaveBeenCalledWith(
      "home/hero/original.webp",
    );

    expect(result.image).toMatchObject({
      width: 1600,

      height: 900,

      contentType: "image/webp",
    });
  });

  it("publishes only a complete draft and records the publishing admin", async () => {
    const draft = placement();

    state.repository.findPlacementById.mockResolvedValue(draft);

    const result = await publishHomePlacement({
      id: 101,

      accountId: "9",
    });

    expect(state.repository.updatePlacement).toHaveBeenCalledWith(
      draft,

      expect.objectContaining({
        status: "live",

        publishedByAccountId: "9",

        updatedByAccountId: "9",

        publishedAt: expect.any(Date),
      }),
    );

    expect(result).toMatchObject({
      status: "live",

      storedStatus: "live",

      audit: {
        publishedByAccountId: "9",
      },
    });
  });

  it("does not publish a draft whose end date has already passed", async () => {
    const draft = placement({
      startsAt: new Date(Date.now() - 120_000),

      endsAt: new Date(Date.now() - 60_000),
    });

    state.repository.findPlacementById.mockResolvedValue(draft);

    await expect(
      publishHomePlacement({
        id: 101,

        accountId: "9",
      }),
    ).rejects.toMatchObject({
      code: "HOME_PUBLISH_WINDOW_EXPIRED",
    });

    expect(state.repository.updatePlacement).not.toHaveBeenCalled();
  });

  it("does not republish archived or live content and only deletes non-live content", async () => {
    state.repository.findPlacementById.mockResolvedValue(
      placement({
        status: "live",
      }),
    );

    await expect(
      publishHomePlacement({
        id: 101,

        accountId: "9",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,

      code: "HOME_PLACEMENT_NOT_DRAFT",
    });

    await expect(
      deleteHomePlacement({
        id: 101,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,

      code: "HOME_PLACEMENT_MUST_BE_ARCHIVED",
    });

    const archived = placement({
      status: "archived",
    });

    state.repository.findPlacementById.mockResolvedValue(archived);

    await deleteHomePlacement({
      id: 101,
    });

    expect(state.repository.destroyPlacement).toHaveBeenCalledWith(archived);

    expect(state.storage.deleteStoredMedia).toHaveBeenCalledWith(
      "home/hero/original.webp",
    );
  });

  it("keeps deletion successful if S3 cleanup fails after the DB record is deleted", async () => {
    const archived = placement({
      status: "archived",
    });

    state.repository.findPlacementById.mockResolvedValue(archived);

    state.storage.deleteStoredMedia.mockRejectedValue(
      new Error("temporary S3 failure"),
    );

    await expect(
      deleteHomePlacement({
        id: 101,
      }),
    ).resolves.toBeUndefined();

    expect(state.repository.destroyPlacement).toHaveBeenCalledWith(archived);

    expect(state.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        storageKey: "home/hero/original.webp",
      }),
      "Failed to remove deleted Home placement image",
    );
  });

  it("archives a draft or live placement without deleting its image or audit history", async () => {
    const draft = placement();

    state.repository.findPlacementById.mockResolvedValue(draft);

    const result = await archiveHomePlacement({
      id: 101,

      accountId: "9",
    });

    expect(state.repository.updatePlacement).toHaveBeenCalledWith(draft, {
      status: "archived",

      updatedByAccountId: "9",
    });

    expect(state.storage.deleteStoredMedia).not.toHaveBeenCalled();

    expect(result).toMatchObject({
      status: "archived",

      storedStatus: "archived",
    });
  });
});
