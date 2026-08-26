export type Role = "CUSTOMER" | "SELLER" | "ADMIN" | "SUPPORTER";
export type UserStatus = "ACTIVE" | "LOCKED" | "DELETED";
export type SellerStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | "CLOSED";
export type ProductStatus = "ACTIVE" | "HIDDEN" | "OUT_OF_STOCK" | "DELETED";
export type VariantStatus = ProductStatus;
export type OrderStatus =
  | "PLACED"
  | "READY_TO_SHIP"
  | "SHIPPING"
  | "DELIVERED"
  | "COMPLETED"
  | "DELIVERY_FAILED"
  | "RETURNED"
  | "CANCELLED";
export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "PARTIAL_REFUND_PENDING"
  | "PARTIALLY_REFUNDED";
export enum PaymentMethodEnum {
  MOCK = "MOCK",
  VNPAY = "VNPAY",
  WALLET = "WALLET",
  COD = "COD",
}
export type PaymentMethod = "MOCK" | "VNPAY" | "WALLET" | "COD";
export type OrderReturnStatus =
  | "REQUESTED"
  | "SELLER_APPROVED"
  | "RETURNING"
  | "COMPLETED"
  | "SELLER_REJECTED"
  | "DISPUTED"
  | "SUPPORT_APPROVED"
  | "SUPPORT_REJECTED";
export type ReturnTag =
  | "DISPUTED"
  | "RETURN_SUCCESS"
  | "RETURN_FAILED_SELLER_REJECTED"
  | "RETURN_SUCCESS_SUPPORT_APPROVED"
  | "RETURN_FAILED_SUPPORT_REJECTED"
  | string;
export type AddressType = "HOME" | "OFFICE";

export interface OrderReturn {
  id: string | number;
  publicId?: string;
  returnCode: string;
  orderId: string | number;
  userId: string | number;
  sellerId: string | number;
  returnStatus: OrderReturnStatus;
  reason: string;
  description: string;
  evidenceImages?: string[];
  sellerRejectReason?: string;
  sellerRespondedAt?: string;
  returnShippingProvider?: string;
  returnTrackingCode?: string;
  pickupAddress?: string;
  returnAddress?: string;
  disputeReason?: string;
  disputedAt?: string;
  supporterId?: number;
  supporterDecision?: string;
  supporterNote?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt?: string;
  order?: Order;
  user?: {
    id?: string;
    fullName?: string;
    avatarUrl?: string;
  };
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  birthday?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: UserStatus;
  lockedUntil?: string;
  lockReason?: string;
  roles: Role[];
}

export interface Address {
  id: string;
  userId: string;
  receiverName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detailAddress: string;
  addressType: AddressType;
  isDefault: boolean;
}

export interface ShippingProvider {
  id?: number | string;
  publicId?: string;
  name: string;
  code?: string;
  fixedFee?: number;
  logoUrl?: string;
  active?: boolean;
}

export interface Shop {
  id: string;
  publicId?: string;
  userId: string;
  shopName: string;
  shopSlug: string;
  logoUrl: string;
  description: string;
  phone: string;
  email: string;
  pickupAddress: string;
  shippingFee?: number;
  shippingProviderName?: string;
  shippingProviders?: ShippingProvider[];
  status: SellerStatus;
  rejectedReason?: string;
  totalSold: number;
  totalRevenue: number;
  approvedAt?: string;
  closedAt?: string;
  reviewCount?: number;
  productCount?: number;
}

