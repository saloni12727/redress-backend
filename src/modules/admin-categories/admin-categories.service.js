import { AdminCategoryError, categoryNotFound } from "./admin-categories.error.js";
import * as repository from "./admin-categories.repository.js";

function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function toPlain(value) {
  return typeof value?.get === "function" ? value.get({ plain: true }) : value;
}

function id(value) {
  return value === null || value === undefined ? null : String(value);
}

function boolean(value) {
  return value === true || value === 1 || value === "1";
}

function isoDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function categoryDto(input) {
  const category = toPlain(input);

  return {
    id: id(category.id),
    parentId: id(category.parentId),
    code: category.code,
    slug: category.slug,
    nameEn: category.nameEn,
    nameIt: category.nameIt,
    descriptionEn: category.descriptionEn ?? null,
    descriptionIt: category.descriptionIt ?? null,
    sortOrder: Number(category.sortOrder ?? 0),
    isActive: boolean(category.isActive),
    parent:
      category.parentCategoryId === null ||
      category.parentCategoryId === undefined
        ? null
        : {
            id: id(category.parentCategoryId),
            code: category.parentCode,
            slug: category.parentSlug,
            nameEn: category.parentNameEn ?? null,
            nameIt: category.parentNameIt ?? null,
          },
    childCount: Number(category.childCount ?? 0),
    productCount: Number(category.productCount ?? 0),
    createdAt: isoDate(category.createdAt),
    updatedAt: isoDate(category.updatedAt),
  };
}

function invalidCategory(message, options = {}) {
  return new AdminCategoryError(message, options);
}

function duplicateCodeError() {
  return invalidCategory("The category code is already in use.", {
    statusCode: 409,
    code: "CATEGORY_CODE_EXISTS",
  });
}

function duplicateSlugError() {
  return invalidCategory("The category slug is already in use.", {
    statusCode: 409,
    code: "CATEGORY_SLUG_EXISTS",
  });
}

async function assertUniqueIdentity({ code, slug, excludeId, transaction }) {
  if (code !== undefined) {
    const existingCode = await repository.findCategoryByCode(code, {
      excludeId,
      transaction,
    });

    if (existingCode) {
      throw duplicateCodeError();
    }
  }

  if (slug !== undefined) {
    const existingSlug = await repository.findCategoryBySlug(slug, {
      excludeId,
      transaction,
    });

    if (existingSlug) {
      throw duplicateSlugError();
    }
  }
}

async function getParent(parentId, { transaction } = {}) {
  if (parentId === null || parentId === undefined) {
    return null;
  }

  const parent = await repository.findCategoryRecordById(parentId, {
    transaction,
    lock: true,
  });

  if (!parent) {
    throw invalidCategory("The selected parent category could not be found.", {
      statusCode: 422,
      code: "CATEGORY_PARENT_NOT_FOUND",
    });
  }

  return toPlain(parent);
}

function assertActiveParent(parent, isActive) {
  if (parent && isActive && !boolean(parent.isActive)) {
    throw invalidCategory(
      "An active category must belong to an active parent category.",
      {
        statusCode: 422,
        code: "CATEGORY_PARENT_INACTIVE",
      },
    );
  }
}

async function assertCanDeactivate(categoryId, isActive, { transaction } = {}) {
  if (isActive) {
    return;
  }

  const activeChildCount = await repository.countActiveChildren(categoryId, {
    transaction,
  });

  if (activeChildCount > 0) {
    throw invalidCategory(
      "This category cannot be deactivated while it has active child categories.",
      {
        statusCode: 409,
        code: "CATEGORY_HAS_ACTIVE_CHILDREN",
      },
    );
  }
}

function categoryValues(payload) {
  const values = {};

  for (const field of ["parentId", "code", "slug", "sortOrder", "isActive"]) {
    if (hasOwn(payload, field)) {
      values[field] = payload[field];
    }
  }

  return values;
}

function translationValues(payload) {
  const translations = {};

  for (const languageCode of ["en", "it"]) {
    const nameField = `name${languageCode[0].toUpperCase()}${languageCode.slice(1)}`;
    const descriptionField = `description${languageCode[0].toUpperCase()}${languageCode.slice(1)}`;
    const values = {};

    if (hasOwn(payload, nameField)) {
      values.name = payload[nameField];
    }

    if (hasOwn(payload, descriptionField)) {
      values.description = payload[descriptionField];
    }

    if (Object.keys(values).length > 0) {
      translations[languageCode] = values;
    }
  }

  return translations;
}

