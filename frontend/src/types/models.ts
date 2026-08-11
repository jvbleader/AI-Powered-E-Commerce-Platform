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
