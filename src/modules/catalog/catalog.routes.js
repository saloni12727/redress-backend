import { Router } from "express";

import { asyncHandler } from "../../utils/async-handler.js";

import {
  getProductController,
  listProductReviewsController,
  listBrandsController,
  listCatalogFiltersController,
  listCategoriesController,
  listProductsController,
} from "./catalog.controller.js";

const router = Router();

router.get("/brands", asyncHandler(listBrandsController));
router.get("/categories", asyncHandler(listCategoriesController));
router.get("/filters", asyncHandler(listCatalogFiltersController));
router.get("/products", asyncHandler(listProductsController));
router.get("/products/:slug/reviews", asyncHandler(listProductReviewsController));
router.get("/products/:slug", asyncHandler(getProductController));

export default router;