function isUniqueConstraintError(error) {
  return error?.name === "SequelizeUniqueConstraintError";
}

export async function listAdminCategories(filters) {
  const result = await repository.findCategories(filters);

  return {
    items: result.rows.map(categoryDto),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / filters.limit),
    },
  };
}

export async function getAdminCategory(categoryId) {
  const category = await repository.findCategoryById(categoryId);

  if (!category) {
    throw categoryNotFound();
  }

  return categoryDto(category);
}

export async function createAdminCategory(payload) {
  try {
    const category = await repository.withTransaction(async (transaction) => {
      await assertUniqueIdentity({
        code: payload.code,
        slug: payload.slug,
        transaction,
      });

      const parent = await getParent(payload.parentId, { transaction });
      const isActive = payload.isActive ?? true;

      assertActiveParent(parent, isActive);

      const created = await repository.createCategory(
        {
          parentId: payload.parentId ?? null,
          code: payload.code,
          slug: payload.slug,
          sortOrder: payload.sortOrder ?? 0,
          isActive,
        },
        { transaction },
      );

      await repository.upsertCategoryTranslations(
        created.id,
        {
          en: {
            name: payload.nameEn,
            description: payload.descriptionEn ?? null,
          },
          it: {
            name: payload.nameIt,
            description: payload.descriptionIt ?? null,
          },
        },
        { transaction },
      );

      return repository.findCategoryById(created.id, { transaction });
    });

    return categoryDto(category);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw invalidCategory(
        "A category with the same code or slug already exists.",
        {
          statusCode: 409,
          code: "CATEGORY_IDENTITY_EXISTS",
        },
      );
    }

    throw error;
  }
}

export async function updateAdminCategory(categoryId, payload) {
  try {
    const category = await repository.withTransaction(async (transaction) => {
      const currentRecord = await repository.findCategoryRecordById(categoryId, {
        transaction,
        lock: true,
      });

      if (!currentRecord) {
        throw categoryNotFound();
      }

      const current = toPlain(currentRecord);
      const nextParentId = hasOwn(payload, "parentId")
        ? payload.parentId
        : current.parentId;
      const nextIsActive = hasOwn(payload, "isActive")
        ? payload.isActive
        : boolean(current.isActive);

      if (nextParentId !== null && Number(nextParentId) === Number(categoryId)) {
        throw invalidCategory("A category cannot be its own parent.", {
          statusCode: 422,
          code: "CATEGORY_SELF_PARENT",
        });
      }

      await assertUniqueIdentity({
        code: payload.code,
        slug: payload.slug,
        excludeId: categoryId,
        transaction,
      });

      const parent = await getParent(nextParentId, { transaction });

      if (parent) {
        const parentIsDescendant = await repository.isCategoryDescendant(
          categoryId,
          nextParentId,
          { transaction },
        );

        if (parentIsDescendant) {
          throw invalidCategory(
            "A category cannot be moved beneath one of its descendants.",
            {
              statusCode: 422,
              code: "CATEGORY_CYCLIC_PARENT",
            },
          );
        }
      }

      assertActiveParent(parent, nextIsActive);
      await assertCanDeactivate(categoryId, nextIsActive, { transaction });

      const values = categoryValues(payload);

      if (Object.keys(values).length > 0) {
        await repository.updateCategory(currentRecord, values, { transaction });
      }

      const translations = translationValues(payload);

      if (Object.keys(translations).length > 0) {
        await repository.upsertCategoryTranslations(categoryId, translations, {
          transaction,
        });
      }

      return repository.findCategoryById(categoryId, { transaction });
    });

    return categoryDto(category);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw invalidCategory(
        "A category with the same code or slug already exists.",
        {
          statusCode: 409,
          code: "CATEGORY_IDENTITY_EXISTS",
        },
      );
    }

    throw error;
  }
}

export async function deleteAdminCategory(categoryId) {
  await repository.withTransaction(async (transaction) => {
    const category = await repository.findCategoryRecordById(categoryId, {
      transaction,
      lock: true,
    });

    if (!category) {
      throw categoryNotFound();
    }

    const dependencies = await repository.findDeleteDependencies(categoryId, {
      transaction,
    });

    if (Object.values(dependencies).some((count) => count > 0)) {
      throw invalidCategory(
        "This category cannot be deleted while it is used by related records.",
        {
          statusCode: 409,
          code: "CATEGORY_HAS_DEPENDENCIES",
        },
      );
    }

    await repository.deleteCategory(category, { transaction });
  });
}
