import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  repository: {
    countActiveChildren: vi.fn(),
    createCategory: vi.fn(),
    deleteCategory: vi.fn(),
    findCategories: vi.fn(),
    findCategoryByCode: vi.fn(),
    findCategoryById: vi.fn(),
    findCategoryBySlug: vi.fn(),
    findCategoryRecordById: vi.fn(),
    findDeleteDependencies: vi.fn(),
    isCategoryDescendant: vi.fn(),
    updateCategory: vi.fn(),
    upsertCategoryTranslations: vi.fn(),
    withTransaction: vi.fn(),
  },
}));

vi.mock(
  "../src/modules/admin-categories/admin-categories.repository.js",
  () => state.repository,
);

import {
  createAdminCategory,
  deleteAdminCategory,
  updateAdminCategory,
} from "../src/modules/admin-categories/admin-categories.service.js";

function categoryRow(overrides = {}) {
  return {
    id: 11,
    parentId: null,
    code: "women_dresses",
    slug: "women-dresses",
    nameEn: "Dresses",
    nameIt: "Vestiti",
    descriptionEn: null,
    descriptionIt: null,
    sortOrder: 3,
    isActive: 1,
    parentCategoryId: null,
    parentCode: null,
    parentSlug: null,
    parentNameEn: null,
    parentNameIt: null,
    childCount: 0,
    productCount: 0,
    createdAt: new Date("2026-10-08T00:00:00.000Z"),
    updatedAt: new Date("2026-10-08T00:00:00.000Z"),
    ...overrides,
  };
}

function categoryRecord(overrides = {}) {
  return {
    id: 11,
    parentId: null,
    isActive: true,
    ...overrides,
  };
}

describe("Admin category service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    state.repository.withTransaction.mockImplementation((work) =>
      work({ id: "transaction" }),
    );
    state.repository.findCategoryByCode.mockResolvedValue(null);
    state.repository.findCategoryBySlug.mockResolvedValue(null);
    state.repository.findCategoryById.mockResolvedValue(categoryRow());
    state.repository.findCategoryRecordById.mockResolvedValue(categoryRecord());
    state.repository.countActiveChildren.mockResolvedValue(0);
    state.repository.isCategoryDescendant.mockResolvedValue(false);
    state.repository.findDeleteDependencies.mockResolvedValue({
      childCount: 0,
      productCount: 0,
      homePlacementCount: 0,
      attributeCount: 0,
      measurementCount: 0,
    });
    state.repository.createCategory.mockResolvedValue({ id: 11 });
  });

  it("creates both localized translations and returns the standard category DTO", async () => {
    const result = await createAdminCategory({
      code: "women_dresses",
      slug: "women-dresses",
      nameEn: "Dresses",
      nameIt: "Vestiti",
      descriptionEn: "Everyday dresses.",
      descriptionIt: "Vestiti per tutti i giorni.",
      sortOrder: 3,
    });

    expect(state.repository.createCategory).toHaveBeenCalledWith(
      {
        parentId: null,
        code: "women_dresses",
        slug: "women-dresses",
        sortOrder: 3,
        isActive: true,
      },
      { transaction: { id: "transaction" } },
    );
    expect(state.repository.upsertCategoryTranslations).toHaveBeenCalledWith(
      11,
      {
        en: {
          name: "Dresses",
          description: "Everyday dresses.",
        },
        it: {
          name: "Vestiti",
          description: "Vestiti per tutti i giorni.",
        },
      },
      { transaction: { id: "transaction" } },
    );
    expect(result).toMatchObject({
      id: "11",
      code: "women_dresses",
      nameEn: "Dresses",
      isActive: true,
      childCount: 0,
      productCount: 0,
    });
  });

  it("rejects moving a category beneath one of its descendants", async () => {
    state.repository.findCategoryRecordById.mockImplementation((id) =>
      Promise.resolve(categoryRecord({ id, parentId: null })),
    );
    state.repository.isCategoryDescendant.mockResolvedValue(true);

    await expect(
      updateAdminCategory(11, {
        parentId: 12,
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "CATEGORY_CYCLIC_PARENT",
    });

    expect(state.repository.updateCategory).not.toHaveBeenCalled();
  });

  it("does not delete a category that is still used by related records", async () => {
    state.repository.findDeleteDependencies.mockResolvedValue({
      childCount: 0,
      productCount: 2,
      homePlacementCount: 0,
      attributeCount: 0,
      measurementCount: 0,
    });

    await expect(deleteAdminCategory(11)).rejects.toMatchObject({
      statusCode: 409,
      code: "CATEGORY_HAS_DEPENDENCIES",
    });

    expect(state.repository.deleteCategory).not.toHaveBeenCalled();
  });
});
