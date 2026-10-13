import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  repository: {
    createBrand: vi.fn(),
    destroyBrand: vi.fn(),
    findBrandByCode: vi.fn(),
    findBrandById: vi.fn(),
    findBrandBySlug: vi.fn(),
    findBrandDependencies: vi.fn(),
    findBrands: vi.fn(),
    updateBrand: vi.fn(),
  },
  storage: {
    deleteStoredMedia: vi.fn(),
    getMediaUrl: vi.fn(),
    uploadProcessedImage: vi.fn(),
  },
  imageProcessor: {
    processImage: vi.fn(),
  },
  buildBrandLogoKey: vi.fn(),
}));

vi.mock(
  "../src/modules/admin-brands/admin-brands.repository.js",
  () => state.repository,
);
vi.mock("../src/services/s3.service.js", () => ({
  buildBrandLogoKey: state.buildBrandLogoKey,
}));
vi.mock("../src/services/media/media-storage.service.js", () => state.storage);
vi.mock("../src/services/media/image-processor.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  processImage: state.imageProcessor.processImage,
}));

import { createAdminBrand } from "../src/modules/admin-brands/admin-brands.service.js";

function brand(overrides = {}) {
  return {
    id: 9,
    code: "modaviva",
    name: "ModaViva",
    slug: "modaviva",
    logoKey: null,
    websiteUrl: "https://modaviva.example",
    isActive: true,
    createdAt: new Date("2026-10-08T00:00:00.000Z"),
    updatedAt: new Date("2026-10-08T00:00:00.000Z"),
    ...overrides,
  };
}

describe("Admin brand service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.repository.findBrandByCode.mockResolvedValue(null);
    state.repository.findBrandBySlug.mockResolvedValue(null);
    state.repository.createBrand.mockResolvedValue(brand());
    state.storage.getMediaUrl.mockReturnValue(
      "https://api.example/api/v1/media/opaque-token",
    );
  });

  it("creates a logo-less brand with an active default and a standard DTO", async () => {
    const result = await createAdminBrand({
      payload: {
        code: "modaviva",
        name: "ModaViva",
        slug: "modaviva",
        websiteUrl: "https://modaviva.example",
      },
      file: null,
    });

    expect(state.repository.createBrand).toHaveBeenCalledWith({
      code: "modaviva",
      name: "ModaViva",
      slug: "modaviva",
      websiteUrl: "https://modaviva.example",
      isActive: true,
    });
    expect(result).toMatchObject({
      id: "9",
      code: "modaviva",
      isActive: true,
      logoUrl: null,
    });
  });

  it("rejects a duplicate code before creating a brand", async () => {
    state.repository.findBrandByCode.mockResolvedValue(brand());

    await expect(
      createAdminBrand({
        payload: {
          code: "modaviva",
          name: "Another brand",
          slug: "another-brand",
        },
        file: null,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BRAND_CODE_EXISTS",
    });

    expect(state.repository.createBrand).not.toHaveBeenCalled();
  });
});
