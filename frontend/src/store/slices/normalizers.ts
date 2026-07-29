import type { User, Shop, SellerApplication, Product, ProductVariant, Order, SellerStatus, AddressType } from "@/types/models";
import type { BackendUser, BackendSellerApplication, BackendProductResponse, BackendOrderResponse } from "./types";
import { DEFAULT_AVATAR, DEFAULT_SHOP_LOGO } from "./constants";
import { slugifyShopName } from "./validators";

export const normalizeBackendUser = (user: BackendUser): User => ({
  id: user.publicId ?? user.public_id ?? user.email,
  fullName: user.fullName ?? user.full_name ?? user.fullname ?? user.email,
  email: user.email,
  phone: user.phone,
  avatarUrl: user.avatarUrl ?? user.avatar_url ?? DEFAULT_AVATAR,
  gender: user.gender ?? undefined,
  birthday: user.dateOfBirth ?? user.date_of_birth ?? undefined,
  emailVerified: Boolean(user.emailVerifiedAt ?? user.email_verified_at),
  phoneVerified: Boolean(user.phoneVerifiedAt ?? user.phone_verified_at),
  status: user.status ?? "ACTIVE",
  lockedUntil: user.lockedUntil ?? user.locked_until ?? undefined,
  lockReason: user.lockReason ?? user.lock_reason ?? undefined,
  roles: user.roles ?? ["CUSTOMER"]
});

export const sameUserSnapshot = (left: User, right: User) =>
  left.id === right.id &&
  left.fullName === right.fullName &&
  left.email === right.email &&
  left.phone === right.phone &&
  left.avatarUrl === right.avatarUrl &&
  left.gender === right.gender &&
  left.birthday === right.birthday &&
  left.emailVerified === right.emailVerified &&
  left.phoneVerified === right.phoneVerified &&
  left.status === right.status &&
  left.lockedUntil === right.lockedUntil &&
  left.lockReason === right.lockReason &&
  left.roles.length === right.roles.length &&
  left.roles.every((role) => right.roles.includes(role));

export const normalizeBackendSellerApplication = (
  application: BackendSellerApplication,
  status?: SellerStatus | null
): SellerApplication => ({
  publicId: application.publicId ?? application.public_id,
  shopName: application.shop_name,
  shopSlug: application.shop_slug ?? undefined,
  phone: application.phone,
  email: application.email,
  pickupAddress: application.pickup_address,
  taxCode: application.tax_code ?? "",
  bankName: application.bank_name ?? "",
  bankAccountNumber: application.bank_account_number ?? "",
  bankAccountName: application.bank_account_name ?? "",
  status: application.status ?? status ?? undefined,
  rejectedReason: application.rejected_reason ?? undefined,
  approvedAt: application.approved_at ?? undefined
});

export const normalizeBackendProduct = (
  backendProduct: BackendProductResponse,
  sellerId: string
): { product: Product; variants: ProductVariant[] } => {
  const product: Product = {
    id: backendProduct.public_id,
    sellerId: sellerId,
    name: backendProduct.name,
    slug: backendProduct.slug,
    shortDescription: backendProduct.short_description ?? "",
    description: backendProduct.description ?? "",
    brand: backendProduct.brand ?? undefined,
    origin: backendProduct.origin ?? "Việt Nam",
    warranty: backendProduct.warranty_info ?? undefined,
    status: backendProduct.status,
    averageRating: backendProduct.average_rating,
    reviewCount: backendProduct.review_count,
    soldCount: backendProduct.sold_count,
    categoryIds: backendProduct.categories ? backendProduct.categories.map((c) => c.id.toString()) : [],
    imageUrls: backendProduct.images.map((img) => img.image_url),
    thumbnailUrl:
      backendProduct.images.find((img) => img.is_thumbnail)?.image_url ??
      backendProduct.images[0]?.image_url ??
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    createdAt: backendProduct.created_at,
    variantOptions: backendProduct.variant_options ?? undefined
  };

  const variants: ProductVariant[] = backendProduct.variants
    .filter(v => v.status !== "DELETED")
    .map((variant) => ({
      id: variant.public_id,
      productId: product.id,
      sku: variant.sku,
      variantName: variant.variant_name,
      price: Number(variant.price),
      salePrice: variant.sale_price != null ? Number(variant.sale_price) : undefined,
      saleStartAt: variant.sale_start_at ?? undefined,
      saleEndAt: variant.sale_end_at ?? undefined,
      imageUrl: variant.image_url ?? product.thumbnailUrl,
      status: variant.status,
      inventory: variant.inventory 
        ? { quantity: variant.inventory.quantity, reservedQuantity: variant.inventory.reserved_quantity } 
        : { quantity: 0, reservedQuantity: 0 },
      tierIndex: variant.tier_index ?? undefined
    }));

  return { product, variants };
};

