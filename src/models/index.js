import Account from "./account.model.js";
import AccountRole from "./account-role.model.js";
import Address from "./address.model.js";
import Attribute from "./attribute.model.js";
import AttributeValue from "./attribute-value.model.js";
import Brand from "./brand.model.js";
import BodyProfile from "./body-profile.model.js";
import Cart from "./cart.model.js";
import CartItem from "./cart-item.model.js";
import Category from "./category.model.js";
import CategoryAttribute from "./category-attribute.model.js";
import CategoryMeasurementRequirement from "./category-measurement-requirement.model.js";
import CategoryTranslation from "./category-translation.model.js";
import Color from "./color.model.js";
import ContentPolicy from "./content-policy.model.js";
import FitProfile from "./fit-profile.model.js";
import GuestSession from "./guest-session.model.js";
import GarmentMeasurement from "./garment-measurement.model.js";
import GarmentMeasurementType from "./garment-measurement-type.model.js";
import HomePlacement from "./home-placement.model.js";
import Inventory from "./inventory.model.js";
import Language from "./language.model.js";
import Permission from "./permission.model.js";
import Order from "./order.model.js";
import OrderFulfillment from "./order-fulfillment.model.js";
import OrderItem from "./order-item.model.js";
import OrderReturn from "./order-return.model.js";
import OrderReturnItem from "./order-return-item.model.js";
import Payment from "./payment.model.js";
import Product from "./product.model.js";
import ProductAttributeValue from "./product-attribute-value.model.js";
import ProductCategory from "./product-category.model.js";
import ProductMedia from "./product-media.model.js";
import ProductReview from "./product-review.model.js";
import ProductReviewPhoto from "./product-review-photo.model.js";
import ProductTranslation from "./product-translation.model.js";
import ProductVariant from "./product-variant.model.js";
import Role from "./role.model.js";
import RolePermission from "./role-permission.model.js";
import Size from "./size.model.js";
import SizeSystem from "./size-system.model.js";
import ShopperMedia from "./shopper-media.model.js";
import SignupProof from "./signup-proof.model.js";
import UserConsent from "./user-consent.model.js";
import Vendor from "./vendor.model.js";
import VendorUser from "./vendor-user.model.js";
import WishlistItem from "./wishlist-item.model.js";

let associationsInitialized = false;

