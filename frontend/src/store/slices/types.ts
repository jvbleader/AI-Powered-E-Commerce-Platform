import type { Address, AddressType, AppState, OrderStatus, PaymentMethod, PaymentStatus, Product, Role, SellerApplication, SellerStatus, Shop, User, ProductVariant, Order, Payment, Category, Conversation, VerificationContext } from "@/types/models";
export type { Address, AddressType, AppState, OrderStatus, PaymentMethod, PaymentStatus, Product, Role, SellerApplication, SellerStatus, Shop, User, ProductVariant, Order, Payment, Category, Conversation, VerificationContext };
export { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext, createElement } from "react";
import { initialState } from "@/store/initial-state";
export { initialState };

// Re-export new modular files
export * from "./constants";
export * from "./validators";
export * from "./normalizers";
export * from "./state-helpers";

export type BackendUser = {
  publicId?: string;
  public_id?: string;
  fullName?: string;
  full_name?: string;
  fullname?: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  gender?: User["gender"] | null;
  dateOfBirth?: string | null;
  date_of_birth?: string | null;
  emailVerifiedAt?: string | null;
  email_verified_at?: string | null;
  phoneVerifiedAt?: string | null;
  phone_verified_at?: string | null;
  status?: User["status"];
  lockedUntil?: string | null;
  locked_until?: string | null;
  lockReason?: string | null;
  lock_reason?: string | null;
  roles?: Role[];
};

export type BackendRegisterResponse = {
  full_name: string;
  user_name: string;
  email: string;
  phone: string;
};

export type RegistrationStatusResponse = {
  message: string;
  registrationId?: string | null;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  completed: boolean;
};

export type MessageResponse = {
  message: string;
};

export type BackendStatusResponse = {
  completed: boolean;
  message?: string;
};

export type BackendSellerMeResponse = {
  has_seller_profile: boolean;
  status: SellerStatus | null;
  can_access_seller_dashboard: boolean;
};

export type BackendSellerApplication = {
  public_id: string;
  publicId?: string;
  shop_name: string;
  shop_slug?: string | null;
  phone: string;
  email: string;
  pickup_address: string;
  tax_code?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  shipping_fee?: number | string | null;
  shipping_provider_name?: string | null;
  status?: SellerStatus | null;
  approved_at?: string | null;
  rejected_reason?: string | null;
};

export type BackendSellerApplicationDetail = {
  user: BackendUser;
  seller_profile: BackendSellerApplication;
};

export type SellerApplicationDetail = {
  user: User;
  application: SellerApplication;
};

export type BackendImageResponse = {
  image_url: string;
  is_thumbnail: boolean;
  sort_order: number;
};

export type BackendVariantResponse = {
  public_id: string;
  sku: string;
  variant_name: string;
  price: string | number;
  sale_price?: string | number | null;
  sale_start_at?: string | null;
  sale_end_at?: string | null;
  image_url?: string | null;
  status: Product["status"];
  tier_index?: number[] | null;
  inventory?: {
    quantity: number;
    reserved_quantity: number;
  } | null;
};

export type BackendProductResponse = {
  public_id: string;
  name: string;
  slug: string;
  short_description?: string | null;
  description?: string | null;
  brand?: string | null;
  origin?: string | null;
  warranty_info?: string | null;
  status: Product["status"];
  average_rating: number;
  review_count: number;
  sold_count: number;
  view_count: number;
  created_at: string;
  updated_at?: string | null;
  images: BackendImageResponse[];
  variants: BackendVariantResponse[];
  categories?: { id: number; name: string }[];
  variant_options?: any[] | null;
};

export type BackendProductListResponse = {
  items: BackendProductResponse[];
  total: number;
};

export type BackendOrderResponse = {
  public_id: string;
  order_code: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  seller_confirmed: boolean;
  seller_confirmed_at?: string | null;
  subtotal_amount: string | number;
  shipping_fee: string | number;
  product_discount_amount: string | number;
  shipping_discount_amount: string | number;
  total_amount: string | number;
  customer_note?: string | null;
  payment_expires_at: string;
  seller_confirm_expires_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  seller?: { public_id: string; shop_name: string; shop_logo_url?: string | null };
  items?: any[];
  shipment?: any;
};

export type BackendOrderListResponse = {
  items: BackendOrderResponse[];
  total: number;
};

export type SellerApplicationPayload = Pick<
  SellerApplication,
  | "shopName"
  | "phone"
  | "email"
  | "pickupAddress"
  | "taxCode"
  | "bankName"
  | "bankAccountNumber"
  | "bankAccountName"
>;


export type ToastTone = "success" | "danger" | "info";
export type ToastState = { message: string; tone: ToastTone } | undefined;

