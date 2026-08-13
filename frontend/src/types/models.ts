// Modified frontend/src/types/models.ts - added shopLogoUrl?: string to SellerApplication interface

export type Role = "CUSTOMER" | "SELLER" | "ADMIN" | "SUPPORTER";
export type UserStatus = "ACTIVE" | "LOCKED" | "DELETED";
export type SellerStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | "CLOSED";
export type ProductStatus = "ACTIVE" | "HIDDEN" | "OUT_OF_STOCK" | "DELETED";
export type VariantStatus = ProductStatus;
export type OrderStatus =
  | "PLACED"
  | "READY_TO_SHIP"
  | "SHIPPING"
  | "COMPLETED"
  | "DELIVERY_FAILED"
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
  BANK_TRANSFER = "BANK_TRANSFER",
  MOMO = "MOMO",
  CREDIT_CARD = "CREDIT_CARD",
  VNPAY = "VNPAY",
}
export type PaymentMethod = "MOCK" | "BANK_TRANSFER" | "MOMO" | "CREDIT_CARD" | "VNPAY";
export type AddressType = "HOME" | "OFFICE";

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

export interface Shop {
  id: string;
  userId: string;
  shopName: string;
  shopSlug: string;
  logoUrl: string;
  description: string;
  phone: string;
  email: string;
  pickupAddress: string;
  shippingFee: number;
  shippingProviderName: string;
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
}
export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  level: number;
  imageUrl?: string;
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
  imageUrl?: string;
  status: VariantStatus;
  tierIndex?: number[];
  inventory?: {
    quantity: number;
    reservedQuantity: number;
  };
}

export interface Product {
  id: string;
  sellerId: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  brand?: string;
  origin?: string;
  warranty?: string;
  status: ProductStatus;
  averageRating: number;
  reviewCount: number;
  soldCount: number;
  categoryIds: string[];
  imageUrls: string[];
  thumbnailUrl: string;
  createdAt: string;
  variantOptions?: {
    name: string;
    values: string[];
  }[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productName: string;
  variantName: string;
  imageUrl: string;
}

export interface Order {
  id: string;
  userId: string;
  shopId: string;
  status: OrderStatus;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  receiverName: string;
  phone: string;
  shippingAddress: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  paidAt?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: string;
}
