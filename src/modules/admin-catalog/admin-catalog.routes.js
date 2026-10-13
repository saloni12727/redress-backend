import { Router } from "express";

import { authenticateStandard } from "../../middleware/authenticate.js";
import { requirePermissionStandard } from "../../middleware/require-permission.js";
import { logCaughtRouteError } from "../../middleware/smart-request-logger.js";
import { asyncHandler } from "../../utils/async-handler.js";

import {
  createAttributeController,
  createAttributeValueController,
  createCategoryAttributeController,
  createColorController,
  createFitProfileController,
  createSizeController,
  createSizeSystemController,
  deleteAttributeController,
  deleteAttributeValueController,
  deleteCategoryAttributeController,
  deleteColorController,
  deleteFitProfileController,
  deleteSizeController,
  deleteSizeSystemController,
  getAttributeController,
  getAttributeValueController,
  getCategoryAttributeController,
  getColorController,
  getFitProfileController,
  getSizeController,
  getSizeSystemController,
  listAttributesController,
  listAttributeValuesController,
  listCategoryAttributesController,
  listColorsController,
  listFitProfilesController,
  listSizesController,
  listSizeSystemsController,
  updateAttributeController,
  updateAttributeValueController,
  updateCategoryAttributeController,
  updateColorController,
  updateFitProfileController,
  updateSizeController,
  updateSizeSystemController,
} from "./admin-catalog.controller.js";

const router = Router();
const view = requirePermissionStandard("platform.catalog.view");
const create = requirePermissionStandard("platform.catalog.create");
const update = requirePermissionStandard("platform.catalog.update");
const remove = requirePermissionStandard("platform.catalog.delete");

router.use(authenticateStandard);

router.get("/colors", view, asyncHandler(listColorsController));
router.post("/colors", create, asyncHandler(createColorController));
router.get("/colors/:id", view, asyncHandler(getColorController));
router.patch("/colors/:id", update, asyncHandler(updateColorController));
router.delete("/colors/:id", remove, asyncHandler(deleteColorController));

router.get("/size-systems", view, asyncHandler(listSizeSystemsController));
router.post("/size-systems", create, asyncHandler(createSizeSystemController));
router.get("/size-systems/:id", view, asyncHandler(getSizeSystemController));
router.patch("/size-systems/:id", update, asyncHandler(updateSizeSystemController));
router.delete("/size-systems/:id", remove, asyncHandler(deleteSizeSystemController));

router.get("/sizes", view, asyncHandler(listSizesController));
router.post("/sizes", create, asyncHandler(createSizeController));
router.get("/sizes/:id", view, asyncHandler(getSizeController));
router.patch("/sizes/:id", update, asyncHandler(updateSizeController));
router.delete("/sizes/:id", remove, asyncHandler(deleteSizeController));

router.get("/fit-profiles", view, asyncHandler(listFitProfilesController));
router.post("/fit-profiles", create, asyncHandler(createFitProfileController));
router.get("/fit-profiles/:id", view, asyncHandler(getFitProfileController));
router.patch("/fit-profiles/:id", update, asyncHandler(updateFitProfileController));
router.delete("/fit-profiles/:id", remove, asyncHandler(deleteFitProfileController));

router.get("/attributes", view, asyncHandler(listAttributesController));
router.post("/attributes", create, asyncHandler(createAttributeController));
router.get("/attributes/:id", view, asyncHandler(getAttributeController));
router.patch("/attributes/:id", update, asyncHandler(updateAttributeController));
router.delete("/attributes/:id", remove, asyncHandler(deleteAttributeController));

router.get("/attribute-values", view, asyncHandler(listAttributeValuesController));
router.post("/attribute-values", create, asyncHandler(createAttributeValueController));
router.get("/attribute-values/:id", view, asyncHandler(getAttributeValueController));
router.patch("/attribute-values/:id", update, asyncHandler(updateAttributeValueController));
router.delete("/attribute-values/:id", remove, asyncHandler(deleteAttributeValueController));

router.get("/category-attributes", view, asyncHandler(listCategoryAttributesController));
router.post("/category-attributes", create, asyncHandler(createCategoryAttributeController));
router.get("/category-attributes/:id", view, asyncHandler(getCategoryAttributeController));
router.patch("/category-attributes/:id", update, asyncHandler(updateCategoryAttributeController));
router.delete("/category-attributes/:id", remove, asyncHandler(deleteCategoryAttributeController));

router.use((error, request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }

  logCaughtRouteError({
    request,
    response,
    error,
    component: "admin-catalog",
  });

  return response.status(500).json({
    success: false,
    data: null,
    message: "An unexpected error occurred. Please try again later.",
  });
});

export default router;