export type MarketplaceStore = {
  // ── Core state ──
  state: AppState;
  ready: boolean;
  toast: ToastState;
  verificationContext: VerificationContext | undefined;

  // ── Computed ──
  getCurrentUser: () => User | undefined;
  getCurrentShop: () => Shop | undefined;
  getCartRows: () => import("@/lib/helpers").CartRow[];

  // ── Lifecycle ──
  initialize: () => void;

  // ── Auth slice ──
  login: (identifier: string, password: string) => Promise<{ ok: boolean; message: string; redirectTo?: string }>;
  register: (payload: Pick<User, "fullName" | "email" | "phone"> & { password: string; confirmPassword: string }) => Promise<{ ok: boolean; message: string; redirectTo?: string }>;
  verifyEmail: (token: string) => Promise<{ ok: boolean; message: string; redirectTo?: string }>;
  verifyPhone: (phone: string, otp: string) => Promise<{ ok: boolean; message: string; redirectTo?: string }>;
  resendEmailVerification: () => Promise<{ ok: boolean; message: string }>;
  resendPhoneVerification: (phoneOverride?: string) => Promise<{ ok: boolean; message: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message: string }>;
  resetPassword: (token: string, newPassword: string, confirmPassword: string) => Promise<{ ok: boolean; message: string; redirectTo?: string }>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<{ ok: boolean; message: string }>;
  updateProfile: (updates: { fullName?: string; gender?: string; dateOfBirth?: string; avatarUrl?: string }) => Promise<{ ok: boolean; message: string }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<{ ok: boolean; message: string }>;
  switchRole: (role: Role | "GUEST") => Promise<boolean>;
  toggleUserLock: (userId: string) => Promise<void>;
  updateSellerStatus: (shopId: string, status: SellerStatus, reason?: string) => Promise<void>;

  // ── Cart slice ──
  addToCart: (variantId: string, quantity: number) => Promise<any>;
  updateCartItem: (cartItemId: string, changes: { quantity?: number; isSelected?: boolean }) => Promise<any>;
  removeCartItem: (cartItemId: string) => Promise<any>;
  selectAllCart: (selected: boolean) => Promise<any>;

  // ── Order slice ──
  checkout: (addressId: string, paymentMethod: PaymentMethod, customerNote?: string) => Promise<any>;
  updatePaymentStatus: (paymentCode: string, status: PaymentStatus) => Promise<any>;
  retryPayment: (paymentCode: string, paymentMethod: PaymentMethod) => Promise<any>;
  cancelCustomerOrder: (orderCode: string) => Promise<any>;
  confirmCustomerReceipt: (orderCode: string) => Promise<any>;
  fetchCustomerOrderDetail: (orderCode: string) => Promise<any>;
  fetchSellerOrderDetail: (orderCode: string) => Promise<any>;
  fetchSellerOrders: (status?: OrderStatus | "", force?: boolean) => Promise<any>;
  fetchCustomerOrders: (status?: OrderStatus | "", force?: boolean) => Promise<any>;
  confirmSellerOrder: (orderCode: string) => Promise<any>;
  shippingSellerOrder: (orderCode: string) => Promise<any>;
  cancelSellerOrder: (orderCode: string) => Promise<any>;

  // ── Product slice ──
  fetchSellerProducts: () => Promise<any>;
  createSellerProduct: (payload: any) => Promise<any>;
  updateSellerProduct: (productId: string, payload: any) => Promise<any>;
  hideSellerProduct: (productId: string) => Promise<any>;
  unhideSellerProduct: (productId: string) => Promise<any>;
  deleteSellerProduct: (productId: string) => Promise<any>;
  saveProduct: (product: Product, productVariants?: ProductVariant[]) => Promise<any>;
  setCategories: (categories: Category[]) => void;

  // ── Seller slice ──
  getSellerApplication: () => Promise<any>;
  saveSellerApplication: (payload: SellerApplicationPayload, mode?: "create" | "update") => Promise<any>;
  listSellerApplications: (status?: SellerStatus | "") => Promise<any>;
  getSellerApplicationDetail: (applicationId: string) => Promise<any>;
  reviewSellerApplication: (applicationId: string, action: string, reason?: string) => Promise<any>;
  saveShop: (updates: any) => Promise<any>;

  // ── Address slice ──
  fetchAddresses: () => Promise<any>;
  addAddress: (address: any) => Promise<any>;
  updateAddress: (addressId: string, updates: any) => Promise<any>;
  removeAddress: (addressId: string) => Promise<any>;

  // ── Core slice ──
  resetDemo: () => Promise<void>;
  showToast: (message: string, tone?: ToastTone) => Promise<void>;
  setUsers: (users: User[]) => Promise<void>;
  setConversations: (conversations: Conversation[]) => Promise<void>;
};