export interface SellerApplication {
  publicId?: string;
  shopName: string;
  shopSlug?: string;
  shopLogoUrl?: string;
  phone: string;
  email: string;
  pickupAddress: string;
  taxCode: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  status?: SellerStatus;
  rejectedReason?: string;
  approvedAt?: string;
  shopDescription?: string;
  shippingProviderPublicIds?: string[];
  shippingProviders?: ShippingProvider[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number;
  isDefaultOther?: boolean;
  parentId?: string;
  level?: number;
  imageUrl?: string;
}

export interface Inventory {
  quantity: number;
  reservedQuantity: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  variantName: string;
  price: number;
  salePrice?: number;
  saleStartAt?: string;
  saleEndAt?: string;
  imageUrl: string;
  status: VariantStatus;
  inventory: Inventory;
  tierIndex?: number[];
}

export interface Product {
  id: string;
  sellerId: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  brand?: string;
  origin: string;
  warranty?: string;
  status: ProductStatus;
  averageRating: number;
  reviewCount: number;
  soldCount: number;
  categoryIds: string[];
  categories?: { id: string | number; name: string; slug?: string }[];
  imageUrls: string[];
  thumbnailUrl: string;
  createdAt: string;
  variantOptions?: any[];
}

export interface CartItem {
  id: string;
  variantId: string;
  quantity: number;
  isSelected: boolean;
}

export interface OrderItem {
  id: string;
  orderId?: string;
  productId?: string;
  variantId?: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  productImageSnapshot: string;
  sellerNameSnapshot: string;
  skuSnapshot: string;
  unitPrice: number;
  originalPriceSnapshot?: number;
  quantity: number;
  subtotal: number;
  totalPrice?: number;
  productName?: string;
  variantName?: string;
  imageUrl?: string;
  isReviewed?: boolean;
}

export interface ShipmentSnapshot {
  shippingProviderId?: number;
  shippingProviderName?: string;
  trackingCode?: string;
  receiverName: string;
  receiverPhone: string;
  province: string;
  district: string;
  ward: string;
  detailAddress: string;
  addressType: AddressType;
  shippedAt?: string;
  deliveredAt?: string;
  failedAt?: string;
}

export interface TimelineEntry {
  id: string;
  oldStatus?: OrderStatus;
  newStatus: OrderStatus;
  note: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderCode: string;
  userId: string;
  sellerId: string;
  shopDbId?: number;
  shopName?: string;
  shopSlug?: string;
  shopId?: string;
  orderStatus: OrderStatus;
  status?: OrderStatus;
  paymentStatus: PaymentStatus;
  sellerConfirmed: boolean;
  sellerConfirmedAt?: string;
  subtotalAmount: number;
  shippingFee: number;
  totalAmount: number;
  finalAmount?: number;
  customerNote?: string;
  paymentMethod?: string;
  preferredPaymentMethod?: PaymentMethod;
  paymentExpiresAt: string;
  sellerConfirmExpiresAt: string;
  deliveredAt?: string;
  autoCompleteAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  returnTag?: string;
  returnRequest?: OrderReturn;
  receiverName?: string;
  phone?: string;
  shippingAddress?: string;
  items: OrderItem[];
  shipment: ShipmentSnapshot;
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt?: string;
  printCount: number;
}

export interface Payment {
  id: string;
  orderId?: string;
  paymentCode: string;
  userId: string;
  paymentMethod: PaymentMethod;
  method?: PaymentMethod;
  paymentGateway?: string;
  paymentStatus: PaymentStatus;
  status?: PaymentStatus;
  amount: number;
  transactionCode?: string;
  transactionId?: string;
  expiresAt: string;
  paidAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  orderCodes: string[];
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: "ORDER" | "PAYMENT" | "SELLER" | "REPORT" | "CHAT";
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  customerName: string;
  assignedSupporter: string;
  status: "OPEN" | "CLOSED";
  mode: "AI" | "SUPPORTER";
  lastMessageAt: string;
  lastMessage?: string;
  participants?: string[];
  updatedAt?: string;
  messages: {
    id: string;
    sender: "CUSTOMER" | "SUPPORTER" | "AI";
    text: string;
    createdAt: string;
    isRead: boolean;
  }[];
}

export type ViolationReportStatus = "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";

export interface ViolationReport {
  id: string;
  reporterId: string;
  reporterName?: string;
  reporterEmail?: string;
  productId: string;
  productPublicId?: string;
  productName?: string;
  productImage?: string;
  reasonType: string;
  description: string;
  imageUrls?: string[];
  status: ViolationReportStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface AppState {
  sidebarCollapsed: boolean;
  users: User[];
  shops: Shop[];
  categories: Category[];
  products: Product[];
  variants: ProductVariant[];
  cartItems: CartItem[];
  addresses: Address[];
  orders: Order[];
  payments: Payment[];
  notifications: Notification[];
  conversations: Conversation[];
  violationReports?: ViolationReport[];
  hiddenProductIds: string[];
  sessionUserId?: string;
  activeRole: Role | "GUEST";
  activeShop?: Shop | null;
  lastCheckoutPaymentCode?: string;
  lastCheckoutOrderCodes?: string[];
  lastCheckoutPaymentMethod?: PaymentMethod;
}

export interface VerificationContext {
  registrationId?: string | null;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}
