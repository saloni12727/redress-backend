import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  repository: {
    countAttributeValues: vi.fn(),
    createAttribute: vi.fn(),
    createAttributeValue: vi.fn(),
    createCategoryAttribute: vi.fn(),
    createColor: vi.fn(),
    createFitProfile: vi.fn(),
    createSize: vi.fn(),
    createSizeSystem: vi.fn(),
    destroyRecord: vi.fn(),
    findAttributeByCode: vi.fn(),
    findAttributeById: vi.fn(),
    findAttributeValueByAttributeAndCode: vi.fn(),
    findAttributeValueById: vi.fn(),
    findCategoryAttributeById: vi.fn(),
    findCategoryAttributeByPair: vi.fn(),
    findCategoryById: vi.fn(),
    findColorByCode: vi.fn(),
    findColorById: vi.fn(),
    findDependencies: vi.fn(),
    findFitProfileByCode: vi.fn(),
    findFitProfileById: vi.fn(),
    findSizeById: vi.fn(),
    findSizeBySystemAndCode: vi.fn(),
    findSizeSystemByCode: vi.fn(),
    findSizeSystemById: vi.fn(),
    updateRecord: vi.fn(),
  },
}));

vi.mock(
  "../src/modules/admin-catalog/admin-catalog.repository.js",
  () => state.repository,
);

import {
  createAdminAttribute,
  createAdminAttributeValue,
  createAdminCategoryAttribute,
  deleteAdminColor,
} from "../src/modules/admin-catalog/admin-catalog.service.js";

function record(overrides = {}) {
  return {
    id: 1,
    isActive: true,
    dataType: "option",
    inputType: "select",
    allowsMultiple: false,
    ...overrides,
  };
}

describe("Admin catalog service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.repository.findAttributeByCode.mockResolvedValue(null);
    state.repository.findAttributeById.mockResolvedValue(record());
    state.repository.findAttributeValueByAttributeAndCode.mockResolvedValue(null);
    state.repository.findCategoryAttributeByPair.mockResolvedValue(null);
    state.repository.findCategoryById.mockResolvedValue(record());
    state.repository.findColorById.mockResolvedValue(record({ code: "black" }));
    state.repository.findDependencies.mockResolvedValue({ productVariantCount: 0 });
  });

  it("rejects an incompatible attribute input configuration before persistence", async () => {
    await expect(
      createAdminAttribute({
        code: "material",
        nameEn: "Material",
        nameIt: "Materiale",
        dataType: "option",
        inputType: "select",
        allowsMultiple: true,
      }),
    ).rejects.toMatchObject({
      code: "ATTRIBUTE_MULTIPLE_VALUES_INVALID",
      statusCode: 422,
    });

    expect(state.repository.createAttribute).not.toHaveBeenCalled();
  });

  it("allows values only for option attributes", async () => {
    state.repository.findAttributeById.mockResolvedValue(
      record({ dataType: "text" }),
    );

    await expect(
      createAdminAttributeValue({
        attributeId: 1,
        code: "cotton",
        labelEn: "Cotton",
        labelIt: "Cotone",
      }),
    ).rejects.toMatchObject({
      code: "ATTRIBUTE_VALUES_NOT_SUPPORTED",
      statusCode: 422,
    });

    expect(state.repository.createAttributeValue).not.toHaveBeenCalled();
  });

  it("requires a single-select option attribute for a variant mapping", async () => {
    state.repository.findAttributeById.mockResolvedValue(
      record({ allowsMultiple: true }),
    );

    await expect(
      createAdminCategoryAttribute({
        categoryId: 5,
        attributeId: 1,
        isVariantAttribute: true,
      }),
    ).rejects.toMatchObject({
      code: "CATEGORY_ATTRIBUTE_VARIANT_INVALID",
      statusCode: 422,
    });

    expect(state.repository.createCategoryAttribute).not.toHaveBeenCalled();
  });

  it("does not delete a color used by product variants", async () => {
    state.repository.findDependencies.mockResolvedValue({
      productVariantCount: 1,
    });

    await expect(deleteAdminColor(1)).rejects.toMatchObject({
      code: "COLOR_HAS_DEPENDENCIES",
      statusCode: 409,
    });

    expect(state.repository.destroyRecord).not.toHaveBeenCalled();
  });
});
