import { Router } from "express";

import healthRoutes from "../modules/health/health.routes.js";

import authRoutes from "../modules/auth/auth.routes.js";

import guestRoutes from "../modules/guest/guest.routes.js";

import catalogRoutes from "../modules/catalog/catalog.routes.js";

import homeRoutes from "../modules/home/home.routes.js";

import openApiRoutes from "../modules/docs/openapi.routes.js";

import mediaRoutes from "../modules/media/media.routes.js";

import adminHomeRoutes from "../modules/admin-home/admin-home.routes.js";

import adminCategoriesRoutes from "../modules/admin-categories/admin-categories.routes.js";

import adminBrandsRoutes from "../modules/admin-brands/admin-brands.routes.js";

import adminCatalogRoutes from "../modules/admin-catalog/admin-catalog.routes.js";

import adminProductsRoutes from "../modules/admin-products/admin-products.routes.js";

import adminVendorsRoutes from "../modules/admin-vendors/admin-vendors.routes.js";

import adminOperationsRoutes from "../modules/admin-operations/admin-operations.routes.js";
import adminRolesRoutes from "../modules/admin-roles/admin-roles.routes.js";

import vendorProductsRoutes from "../modules/vendor-products/vendor-products.routes.js";

import vendorManagementRoutes from "../modules/vendor-management/vendor-management.routes.js";
import shopperFitRoutes from "../modules/shopper-fit/shopper-fit.routes.js";
import shopperFitActionsRoutes from "../modules/shopper-fit/shopper-fit-actions.routes.js";
import fitRoutes from "../modules/shopper-fit/fit.routes.js";
import contentRoutes from "../modules/content/content.routes.js";
import wishlistRoutes from "../modules/wishlist/wishlist.routes.js";
import {
  addressesRouter,
  cartRouter,
  checkoutRouter,
  ordersRouter,
  paymentsRouter,
  returnsRouter,
} from "../modules/commerce/commerce.routes.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
|
| GET /api/v1/health
|
*/

router.use("/health", healthRoutes);

router.use("/docs", openApiRoutes);

router.use("/media", mediaRoutes);

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
|
| POST /api/v1/auth/login
| POST /api/v1/auth/refresh
| POST /api/v1/auth/logout
| POST /api/v1/auth/logout-all
| GET  /api/v1/auth/me
|
*/

router.use("/auth", authRoutes);

router.use("/body-profiles", shopperFitRoutes);

router.use("/shopper", shopperFitActionsRoutes);

router.use("/fit", fitRoutes);

router.use("/content", contentRoutes);

router.use("/cart", cartRouter);
router.use("/wishlist", wishlistRoutes);
router.use("/addresses", addressesRouter);
router.use("/checkout", checkoutRouter);
router.use("/orders", ordersRouter);
router.use("/payments", paymentsRouter);
router.use("/returns", returnsRouter);

/*
|--------------------------------------------------------------------------
| Guest Session
|--------------------------------------------------------------------------
|
| POST /api/v1/guest/sessions
|
| Used by:
|
| - Flutter anonymous installation
| - Next.js anonymous web visitor
|
*/

router.use("/guest", guestRoutes);

/*
|--------------------------------------------------------------------------
| Public Catalog
|--------------------------------------------------------------------------
|
| Read-only discovery endpoints
| shared by Flutter and Next.js.
|
*/

router.use("/catalog", catalogRoutes);

/*
|--------------------------------------------------------------------------
| Public Home Feed
|--------------------------------------------------------------------------
*/

router.use("/home", homeRoutes);

/*
|--------------------------------------------------------------------------
| Platform Administration
|--------------------------------------------------------------------------
|
| Shopper clients never call
| these routes.
|
*/

router.use("/admin/home", adminHomeRoutes);

router.use("/admin/categories", adminCategoriesRoutes);

router.use("/admin/brands", adminBrandsRoutes);

router.use("/admin/catalog", adminCatalogRoutes);

router.use("/admin/products", adminProductsRoutes);

router.use("/admin/vendors", adminVendorsRoutes);

router.use("/admin/roles", adminRolesRoutes);

router.use("/admin", adminOperationsRoutes);

/*
|--------------------------------------------------------------------------
| Vendor Portal
|--------------------------------------------------------------------------
*/

router.use("/vendor/products", vendorProductsRoutes);

router.use("/vendor", vendorManagementRoutes);

export default router;