export function initializeModelAssociations() {
  if (associationsInitialized) {
    return;
  }

  /*
  |--------------------------------------------------------------------------
  | Role ↔ Permission
  |--------------------------------------------------------------------------
  */

  Role.hasMany(RolePermission, {
    foreignKey: "roleId",
    as: "rolePermissions",
  });

  RolePermission.belongsTo(Role, {
    foreignKey: "roleId",
    as: "role",
  });

  Permission.hasMany(RolePermission, {
    foreignKey: "permissionId",
    as: "rolePermissions",
  });

  RolePermission.belongsTo(Permission, {
    foreignKey: "permissionId",
    as: "permission",
  });

  Role.belongsToMany(Permission, {
    through: RolePermission,
    foreignKey: "roleId",
    otherKey: "permissionId",
    as: "permissions",
  });

  Permission.belongsToMany(Role, {
    through: RolePermission,
    foreignKey: "permissionId",
    otherKey: "roleId",
    as: "roles",
  });

  /*
  |--------------------------------------------------------------------------
  | Account ↔ Role
  |--------------------------------------------------------------------------
  */

  Account.hasMany(AccountRole, {
    foreignKey: "accountId",
    as: "accountRoles",
  });

  AccountRole.belongsTo(Account, {
    foreignKey: "accountId",
    as: "account",
  });

  Role.hasMany(AccountRole, {
    foreignKey: "roleId",
    as: "accountRoles",
  });

  AccountRole.belongsTo(Role, {
    foreignKey: "roleId",
    as: "role",
  });

  Account.belongsToMany(Role, {
    through: AccountRole,
    foreignKey: "accountId",
    otherKey: "roleId",
    as: "roles",
  });

  /* Shopper commerce */
  Account.hasOne(Cart, { foreignKey: "accountId", as: "cart" });
  Cart.belongsTo(Account, { foreignKey: "accountId", as: "account" });
  Account.hasMany(GuestSession, {
    foreignKey: "convertedAccountId",
    as: "convertedGuestSessions",
  });
  GuestSession.belongsTo(Account, {
    foreignKey: "convertedAccountId",
    as: "convertedAccount",
  });
  GuestSession.hasOne(Cart, {
    foreignKey: "guestSessionUuid",
    sourceKey: "sessionUuid",
    as: "cart",
  });
  Cart.belongsTo(GuestSession, {
    foreignKey: "guestSessionUuid",
    targetKey: "sessionUuid",
    as: "guestSession",
  });
  Cart.hasMany(CartItem, { foreignKey: "cartId", as: "items" });
  CartItem.belongsTo(Cart, { foreignKey: "cartId", as: "cart" });
  ProductVariant.hasMany(CartItem, { foreignKey: "productVariantId", as: "cartItems" });
  CartItem.belongsTo(ProductVariant, { foreignKey: "productVariantId", as: "variant" });

  Account.hasMany(WishlistItem, {
    foreignKey: "accountId",
    as: "wishlistItems",
  });
  WishlistItem.belongsTo(Account, { foreignKey: "accountId", as: "account" });
  Product.hasMany(WishlistItem, {
    foreignKey: "productId",
    as: "wishlistItems",
  });
  WishlistItem.belongsTo(Product, { foreignKey: "productId", as: "product" });

  Account.hasMany(Address, { foreignKey: "accountId", as: "addresses" });
  Address.belongsTo(Account, { foreignKey: "accountId", as: "account" });

  Account.hasMany(Order, { foreignKey: "accountId", as: "orders" });
  Order.belongsTo(Account, { foreignKey: "accountId", as: "account" });
  Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
  OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });
  Order.hasOne(Payment, { foreignKey: "orderId", as: "payment" });
  Payment.belongsTo(Order, { foreignKey: "orderId", as: "order" });
  Order.hasOne(OrderFulfillment, { foreignKey: "orderId", as: "fulfillment" });
  OrderFulfillment.belongsTo(Order, { foreignKey: "orderId", as: "order" });
  Account.hasMany(OrderReturn, { foreignKey: "accountId", as: "orderReturns" });
  OrderReturn.belongsTo(Account, { foreignKey: "accountId", as: "account" });
  Order.hasMany(OrderReturn, { foreignKey: "orderId", as: "returns" });
  OrderReturn.belongsTo(Order, { foreignKey: "orderId", as: "order" });
  OrderReturn.hasMany(OrderReturnItem, { foreignKey: "orderReturnId", as: "items" });
  OrderReturnItem.belongsTo(OrderReturn, { foreignKey: "orderReturnId", as: "return" });
  OrderItem.hasMany(OrderReturnItem, { foreignKey: "orderItemId", as: "returnItems" });
  OrderReturnItem.belongsTo(OrderItem, { foreignKey: "orderItemId", as: "orderItem" });

  Account.hasMany(ProductReview, { foreignKey: "accountId", as: "productReviews" });
  ProductReview.belongsTo(Account, { foreignKey: "accountId", as: "author" });
  Product.hasMany(ProductReview, { foreignKey: "productId", as: "reviews" });
  ProductReview.belongsTo(Product, { foreignKey: "productId", as: "product" });
  OrderItem.hasOne(ProductReview, { foreignKey: "orderItemId", as: "review" });
  ProductReview.belongsTo(OrderItem, { foreignKey: "orderItemId", as: "orderItem" });
  ProductReview.hasMany(ProductReviewPhoto, { foreignKey: "reviewId", as: "photos" });
  ProductReviewPhoto.belongsTo(ProductReview, { foreignKey: "reviewId", as: "review" });

  /*
  |--------------------------------------------------------------------------
  | Shopper fit, private media, and consent history
  |--------------------------------------------------------------------------
  */

  Account.hasMany(BodyProfile, {
    foreignKey: "accountId",
    as: "bodyProfiles",
  });

  BodyProfile.belongsTo(Account, {
    foreignKey: "accountId",
    as: "account",
  });

  Account.hasMany(ShopperMedia, {
    foreignKey: "accountId",
    as: "shopperMedia",
  });

  ShopperMedia.belongsTo(Account, {
    foreignKey: "accountId",
    as: "account",
  });

  Account.hasMany(UserConsent, {
    foreignKey: "accountId",
    as: "consents",
  });

  UserConsent.belongsTo(Account, {
    foreignKey: "accountId",
    as: "account",
  });

  Role.belongsToMany(Account, {
    through: AccountRole,
    foreignKey: "roleId",
    otherKey: "accountId",
    as: "accounts",
  });

  /*
  |--------------------------------------------------------------------------
  | Category Hierarchy
  |--------------------------------------------------------------------------
  */

  Category.hasMany(Category, {
    foreignKey: "parentId",
    as: "children",
  });

  Category.belongsTo(Category, {
    foreignKey: "parentId",
    as: "parent",
  });

  /*
  |--------------------------------------------------------------------------
  | Category Translations
  |--------------------------------------------------------------------------
  */

  Category.hasMany(CategoryTranslation, {
    foreignKey: "categoryId",
    as: "translations",
  });

  CategoryTranslation.belongsTo(Category, {
    foreignKey: "categoryId",
    as: "category",
  });

  Language.hasMany(CategoryTranslation, {
    foreignKey: "languageCode",
    sourceKey: "code",
    as: "categoryTranslations",
  });

  CategoryTranslation.belongsTo(Language, {
    foreignKey: "languageCode",
    targetKey: "code",
    as: "language",
  });

  /*
  |--------------------------------------------------------------------------
  | Size System ↔ Size
  |--------------------------------------------------------------------------
  */

  SizeSystem.hasMany(Size, {
    foreignKey: "sizeSystemId",
    as: "sizes",
  });

  Size.belongsTo(SizeSystem, {
    foreignKey: "sizeSystemId",
    as: "sizeSystem",
  });

  /*
  |--------------------------------------------------------------------------
  | Vendor ↔ Accounts
  |--------------------------------------------------------------------------
  */

  Vendor.hasMany(VendorUser, {
    foreignKey: "vendorId",
    as: "vendorUsers",
  });

  VendorUser.belongsTo(Vendor, {
    foreignKey: "vendorId",
    as: "vendor",
  });

  Account.hasMany(VendorUser, {
    foreignKey: "accountId",
    as: "vendorMemberships",
  });

  VendorUser.belongsTo(Account, {
    foreignKey: "accountId",
    as: "account",
  });

  Vendor.belongsToMany(Account, {
    through: VendorUser,
    foreignKey: "vendorId",
    otherKey: "accountId",
    as: "users",
  });

  Account.belongsToMany(Vendor, {
    through: VendorUser,
    foreignKey: "accountId",
    otherKey: "vendorId",
    as: "vendors",
  });

  /*
  |--------------------------------------------------------------------------
  | Vendor ↔ Product
  |--------------------------------------------------------------------------
  */

  Vendor.hasMany(Product, {
    foreignKey: "vendorId",
    as: "products",
  });

  Product.belongsTo(Vendor, {
    foreignKey: "vendorId",
    as: "vendor",
  });

  /*
  |--------------------------------------------------------------------------
  | Brand ↔ Product
  |--------------------------------------------------------------------------
  */

  Brand.hasMany(Product, {
    foreignKey: "brandId",
    as: "products",
  });

  Product.belongsTo(Brand, {
    foreignKey: "brandId",
    as: "brand",
  });

  /*
  |--------------------------------------------------------------------------
  | Home Placement Targets
  |--------------------------------------------------------------------------
  */

  Product.hasMany(HomePlacement, {
    foreignKey: "targetProductId",
    as: "homePlacements",
  });

  HomePlacement.belongsTo(Product, {
    foreignKey: "targetProductId",
    as: "targetProduct",
  });

  Brand.hasMany(HomePlacement, {
    foreignKey: "targetBrandId",
    as: "homePlacements",
  });

  HomePlacement.belongsTo(Brand, {
    foreignKey: "targetBrandId",
    as: "targetBrand",
  });

  Category.hasMany(HomePlacement, {
    foreignKey: "targetCategoryId",
    as: "homePlacements",
  });

  HomePlacement.belongsTo(Category, {
    foreignKey: "targetCategoryId",
    as: "targetCategory",
  });

  Account.hasMany(HomePlacement, {
    foreignKey: "createdByAccountId",
    as: "createdHomePlacements",
  });

  HomePlacement.belongsTo(Account, {
    foreignKey: "createdByAccountId",
    as: "createdBy",
  });

  Account.hasMany(HomePlacement, {
    foreignKey: "updatedByAccountId",
    as: "updatedHomePlacements",
  });

  HomePlacement.belongsTo(Account, {
    foreignKey: "updatedByAccountId",
    as: "updatedBy",
  });

  Account.hasMany(HomePlacement, {
    foreignKey: "publishedByAccountId",
    as: "publishedHomePlacements",
  });

  HomePlacement.belongsTo(Account, {
    foreignKey: "publishedByAccountId",
    as: "publishedBy",
  });

  /*
  |--------------------------------------------------------------------------
  | Fit Profile ↔ Product
  |--------------------------------------------------------------------------
  */

  FitProfile.hasMany(Product, {
    foreignKey: "fitProfileId",
    as: "products",
  });

  Product.belongsTo(FitProfile, {
    foreignKey: "fitProfileId",
    as: "fitProfile",
  });

  /*
  |--------------------------------------------------------------------------
  | Product Creator / Approver
  |--------------------------------------------------------------------------
  */

  Account.hasMany(Product, {
    foreignKey: "createdByAccountId",
    as: "createdProducts",
  });

  Product.belongsTo(Account, {
    foreignKey: "createdByAccountId",
    as: "createdBy",
  });

  Account.hasMany(Product, {
    foreignKey: "approvedByAccountId",
    as: "approvedProducts",
  });

  Product.belongsTo(Account, {
    foreignKey: "approvedByAccountId",
    as: "approvedBy",
  });

  /*
  |--------------------------------------------------------------------------
  | Product Translations
  |--------------------------------------------------------------------------
  */

  Product.hasMany(ProductTranslation, {
    foreignKey: "productId",
    as: "translations",
  });

  ProductTranslation.belongsTo(Product, {
    foreignKey: "productId",
    as: "product",
  });

  Language.hasMany(ProductTranslation, {
    foreignKey: "languageCode",
    sourceKey: "code",
    as: "productTranslations",
  });

  ProductTranslation.belongsTo(Language, {
    foreignKey: "languageCode",
    targetKey: "code",
    as: "language",
  });

  /*
  |--------------------------------------------------------------------------
  | Product ↔ Categories
  |--------------------------------------------------------------------------
  */

  Product.hasMany(ProductCategory, {
    foreignKey: "productId",
    as: "productCategories",
  });

  ProductCategory.belongsTo(Product, {
    foreignKey: "productId",
    as: "product",
  });

  Category.hasMany(ProductCategory, {
    foreignKey: "categoryId",
    as: "productCategories",
  });

  ProductCategory.belongsTo(Category, {
    foreignKey: "categoryId",
    as: "category",
  });

  Product.belongsToMany(Category, {
    through: ProductCategory,
    foreignKey: "productId",
    otherKey: "categoryId",
    as: "categories",
  });

  Category.belongsToMany(Product, {
    through: ProductCategory,
    foreignKey: "categoryId",
    otherKey: "productId",
    as: "products",
  });

  /*
  |--------------------------------------------------------------------------
  | Product ↔ Variants
  |--------------------------------------------------------------------------
  */

  Product.hasMany(ProductVariant, {
    foreignKey: "productId",
    as: "variants",
  });

  ProductVariant.belongsTo(Product, {
    foreignKey: "productId",
    as: "product",
  });

  Size.hasMany(ProductVariant, {
    foreignKey: "sizeId",
    as: "productVariants",
  });

  ProductVariant.belongsTo(Size, {
    foreignKey: "sizeId",
    as: "size",
  });

  Color.hasMany(ProductVariant, {
    foreignKey: "colorId",
    as: "productVariants",
  });

  ProductVariant.belongsTo(Color, {
    foreignKey: "colorId",
    as: "color",
  });

  /*
  |--------------------------------------------------------------------------
  | Product Media
  |--------------------------------------------------------------------------
  */

  Product.hasMany(ProductMedia, {
    foreignKey: "productId",
    as: "media",
  });

  ProductMedia.belongsTo(Product, {
    foreignKey: "productId",
    as: "product",
  });

  ProductVariant.hasMany(ProductMedia, {
    foreignKey: "variantId",
    as: "media",
  });

  ProductMedia.belongsTo(ProductVariant, {
    foreignKey: "variantId",
    as: "variant",
  });

  /*
  |--------------------------------------------------------------------------
  | Inventory
  |--------------------------------------------------------------------------
  */

  ProductVariant.hasOne(Inventory, {
    foreignKey: "variantId",
    as: "inventory",
  });

  Inventory.belongsTo(ProductVariant, {
    foreignKey: "variantId",
    as: "variant",
  });

  /*
  |--------------------------------------------------------------------------
  | Attribute ↔ Attribute Values
  |--------------------------------------------------------------------------
  */

  Attribute.hasMany(AttributeValue, {
    foreignKey: "attributeId",
    as: "values",
  });

  AttributeValue.belongsTo(Attribute, {
    foreignKey: "attributeId",
    as: "attribute",
  });

  /*
  |--------------------------------------------------------------------------
  | Category ↔ Attributes
  |--------------------------------------------------------------------------
  */

  Category.hasMany(CategoryAttribute, {
    foreignKey: "categoryId",
    as: "categoryAttributes",
  });

  CategoryAttribute.belongsTo(Category, {
    foreignKey: "categoryId",
    as: "category",
  });

  Attribute.hasMany(CategoryAttribute, {
    foreignKey: "attributeId",
    as: "categoryAttributes",
  });

  CategoryAttribute.belongsTo(Attribute, {
    foreignKey: "attributeId",
    as: "attribute",
  });

  Category.belongsToMany(Attribute, {
    through: CategoryAttribute,
    foreignKey: "categoryId",
    otherKey: "attributeId",
    as: "attributes",
  });

  Attribute.belongsToMany(Category, {
    through: CategoryAttribute,
    foreignKey: "attributeId",
    otherKey: "categoryId",
    as: "categories",
  });

  /*
  |--------------------------------------------------------------------------
  | Product Attribute Values
  |--------------------------------------------------------------------------
  */

  Product.hasMany(ProductAttributeValue, {
    foreignKey: "productId",
    as: "attributeValues",
  });

  ProductAttributeValue.belongsTo(Product, {
    foreignKey: "productId",
    as: "product",
  });

  ProductVariant.hasMany(ProductAttributeValue, {
    foreignKey: "variantId",
    as: "attributeValues",
  });

  ProductAttributeValue.belongsTo(ProductVariant, {
    foreignKey: "variantId",
    as: "variant",
  });

  Attribute.hasMany(ProductAttributeValue, {
    foreignKey: "attributeId",
    as: "productValues",
  });

  ProductAttributeValue.belongsTo(Attribute, {
    foreignKey: "attributeId",
    as: "attribute",
  });

  AttributeValue.hasMany(ProductAttributeValue, {
    foreignKey: "attributeValueId",
    as: "productValues",
  });

  ProductAttributeValue.belongsTo(AttributeValue, {
    foreignKey: "attributeValueId",
    as: "optionValue",
  });

  /*
  |--------------------------------------------------------------------------
  | Category ↔ Measurement Requirements
  |--------------------------------------------------------------------------
  */

  Category.hasMany(CategoryMeasurementRequirement, {
    foreignKey: "categoryId",
    as: "measurementRequirements",
  });

  CategoryMeasurementRequirement.belongsTo(Category, {
    foreignKey: "categoryId",
    as: "category",
  });

  GarmentMeasurementType.hasMany(CategoryMeasurementRequirement, {
    foreignKey: "measurementTypeId",
    as: "categoryRequirements",
  });

  CategoryMeasurementRequirement.belongsTo(GarmentMeasurementType, {
    foreignKey: "measurementTypeId",
    as: "measurementType",
  });

  Category.belongsToMany(GarmentMeasurementType, {
    through: CategoryMeasurementRequirement,
    foreignKey: "categoryId",
    otherKey: "measurementTypeId",
    as: "measurementTypes",
  });

  GarmentMeasurementType.belongsToMany(Category, {
    through: CategoryMeasurementRequirement,
    foreignKey: "measurementTypeId",
    otherKey: "categoryId",
    as: "categories",
  });

  /*
  |--------------------------------------------------------------------------
  | Variant ↔ Garment Measurements
  |--------------------------------------------------------------------------
  */

  ProductVariant.hasMany(GarmentMeasurement, {
    foreignKey: "variantId",
    as: "garmentMeasurements",
  });

  GarmentMeasurement.belongsTo(ProductVariant, {
    foreignKey: "variantId",
    as: "variant",
  });

  GarmentMeasurementType.hasMany(GarmentMeasurement, {
    foreignKey: "measurementTypeId",
    as: "garmentMeasurements",
  });

  GarmentMeasurement.belongsTo(GarmentMeasurementType, {
    foreignKey: "measurementTypeId",
    as: "measurementType",
  });

  associationsInitialized = true;
}

initializeModelAssociations();

export {
  Account,
  AccountRole,
  Address,
  Attribute,
  AttributeValue,
  Brand,
  BodyProfile,
  Cart,
  CartItem,
  Category,
  CategoryAttribute,
  CategoryMeasurementRequirement,
  CategoryTranslation,
  Color,
  ContentPolicy,
  FitProfile,
  GuestSession,
  GarmentMeasurement,
  GarmentMeasurementType,
  HomePlacement,
  Inventory,
  Language,
  Permission,
  Order,
  OrderFulfillment,
  OrderItem,
  OrderReturn,
  OrderReturnItem,
  Payment,
  Product,
  ProductAttributeValue,
  ProductCategory,
  ProductMedia,
  ProductReview,
  ProductReviewPhoto,
  ProductTranslation,
  ProductVariant,
  Role,
  RolePermission,
  Size,
  SizeSystem,
  ShopperMedia,
  SignupProof,
  UserConsent,
  Vendor,
  VendorUser,
  WishlistItem,
};
