import type { User, Shop, SellerApplication, Product, ProductVariant, Order, OrderReturn, SellerStatus, AddressType, PaymentMethod } from "@/types/models";
import type { BackendUser, BackendSellerApplication, BackendProductResponse, BackendOrderResponse, BackendOrderReturnResponse } from "./types";
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
  shopLogoUrl: application.shop_logo_url ?? undefined,
  shopSlug: application.shop_slug ?? undefined,
  shopDescription: application.shop_description ?? undefined,
  phone: application.phone,
  email: application.email,
  pickupAddress: application.pickup_address,
  taxCode: application.tax_code ?? "",
  bankName: application.bank_name ?? "",
  bankAccountNumber: application.bank_account_number ?? "",
  bankAccountName: application.bank_account_name ?? "",
  shippingProviders: application.shipping_providers?.map((p: any) => ({
    publicId: p.public_id,
    code: p.code,
    name: p.name,
    fixedFee: Number(p.fixed_fee),
    logoUrl: p.logo_url,
    active: Boolean(p.active)
  })) ?? [],
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
    categories: backendProduct.categories ? backendProduct.categories.map((c: any) => ({
      id: String(c.id),
      name: c.name,
      slug: c.slug || ""
    })) : [],
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

export const normalizeBackendOrderReturn = (backendReturn: BackendOrderReturnResponse | any): OrderReturn => ({
  id: backendReturn.public_id ?? backendReturn.id ?? "",
  publicId: backendReturn.public_id ?? backendReturn.publicId,
  returnCode: backendReturn.return_code ?? backendReturn.returnCode,
  orderId: backendReturn.order_id ?? backendReturn.orderId,
  userId: backendReturn.user_id ?? backendReturn.userId,
  sellerId: backendReturn.seller_id ?? backendReturn.sellerId,
  returnStatus: backendReturn.return_status ?? backendReturn.returnStatus,
  reason: backendReturn.reason,
  description: backendReturn.description,
  evidenceImages: backendReturn.evidence_images ?? backendReturn.evidenceImages ?? [],
  sellerRejectReason: backendReturn.seller_reject_reason ?? backendReturn.sellerRejectReason ?? undefined,
  sellerRespondedAt: backendReturn.seller_responded_at ?? backendReturn.sellerRespondedAt ?? undefined,
  returnShippingProvider: backendReturn.return_shipping_provider ?? backendReturn.returnShippingProvider ?? undefined,
  returnTrackingCode: backendReturn.return_tracking_code ?? backendReturn.returnTrackingCode ?? undefined,
  pickupAddress: backendReturn.pickup_address ?? backendReturn.pickupAddress ?? undefined,
  returnAddress: backendReturn.return_address ?? backendReturn.returnAddress ?? undefined,
  disputeReason: backendReturn.dispute_reason ?? backendReturn.disputeReason ?? undefined,
  disputedAt: backendReturn.disputed_at ?? backendReturn.disputedAt ?? undefined,
  supporterId: backendReturn.supporter_id ?? backendReturn.supporterId ?? undefined,
  supporterDecision: backendReturn.supporter_decision ?? backendReturn.supporterDecision ?? undefined,
  supporterNote: backendReturn.supporter_note ?? backendReturn.supporterNote ?? undefined,
  resolvedAt: backendReturn.resolved_at ?? backendReturn.resolvedAt ?? undefined,
  createdAt: backendReturn.created_at ?? backendReturn.createdAt,
  updatedAt: backendReturn.updated_at ?? backendReturn.updatedAt ?? undefined,
  user: backendReturn.user
    ? {
        id: backendReturn.user.public_id,
        fullName: backendReturn.user.full_name,
        avatarUrl: backendReturn.user.avatar_url,
      }
    : undefined,
  order: backendReturn.order
    ? normalizeBackendOrder(
        backendReturn.order,
        backendReturn.order.seller?.public_id || "UNKNOWN_SELLER",
        backendReturn.order.user?.public_id || "UNKNOWN_USER"
      )
    : undefined
});

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
    shopDbId: backendOrder.seller?.id,
    shopName,
    shopSlug,
    receiverName: (backendOrder.shipment?.receiver_name && backendOrder.shipment.receiver_name.trim() !== "-")
      ? backendOrder.shipment.receiver_name.trim()
      : backendOrder.user?.full_name || undefined,
    phone: (backendOrder.shipment?.receiver_phone && backendOrder.shipment.receiver_phone.trim() !== "-")
      ? backendOrder.shipment.receiver_phone.trim()
      : undefined,
    shippingAddress: backendOrder.shipment
      ? `${backendOrder.shipment.detail_address}, ${backendOrder.shipment.ward}, ${backendOrder.shipment.district}, ${backendOrder.shipment.province}`
      : undefined,
    orderStatus: backendOrder.order_status,
  paymentStatus: backendOrder.payment_status,
  sellerConfirmed: backendOrder.seller_confirmed,
  sellerConfirmedAt: backendOrder.seller_confirmed_at ?? undefined,
  subtotalAmount: Number(backendOrder.subtotal_amount),
  shippingFee: Number(backendOrder.shipping_fee),
  totalAmount: Number(backendOrder.total_amount),
  customerNote: backendOrder.customer_note ?? undefined,
  preferredPaymentMethod: backendOrder.preferred_payment_method as PaymentMethod | undefined,
  paymentExpiresAt: backendOrder.payment_expires_at,
  sellerConfirmExpiresAt: backendOrder.seller_confirm_expires_at,
  deliveredAt: backendOrder.delivered_at ?? (backendOrder as any).deliveredAt ?? undefined,
  autoCompleteAt: backendOrder.auto_complete_at ?? (backendOrder as any).autoCompleteAt ?? undefined,
  completedAt: backendOrder.completed_at ?? undefined,
  cancelledAt: backendOrder.cancelled_at ?? undefined,
  returnTag: backendOrder.return_tag ?? (backendOrder as any).returnTag ?? undefined,
  returnRequest: backendOrder.return_request
    ? normalizeBackendOrderReturn(backendOrder.return_request)
    : (backendOrder as any).returnRequest
      ? normalizeBackendOrderReturn((backendOrder as any).returnRequest)
      : undefined,
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
    originalPriceSnapshot: item.original_price_snapshot ? Number(item.original_price_snapshot) : undefined,
    quantity: item.quantity,
    subtotal: Number(item.subtotal),
    isReviewed: Boolean(item.is_reviewed)
  })),
  shipment: backendOrder.shipment ? {
    shippingProviderId: backendOrder.shipment.shipping_provider_id,
    shippingProviderName: backendOrder.shipment.shipping_provider_name,
    trackingCode: backendOrder.shipment.tracking_code,
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
    receiverName: "-",
    receiverPhone: "-",
    province: "-",
    district: "-",
    ward: "-",
    detailAddress: "-",
    addressType: "HOME"
  },
  timeline: (backendOrder.status_logs || (backendOrder as any).statusLogs || []).map((l: any) => ({
    id: String(l.id || Math.random()),
    oldStatus: l.old_status || l.oldStatus,
    newStatus: l.new_status || l.newStatus,
    note: l.note || "",
    createdAt: l.created_at || l.createdAt
  })),
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
  logoUrl: application.shopLogoUrl ?? "",
  description: application.shopDescription ?? "Hồ sơ shop được đồng bộ từ backend seller application.",
  phone: application.phone,
  email: application.email,
  pickupAddress: application.pickupAddress,
  shippingProviders: application.shippingProviders ?? [],
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
  left.shippingProviders?.length === right.shippingProviders?.length &&
  left.status === right.status &&
  left.rejectedReason === right.rejectedReason &&
  left.totalSold === right.totalSold &&
  left.totalRevenue === right.totalRevenue &&
  left.approvedAt === right.approvedAt &&
  left.closedAt === right.closedAt;