export const normalizeBackendOrder = (
  backendOrder: BackendOrderResponse,
  sellerId: string,
  userId: string
): Order => {
  const shopName = backendOrder.seller?.shop_name || backendOrder.items?.[0]?.seller_name_snapshot || undefined;
  const shopSlug = backendOrder.seller?.shop_slug || undefined;

  return {
    id: backendOrder.public_id,
    orderCode: backendOrder.order_code,
    userId: backendOrder.user?.public_id || userId,
    sellerId: sellerId,
    shopName,
    shopSlug,
    orderStatus: backendOrder.order_status,
  paymentStatus: backendOrder.payment_status,
  sellerConfirmed: backendOrder.seller_confirmed,
  sellerConfirmedAt: backendOrder.seller_confirmed_at ?? undefined,
  subtotalAmount: Number(backendOrder.subtotal_amount),
  shippingFee: Number(backendOrder.shipping_fee),
  productDiscountAmount: Number(backendOrder.product_discount_amount),
  shippingDiscountAmount: Number(backendOrder.shipping_discount_amount),
  totalAmount: Number(backendOrder.total_amount),
  customerNote: backendOrder.customer_note ?? undefined,
  paymentExpiresAt: backendOrder.payment_expires_at,
  sellerConfirmExpiresAt: backendOrder.seller_confirm_expires_at,
  completedAt: backendOrder.completed_at ?? undefined,
  cancelledAt: backendOrder.cancelled_at ?? undefined,
  items: (backendOrder.items || []).map((item: any) => ({
    id: String(item.id),
    productId: item.product_id ? String(item.product_id) : undefined,
    variantId: item.variant_id ? String(item.variant_id) : undefined,
    productNameSnapshot: item.product_name_snapshot,
    variantNameSnapshot: item.variant_name_snapshot,
    productImageSnapshot: item.product_image_snapshot || "",
    sellerNameSnapshot: item.seller_name_snapshot,
    skuSnapshot: item.sku_snapshot || "",
    unitPrice: Number(item.unit_price),
    quantity: item.quantity,
    subtotal: Number(item.subtotal),
    isReviewed: Boolean(item.is_reviewed)
  })),
  shipment: backendOrder.shipment ? {
    shippingProviderName: backendOrder.shipment.shipping_provider_name || "Chưa có thông tin",
    receiverName: backendOrder.shipment.receiver_name,
    receiverPhone: backendOrder.shipment.receiver_phone,
    province: backendOrder.shipment.province,
    district: backendOrder.shipment.district,
    ward: backendOrder.shipment.ward,
    detailAddress: backendOrder.shipment.detail_address,
    addressType: (backendOrder.shipment.address_type || "HOME") as AddressType,
    shippedAt: backendOrder.shipment.shipped_at || undefined,
    deliveredAt: backendOrder.shipment.delivered_at || undefined
  } : {
    shippingProviderName: "Chưa có thông tin",
    receiverName: "-",
    receiverPhone: "-",
    province: "-",
    district: "-",
    ward: "-",
    detailAddress: "-",
    addressType: "HOME"
  },
  timeline: [],
  createdAt: backendOrder.created_at,
  printCount: (backendOrder as any).print_count ?? 0
  };
};

export const sellerApplicationToShop = (
  application: SellerApplication,
  backendApplication: BackendSellerApplication,
  user: User,
  fallbackStatus: SellerStatus = "PENDING"
): Shop => ({
  id: application.publicId ?? backendApplication.publicId ?? backendApplication.public_id,
  userId: user.id,
  shopName: application.shopName,
  shopSlug: (application.shopSlug ?? slugifyShopName(application.shopName)) || `seller-${user.id}`,
  logoUrl: DEFAULT_SHOP_LOGO,
  description: "Hồ sơ shop được đồng bộ từ backend seller application.",
  phone: application.phone,
  email: application.email,
  pickupAddress: application.pickupAddress,
  shippingFee: Number(backendApplication.shipping_fee ?? 0),
  shippingProviderName: backendApplication.shipping_provider_name ?? "Chưa cấu hình",
  status: application.status ?? fallbackStatus,
  rejectedReason: application.rejectedReason,
  totalSold: 0,
  totalRevenue: 0,
  approvedAt: application.approvedAt
});

export const sameShopSnapshot = (left: Shop, right: Shop) =>
  left.id === right.id &&
  left.userId === right.userId &&
  left.shopName === right.shopName &&
  left.shopSlug === right.shopSlug &&
  left.logoUrl === right.logoUrl &&
  left.description === right.description &&
  left.phone === right.phone &&
  left.email === right.email &&
  left.pickupAddress === right.pickupAddress &&
  left.shippingFee === right.shippingFee &&
  left.shippingProviderName === right.shippingProviderName &&
  left.status === right.status &&
  left.rejectedReason === right.rejectedReason &&
  left.totalSold === right.totalSold &&
  left.totalRevenue === right.totalRevenue &&
  left.approvedAt === right.approvedAt &&
  left.closedAt === right.closedAt;
