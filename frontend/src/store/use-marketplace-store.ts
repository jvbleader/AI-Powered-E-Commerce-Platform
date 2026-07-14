"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initialState } from "@/data/mock";
import {
  canCustomerCancel,
  canSellerCancel,
  createOrderFromGroup,
  createPaymentFromOrders,
  getCartRows,
  makeOrderCode,
  makePaymentCode,
  selectedCheckoutGroups
} from "@/lib/helpers";
import { AUTH_BASE_PATH, ApiError, apiFetch } from "@/lib/api";
import type {
  Address,
  AppState,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  Role,
  SellerApplication,
  SellerStatus,
  Shop,
  User,
  ProductVariant,
  Order,
  Category
} from "@/types/models";

const STORAGE_KEY = "shepoo-marketplace-state-v4";
const VERIFICATION_CONTEXT_KEY = "shepoo-verification-context-v4";
const LEGACY_STORAGE_KEYS = ["shepoo-marketplace-state-v1", "shepoo-marketplace-state-v2", "shepoo-marketplace-state-v3", "shepoo-verification-context-v1", "shepoo-verification-context-v2", "shepoo-verification-context-v3"];
const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=240&q=80";
const DEFAULT_SHOP_LOGO = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=240&q=80";
const AUTH_ROUTES = {
  me: `${AUTH_BASE_PATH}/me`,
  login: `${AUTH_BASE_PATH}/login`,
  register: `${AUTH_BASE_PATH}/register`,
  verifyEmail: `${AUTH_BASE_PATH}/verify-email`,
  resendEmail: `${AUTH_BASE_PATH}/verify-email/send`,
  verifyPhone: `${AUTH_BASE_PATH}/verify-phone`,
  resendPhone: `${AUTH_BASE_PATH}/verify-phone/send`,
  requestPasswordReset: `${AUTH_BASE_PATH}/reset-password/send-email`,
  resetPassword: `${AUTH_BASE_PATH}/reset-password`,
  changePassword: `${AUTH_BASE_PATH}/change-password`,
  logout: `${AUTH_BASE_PATH}/logout`,
  logoutAll: `${AUTH_BASE_PATH}/logout-all`
};
const SELLER_ROUTES = {
  me: "/seller/me",
  application: "/seller/application"
};
const ADMIN_SELLER_APPLICATION_ROUTES = {
  list: "/admin/seller-applications",
  detail: (sellerPublicId: string) => `/admin/seller-applications/${sellerPublicId}`,
  approve: (sellerPublicId: string) => `/admin/seller-applications/${sellerPublicId}/approve`,
  reject: (sellerPublicId: string) => `/admin/seller-applications/${sellerPublicId}/reject`
};
const SELLER_PRODUCT_ROUTES = {
  list: "/seller/products",
  create: "/seller/products",
  update: (productId: string) => `/seller/products/${productId}`,
  hide: (productId: string) => `/seller/products/${productId}/hide`,
  delete: (productId: string) => `/seller/products/${productId}`
};
const SELLER_ORDER_ROUTES = {
  list: "/seller/orders",
  confirm: (orderId: string) => `/seller/orders/${orderId}/confirm`,
  shipping: (orderId: string) => `/seller/orders/${orderId}/shipping`
};

type BackendUser = {
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

type BackendRegisterResponse = {
  full_name: string;
  user_name: string;
  email: string;
  phone: string;
};

type RegistrationStatusResponse = {
  message: string;
  registrationId?: string | null;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  completed: boolean;
};

type MessageResponse = {
  message: string;
};

type BackendStatusResponse = {
  completed: boolean;
  message?: string;
};

type BackendSellerMeResponse = {
  has_seller_profile: boolean;
  status: SellerStatus | null;
  can_access_seller_dashboard: boolean;
};

type BackendSellerApplication = {
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

type BackendSellerApplicationDetail = {
  user: BackendUser;
  seller_profile: BackendSellerApplication;
};

type SellerApplicationDetail = {
  user: User;
  application: SellerApplication;
};

type BackendImageResponse = {
  image_url: string;
  is_thumbnail: boolean;
  sort_order: number;
};

type BackendVariantResponse = {
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
};

type BackendProductResponse = {
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

type BackendProductListResponse = {
  items: BackendProductResponse[];
  total: number;
};

type BackendOrderResponse = {
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
};

type BackendOrderListResponse = {
  items: BackendOrderResponse[];
  total: number;
};

type SellerApplicationPayload = Pick<
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

type VerificationContext = {
  registrationId?: string | null;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
};

const cloneState = (): AppState => JSON.parse(JSON.stringify(initialState)) as AppState;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^0(3|5|7|8|9)\d{8}$/;

const persistState = (state: AppState) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
};

const slugifyShopName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const normalizeAuthEmail = (email: string) => email.trim().toLowerCase();

const normalizeAuthPhone = (phone: string) => {
  const compact = phone.trim().replace(/[\s.\-()]/g, "");
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`;
  if (compact.startsWith("84") && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
};

const authIdentifier = (identifier: string) => {
  const value = identifier.trim();
  if (value.includes("@")) return normalizeAuthEmail(value);
  const phone = normalizeAuthPhone(value);
  return PHONE_RE.test(phone) ? phone : value;
};

const validateRegistrationPayload = (
  payload: Pick<User, "fullName" | "email" | "phone"> & { password: string; confirmPassword: string }
) => {
  const fullName = payload.fullName.trim();
  const email = normalizeAuthEmail(payload.email);
  const phone = normalizeAuthPhone(payload.phone);
  const password = payload.password.trim();
  const confirmPassword = payload.confirmPassword.trim();

  if (fullName.length < 2) return { ok: false as const, message: "Ho ten phai co it nhat 2 ky tu." };
  if (!EMAIL_RE.test(email)) return { ok: false as const, message: "Email khong hop le." };
  if (!PHONE_RE.test(phone)) return { ok: false as const, message: "So dien thoai khong hop le." };
  if (password.length < 8) return { ok: false as const, message: "Mat khau phai co it nhat 8 ky tu." };
  if (password !== confirmPassword) return { ok: false as const, message: "Mat khau xac nhan khong khop." };
  return { ok: true as const, fullName, email, phone, password, confirmPassword };
};

const validateNewPasswordPayload = (newPasswordValue: string, confirmPasswordValue: string) => {
  const newPassword = newPasswordValue.trim();
  const confirmPassword = confirmPasswordValue.trim();

  if (newPassword.length < 8) return { ok: false as const, message: "Mat khau moi phai co it nhat 8 ky tu." };
  if (newPassword !== confirmPassword) return { ok: false as const, message: "Mat khau xac nhan khong khop." };
  return { ok: true as const, newPassword, confirmPassword };
};

const validateSellerApplicationPayload = (payload: SellerApplicationPayload) => {
  const shopName = payload.shopName.trim();
  const phone = normalizeAuthPhone(payload.phone);
  const email = normalizeAuthEmail(payload.email);
  const pickupAddress = payload.pickupAddress.trim();
  const taxCode = payload.taxCode.trim();
  const bankName = payload.bankName.trim();
  const bankAccountNumber = payload.bankAccountNumber.trim();
  const bankAccountName = payload.bankAccountName.trim();

  if (shopName.length < 4 || shopName.length > 100) return { ok: false as const, message: "Ten shop phai co 4-100 ky tu." };
  if (!PHONE_RE.test(phone)) return { ok: false as const, message: "So dien thoai shop khong hop le." };
  if (!EMAIL_RE.test(email)) return { ok: false as const, message: "Email shop khong hop le." };
  if (pickupAddress.length < 10 || pickupAddress.length > 200) return { ok: false as const, message: "Dia chi lay hang phai co 10-200 ky tu." };
  if (taxCode.length < 10 || taxCode.length > 14) return { ok: false as const, message: "Ma so thue phai co 10-14 ky tu." };
  if (bankName.length < 2 || bankName.length > 150) return { ok: false as const, message: "Ten ngan hang phai co 2-150 ky tu." };
  if (bankAccountNumber.length < 3 || bankAccountNumber.length > 30) return { ok: false as const, message: "So tai khoan phai co 3-30 ky tu." };
  if (bankAccountName.length < 8 || bankAccountName.length > 100) return { ok: false as const, message: "Ten chu tai khoan phai co 8-100 ky tu." };

  return {
    ok: true as const,
    shopName,
    phone,
    email,
    pickupAddress,
    taxCode,
    bankName,
    bankAccountNumber,
    bankAccountName
  };
};

const usernameFromRegistration = (email: string, phone: string) => {
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";
  const cleaned = localPart.replace(/[^a-z0-9_]/g, "").slice(0, 32);
  if (cleaned.length >= 2) return cleaned;
  return `user${phone.slice(-6)}`.slice(0, 40);
};

const backendRegisterToStatus = (result: BackendRegisterResponse): RegistrationStatusResponse => ({
  message: "Dang ky thanh cong. Vui long xac thuc email neu backend da gui ma.",
  registrationId: result.user_name,
  email: result.email,
  phone: result.phone,
  emailVerified: false,
  phoneVerified: false,
  completed: false
});

const statusToVerificationContext = (status: RegistrationStatusResponse): VerificationContext => ({
  registrationId: status.registrationId,
  email: status.email,
  phone: status.phone,
  emailVerified: status.emailVerified,
  phoneVerified: status.phoneVerified
});

const readVerificationContext = () => {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(VERIFICATION_CONTEXT_KEY);
  return raw ? (JSON.parse(raw) as VerificationContext) : undefined;
};

const persistVerificationContext = (context: VerificationContext | undefined) => {
  if (typeof window === "undefined") return;
  if (context) {
    window.localStorage.setItem(VERIFICATION_CONTEXT_KEY, JSON.stringify(context));
  } else {
    window.localStorage.removeItem(VERIFICATION_CONTEXT_KEY);
  }
};

const roleHomePath = (role: Role | "GUEST") => {
  if (role === "ADMIN") return "/admin";
  if (role === "SUPPORTER") return "/supporter";
  if (role === "SELLER") return "/seller";
  return "/";
};

const mergeById = <T extends { id: string }>(seed: T[], saved?: T[]) => {
  const savedMap = new Map((saved ?? []).map((item) => [item.id, item]));
  const merged = seed.map((item) => savedMap.get(item.id) ?? item);
  const extraSaved = (saved ?? []).filter((item) => !seed.some((seedItem) => seedItem.id === item.id));
  return [...merged, ...extraSaved];
};

const hydrateSavedState = (saved: AppState): AppState => {
  const seed = cloneState();
  return {
    ...seed,
    ...saved,
    users: mergeById(seed.users, saved.users),
    shops: mergeById(seed.shops, saved.shops),
    categories: mergeById(seed.categories, saved.categories),
    products: mergeById(seed.products, saved.products),
    variants: mergeById(seed.variants, saved.variants),
    addresses: mergeById(seed.addresses, saved.addresses),
    orders: mergeById(seed.orders, saved.orders),
    payments: mergeById(seed.payments, saved.payments),
    notifications: mergeById(seed.notifications, saved.notifications),
    conversations: mergeById(seed.conversations, saved.conversations),
    cartItems: saved.cartItems ?? seed.cartItems,
    activeRole: saved.activeRole ?? seed.activeRole
  };
};

const preferredRoleFor = (user: User) =>
  user.roles.includes("ADMIN")
    ? "ADMIN"
    : user.roles.includes("SUPPORTER")
      ? "SUPPORTER"
      : user.roles.includes("SELLER")
        ? "SELLER"
        : "CUSTOMER";

const activeRoleForUser = (user: User, currentRole: Role | "GUEST") => {
  if (currentRole === "CUSTOMER") return "CUSTOMER";
  if (currentRole !== "GUEST" && user.roles.includes(currentRole)) return currentRole;
  return preferredRoleFor(user);
};

const normalizeBackendUser = (user: BackendUser): User => ({
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

const sameUserSnapshot = (left: User, right: User) =>
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

const applyBackendUser = (
  prev: AppState,
  backendUser: BackendUser,
  preserveActiveRole = true
): AppState => {
  const user = normalizeBackendUser(backendUser);
  const existingUser = prev.users.find((entry) => entry.id === user.id);
  const users = existingUser
    ? sameUserSnapshot(existingUser, user)
      ? prev.users
      : prev.users.map((entry) => (entry.id === user.id ? user : entry))
    : [...prev.users, user];
  const activeRole = preserveActiveRole
    ? activeRoleForUser(user, prev.activeRole)
    : preferredRoleFor(user);

  if (users === prev.users && prev.sessionUserId === user.id && prev.activeRole === activeRole) {
    return prev;
  }

  return {
    ...prev,
    users,
    sessionUserId: user.id,
    activeRole
  };
};

const upsertBackendUser = (prev: AppState, backendUser: BackendUser): { state: AppState; user: User } => {
  const user = normalizeBackendUser(backendUser);
  const existingUser = prev.users.find((entry) => entry.id === user.id);
  const users = existingUser
    ? sameUserSnapshot(existingUser, user)
      ? prev.users
      : prev.users.map((entry) => (entry.id === user.id ? user : entry))
    : [...prev.users, user];

  return {
    state: users === prev.users ? prev : { ...prev, users },
    user
  };
};

const normalizeBackendSellerApplication = (
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

const normalizeBackendProduct = (
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
    viewCount: backendProduct.view_count,
    categoryIds: backendProduct.categories ? backendProduct.categories.map((c) => c.id.toString()) : [],
    imageUrls: backendProduct.images.map((img) => img.image_url),
    thumbnailUrl:
      backendProduct.images.find((img) => img.is_thumbnail)?.image_url ??
      backendProduct.images[0]?.image_url ??
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    createdAt: backendProduct.created_at,
    variantOptions: backendProduct.variant_options ?? undefined
  };

  const variants: ProductVariant[] = backendProduct.variants.map((variant) => ({
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
    inventory: { quantity: 0, reservedQuantity: 0 }, // Not tracking inventory in variant response yet
    tierIndex: variant.tier_index ?? undefined
  }));

  return { product, variants };
};

const normalizeBackendOrder = (
  backendOrder: BackendOrderResponse,
  sellerId: string,
  userId: string
): Order => ({
  id: backendOrder.public_id,
  orderCode: backendOrder.order_code,
  userId: userId,
  sellerId: sellerId,
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
  items: [], // Details not in list response yet
  shipment: {
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
  createdAt: backendOrder.created_at
});

const sellerApplicationToShop = (
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
  description: "Ho so shop duoc dong bo tu backend seller application.",
  phone: application.phone,
  email: application.email,
  pickupAddress: application.pickupAddress,
  shippingFee: Number(backendApplication.shipping_fee ?? 0),
  shippingProviderName: backendApplication.shipping_provider_name ?? "Chua cau hinh",
  status: application.status ?? fallbackStatus,
  rejectedReason: application.rejectedReason,
  totalSold: 0,
  totalRevenue: 0,
  approvedAt: application.approvedAt
});

const sameShopSnapshot = (left: Shop, right: Shop) =>
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

const upsertSellerApplicationShop = (
  prev: AppState,
  user: User,
  application: SellerApplication,
  backendApplication: BackendSellerApplication,
  fallbackStatus?: SellerStatus
): AppState => {
  const incomingShop = sellerApplicationToShop(application, backendApplication, user, fallbackStatus);
  const existingShop = prev.shops.find((shop) => shop.id === incomingShop.id || shop.userId === user.id);
  const nextShop = existingShop
    ? {
        ...existingShop,
        ...incomingShop,
        totalSold: existingShop.totalSold,
        totalRevenue: existingShop.totalRevenue
      }
    : incomingShop;

  const shops = existingShop
    ? sameShopSnapshot(existingShop, nextShop)
      ? prev.shops
      : prev.shops.map((shop) => (shop.id === existingShop.id ? nextShop : shop))
    : [incomingShop, ...prev.shops];

  const shouldAddSellerRole =
    incomingShop.status === "APPROVED" &&
    prev.users.some((entry) => entry.id === user.id && !entry.roles.includes("SELLER"));

  const users = shouldAddSellerRole
    ? prev.users.map((entry) =>
        entry.id === user.id && !entry.roles.includes("SELLER")
          ? { ...entry, roles: [...entry.roles, "SELLER" as Role] }
          : entry
      )
    : prev.users;

  if (shops === prev.shops && users === prev.users) {
    return prev;
  }

  return {
    ...prev,
    shops,
    users
  };
};

export const useMarketplaceStore = () => {
  const [state, setState] = useState<AppState>(() => cloneState());
  const [verificationContext, setVerificationContext] = useState<VerificationContext | undefined>();
  const [ready, setReady] = useState(false);

  const fetchedSellerProductsRef = useRef(false);
  const fetchedSellerOrdersStatusRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setState(hydrateSavedState(JSON.parse(saved) as AppState));
    }
    setVerificationContext(readVerificationContext());
    setReady(true);

    apiFetch<BackendUser>(AUTH_ROUTES.me)
      .then((user) => {
        if (!cancelled) {
          setState((prev) => applyBackendUser(prev, user));
        }
      })
      .catch((error) => {
        if (!cancelled && error instanceof ApiError && ["NOT_AUTHENTICATED", "USER_NOT_VERIFIED"].includes(error.code ?? "")) {
          setState((prev) => {
            const nextState = { ...prev, sessionUserId: undefined, activeRole: "GUEST" as const };
            if (prev.sessionUserId) {
              persistState(nextState);
              window.location.href = "/login";
            }
            return nextState;
          });
        }
      });

    const handleUnauthorized = () => {
      setState((prev) => {
        const nextState = { ...prev, sessionUserId: undefined, activeRole: "GUEST" as const };
        if (prev.sessionUserId) {
          persistState(nextState);
          window.location.href = "/login";
        }
        return nextState;
      });
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);

    return () => {
      cancelled = true;
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (ready) {
      persistState(state);
    }
  }, [ready, state]);

  const currentUser = useMemo(
    () => state.users.find((user) => user.id === state.sessionUserId),
    [state.sessionUserId, state.users]
  );

  const currentShop = useMemo(() => {
    if (!currentUser) return undefined;
    return state.shops.find((shop) => shop.userId === currentUser.id);
  }, [currentUser, state.shops]);

  const cartRows = useMemo(
    () => getCartRows(state.cartItems, state.products, state.variants, state.shops),
    [state.cartItems, state.products, state.shops, state.variants]
  );

  const login = useCallback(async (identifier: string, password: string) => {
    const normalizedIdentifier = authIdentifier(identifier);
    try {
      const loginResult = await apiFetch<MessageResponse | BackendStatusResponse>(AUTH_ROUTES.login, {
        method: "POST",
        body: JSON.stringify({
          identifier: normalizedIdentifier,
          password
        })
      });
      const backendUser = await apiFetch<BackendUser>(AUTH_ROUTES.me);
      const user = normalizeBackendUser(backendUser);
      setState((prev) => applyBackendUser(prev, backendUser, false));
      const preferredRole = preferredRoleFor(user);
      const message =
        "message" in loginResult && loginResult.message
          ? loginResult.message
          : `Da dang nhap bang ${user.fullName}.`;
      return {
        ok: true,
        message,
        redirectTo: roleHomePath(preferredRole)
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, message: error.message };
      }
    }

    const hydrated = hydrateSavedState(state);
    const user = hydrated.users.find(
      (entry) =>
        normalizeAuthEmail(entry.email) === normalizedIdentifier ||
        normalizeAuthPhone(entry.phone) === normalizedIdentifier
    );

    if (!user) {
      return { ok: false, message: "Khong tim thay tai khoan." };
    }

    if (user.status === "LOCKED") {
      return {
        ok: false,
        message: `Tài khoản bị khóa. Lý do: ${user.lockReason ?? "Không rõ"}.`
      };
    }

    if (!user.emailVerified || !user.phoneVerified) {
      return { ok: false, message: "Tai khoan chua xac thuc email va so dien thoai." };
    }

    const preferredRole = user.roles.includes("ADMIN")
      ? "ADMIN"
      : user.roles.includes("SUPPORTER")
        ? "SUPPORTER"
        : user.roles.includes("SELLER")
          ? "SELLER"
          : "CUSTOMER";

    setState({ ...hydrated, sessionUserId: user.id, activeRole: preferredRole });
    return { ok: true, message: `Đã đăng nhập bằng ${user.fullName}.`, redirectTo: roleHomePath(preferredRole) };
  }, [state]);

  const setCategories = useCallback((categories: Category[]) => {
    setState((prev) => ({ ...prev, categories }));
  }, []);

  const register = useCallback(async (
    payload: Pick<User, "fullName" | "email" | "phone"> & { password: string; confirmPassword: string }
  ) => {
    const validation = validateRegistrationPayload(payload);
    if (!validation.ok) {
      return { ok: false, message: validation.message };
    }

    try {
      const result = await apiFetch<BackendRegisterResponse>(AUTH_ROUTES.register, {
        method: "POST",
        body: JSON.stringify({
          full_name: validation.fullName,
          user_name: usernameFromRegistration(validation.email, validation.phone),
          email: validation.email,
          phone: validation.phone,
          password: validation.password,
          confirm_password: validation.confirmPassword
        })
      });
      const registrationStatus = backendRegisterToStatus(result);
      const context = statusToVerificationContext(registrationStatus);
      persistVerificationContext(context);
      setVerificationContext(context);
      setState((prev) => ({ ...prev, sessionUserId: undefined, activeRole: "GUEST" }));

      let message = registrationStatus.message;
      try {
        const query = new URLSearchParams({ phone: validation.phone });
        const otpResult = await apiFetch<MessageResponse>(`${AUTH_ROUTES.resendPhone}?${query.toString()}`, {
          method: "POST"
        });
        message = otpResult.message;
      } catch (error) {
        message =
          error instanceof ApiError
            ? `Dang ky thanh cong, nhung chua gui duoc OTP: ${error.message}`
            : "Dang ky thanh cong, nhung chua gui duoc OTP. Hay bam Gui lai ma.";
      }

      return {
        ok: true,
        message,
        redirectTo: "/verify-phone"
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, message: error.message };
      }
      return {
        ok: false,
        message: "Khong ket noi duoc backend dang ky. Hay chay backend o http://127.0.0.1:8000 roi thu lai."
      };
    }
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    if (!token.trim()) return { ok: false, message: "Vui long nhap ma xac thuc email." };

    try {
      const query = new URLSearchParams({ token: token.trim() });
      const result = await apiFetch<BackendStatusResponse>(`${AUTH_ROUTES.verifyEmail}?${query.toString()}`, {
        method: "POST"
      });
      const status: RegistrationStatusResponse = {
        message: result.message ?? "Xac thuc email thanh cong.",
        registrationId: verificationContext?.registrationId,
        email: verificationContext?.email ?? "",
        phone: verificationContext?.phone ?? "",
        emailVerified: result.completed,
        phoneVerified: verificationContext?.phoneVerified ?? false,
        completed: result.completed
      };
      if (status.completed) {
        persistVerificationContext(undefined);
        setVerificationContext(undefined);
        setState((prev) => ({ ...prev, sessionUserId: undefined, activeRole: "GUEST" }));
      } else {
        const context = statusToVerificationContext(status);
        persistVerificationContext(context);
        setVerificationContext(context);
      }
      return {
        ok: true,
        message: status.message,
        redirectTo: status.completed ? "/login" : status.phoneVerified ? "/verify-email" : "/verify-phone"
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, message: error.message };
      }
      return { ok: false, message: "Khong the xac thuc email luc nay." };
    }
  }, []);

  const verifyPhone = useCallback(async (phone: string, otp: string) => {
    const normalizedPhone = normalizeAuthPhone(phone);
    if (!PHONE_RE.test(normalizedPhone)) return { ok: false, message: "So dien thoai khong hop le." };
    if (!/^\d{6}$/.test(otp.trim())) return { ok: false, message: "OTP phai gom 6 chu so." };

    try {
      const query = new URLSearchParams({ phone: normalizedPhone, otp: otp.trim() });
      const result = await apiFetch<BackendStatusResponse>(`${AUTH_ROUTES.verifyPhone}?${query.toString()}`, {
        method: "POST"
      });
      const status: RegistrationStatusResponse = {
        message: result.message ?? "Xac thuc so dien thoai thanh cong.",
        registrationId: verificationContext?.registrationId,
        email: verificationContext?.email ?? currentUser?.email ?? "",
        phone: normalizedPhone,
        emailVerified: verificationContext?.emailVerified ?? currentUser?.emailVerified ?? false,
        phoneVerified: result.completed,
        completed: Boolean((verificationContext?.emailVerified ?? currentUser?.emailVerified) && result.completed)
      };
      if (status.completed) {
        persistVerificationContext(undefined);
        setVerificationContext(undefined);
        setState((prev) => ({ ...prev, sessionUserId: undefined, activeRole: "GUEST" }));
      } else {
        const context = statusToVerificationContext(status);
        persistVerificationContext(context);
        setVerificationContext(context);
      }
      return {
        ok: true,
        message: status.message,
        redirectTo: status.completed ? "/login" : status.emailVerified ? "/verify-phone" : "/verify-email"
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, message: error.message };
      }
      return { ok: false, message: "Khong the xac thuc so dien thoai luc nay." };
    }
  }, [currentUser?.email, currentUser?.emailVerified, verificationContext?.email, verificationContext?.emailVerified, verificationContext?.registrationId]);

  const resendEmailVerification = useCallback(async () => {
    try {
      const query = new URLSearchParams({
        email: verificationContext?.email ?? "",
        full_name: currentUser?.fullName ?? verificationContext?.email?.split("@")[0] ?? ""
      });
      const result = await apiFetch<MessageResponse>(`${AUTH_ROUTES.resendEmail}?${query.toString()}`, {
        method: "POST"
      });
      return { ok: true, message: result.message };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, message: error.message };
      }
      return { ok: false, message: "Khong the gui lai ma xac thuc email luc nay." };
    }
  }, [currentUser?.fullName, verificationContext?.email]);

  const resendPhoneVerification = useCallback(async (phoneOverride?: string) => {
    const normalizedPhone = normalizeAuthPhone(phoneOverride ?? verificationContext?.phone ?? currentUser?.phone ?? "");
    if (!PHONE_RE.test(normalizedPhone)) return { ok: false, message: "So dien thoai khong hop le." };

    try {
      const query = new URLSearchParams({ phone: normalizedPhone });
      const result = await apiFetch<MessageResponse>(`${AUTH_ROUTES.resendPhone}?${query.toString()}`, {
        method: "POST"
      });
      const context: VerificationContext = {
        registrationId: verificationContext?.registrationId,
        email: verificationContext?.email ?? currentUser?.email ?? "",
        phone: normalizedPhone,
        emailVerified: verificationContext?.emailVerified ?? currentUser?.emailVerified ?? false,
        phoneVerified: false
      };
      persistVerificationContext(context);
      setVerificationContext(context);
      return { ok: true, message: result.message };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, message: error.message };
      }
      return { ok: false, message: "Khong the gui lai OTP luc nay." };
    }
  }, [currentUser?.email, currentUser?.emailVerified, currentUser?.phone, verificationContext?.email, verificationContext?.emailVerified, verificationContext?.phone, verificationContext?.registrationId]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const normalizedEmail = normalizeAuthEmail(email);
    if (!EMAIL_RE.test(normalizedEmail)) return { ok: false, message: "Email khong hop le." };

    try {
      const query = new URLSearchParams({ email: normalizedEmail });
      const result = await apiFetch<MessageResponse>(`${AUTH_ROUTES.requestPasswordReset}?${query.toString()}`, {
        method: "POST"
      });
      return { ok: true, message: result.message };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, message: error.message };
      }
      return { ok: false, message: "Khong the gui email dat lai mat khau luc nay." };
    }
  }, []);

  const resetPassword = useCallback(async (token: string, newPasswordValue: string, confirmPasswordValue: string) => {
    const cleanToken = token.trim();
    if (!cleanToken) return { ok: false, message: "Vui long nhap token dat lai mat khau." };

    const validation = validateNewPasswordPayload(newPasswordValue, confirmPasswordValue);
    if (!validation.ok) return { ok: false, message: validation.message };

    try {
      const query = new URLSearchParams({ token: cleanToken });
      const result = await apiFetch<MessageResponse>(`${AUTH_ROUTES.resetPassword}?${query.toString()}`, {
        method: "POST",
        body: JSON.stringify({
          new_password: validation.newPassword,
          new_password_confirm: validation.confirmPassword
        })
      });
      return { ok: true, message: result.message, redirectTo: "/login" };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, message: error.message };
      }
      return { ok: false, message: "Khong the dat lai mat khau luc nay." };
    }
  }, []);

  const changePassword = useCallback(async (
    currentPasswordValue: string,
    newPasswordValue: string,
    confirmPasswordValue: string
  ) => {
    const currentPassword = currentPasswordValue.trim();
    if (currentPassword.length < 8) return { ok: false, message: "Mat khau hien tai phai co it nhat 8 ky tu." };

    const validation = validateNewPasswordPayload(newPasswordValue, confirmPasswordValue);
    if (!validation.ok) return { ok: false, message: validation.message };

    try {
      const result = await apiFetch<MessageResponse>(AUTH_ROUTES.changePassword, {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: validation.newPassword,
          new_password_confirm: validation.confirmPassword
        })
      });
      return { ok: true, message: result.message };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, message: error.message };
      }
      return { ok: false, message: "Khong the doi mat khau luc nay." };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch<{ message: string }>(AUTH_ROUTES.logout, { method: "POST" });
    } catch {
      // Keep logout local even if the backend is offline.
    } finally {
      setState((prev) => ({ ...prev, sessionUserId: undefined, activeRole: "GUEST" }));
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      const result = await apiFetch<MessageResponse>(AUTH_ROUTES.logoutAll, { method: "POST" });
      setState((prev) => ({ ...prev, sessionUserId: undefined, activeRole: "GUEST" }));
      return { ok: true, message: result.message };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, message: error.message };
      }
      return { ok: false, message: "Khong the dang xuat tat ca thiet bi luc nay." };
    }
  }, []);

  const getSellerApplication = useCallback(async () => {
    if (!currentUser) {
      return { ok: false as const, message: "Ban can dang nhap de xem ho so shop." };
    }

    try {
      const sellerMe = await apiFetch<BackendSellerMeResponse>(SELLER_ROUTES.me);

      if (!sellerMe.has_seller_profile) {
        return {
          ok: true as const,
          sellerMe,
          application: undefined,
          message: "Ban chua gui ho so shop."
        };
      }

      const backendApplication = await apiFetch<BackendSellerApplication>(SELLER_ROUTES.application);
      const application = normalizeBackendSellerApplication(backendApplication, sellerMe.status);
      setState((prev) =>
        upsertSellerApplicationShop(prev, currentUser, application, backendApplication, sellerMe.status ?? "PENDING")
      );

      return {
        ok: true as const,
        sellerMe,
        application
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false as const, message: error.message };
      }

      return { ok: false as const, message: "Khong the ket noi backend seller application luc nay." };
    }
  }, [currentUser]);

  const saveSellerApplication = useCallback(async (
    payload: SellerApplicationPayload,
    mode: "create" | "update" = "create"
  ) => {
    if (!currentUser) {
      return { ok: false as const, message: "Ban can dang nhap de gui ho so shop." };
    }

    const validation = validateSellerApplicationPayload(payload);
    if (!validation.ok) {
      return { ok: false as const, message: validation.message };
    }

    try {
      const backendApplication = await apiFetch<BackendSellerApplication>(SELLER_ROUTES.application, {
        method: mode === "update" ? "PUT" : "POST",
        body: JSON.stringify({
          shop_name: validation.shopName,
          phone: validation.phone,
          email: validation.email,
          pickup_address: validation.pickupAddress,
          tax_code: validation.taxCode,
          bank_name: validation.bankName,
          bank_account_number: validation.bankAccountNumber,
          bank_account_name: validation.bankAccountName
        })
      });
      const application = normalizeBackendSellerApplication(backendApplication, "PENDING");
      setState((prev) => upsertSellerApplicationShop(prev, currentUser, application, backendApplication, "PENDING"));

      return {
        ok: true as const,
        message: mode === "update" ? "Da cap nhat ho so shop va chuyen ve cho duyet." : "Da gui ho so shop, vui long cho admin duyet.",
        application,
        redirectTo: "/seller/pending"
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false as const, message: error.message };
      }

      return { ok: false as const, message: "Khong the gui ho so shop len backend luc nay." };
    }
  }, [currentUser]);

  const listSellerApplications = useCallback(async (status?: SellerStatus | "") => {
    try {
      const query = new URLSearchParams({ page: "1", limit: "50" });
      if (status) query.set("status", status);

      const applications = await apiFetch<BackendSellerApplication[]>(
        `${ADMIN_SELLER_APPLICATION_ROUTES.list}?${query.toString()}`
      );

      return {
        ok: true as const,
        applications: applications.map((application) => normalizeBackendSellerApplication(application))
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false as const, message: error.message };
      }

      return { ok: false as const, message: "Khong the tai danh sach ho so seller luc nay." };
    }
  }, []);

  const getSellerApplicationDetail = useCallback(async (sellerPublicId: string) => {
    try {
      const result = await apiFetch<BackendSellerApplicationDetail>(
        ADMIN_SELLER_APPLICATION_ROUTES.detail(sellerPublicId)
      );
      const user = normalizeBackendUser(result.user);
      const application = normalizeBackendSellerApplication(result.seller_profile);

      setState((prev) => {
        const upsertedUser = upsertBackendUser(prev, result.user);
        return upsertSellerApplicationShop(
          upsertedUser.state,
          upsertedUser.user,
          application,
          result.seller_profile,
          application.status ?? "PENDING"
        );
      });

      return {
        ok: true as const,
        detail: {
          user,
          application
        } satisfies SellerApplicationDetail
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false as const, message: error.message };
      }

      return { ok: false as const, message: "Khong the tai chi tiet ho so seller luc nay." };
    }
  }, []);

  const reviewSellerApplication = useCallback(async (
    sellerPublicId: string,
    action: "approve" | "reject",
    rejectedReason?: string
  ) => {
    const cleanReason = rejectedReason?.trim();
    if (action === "reject" && !cleanReason) {
      return { ok: false as const, message: "Vui long nhap ly do tu choi ho so." };
    }

    try {
      const application = await apiFetch<BackendSellerApplication>(
        action === "approve"
          ? ADMIN_SELLER_APPLICATION_ROUTES.approve(sellerPublicId)
          : ADMIN_SELLER_APPLICATION_ROUTES.reject(sellerPublicId),
        {
          method: "PATCH",
          ...(action === "reject"
            ? { body: JSON.stringify({ rejected_reason: cleanReason }) }
            : {})
        }
      );

      const normalizedApplication = normalizeBackendSellerApplication(application);
      setState((prev) => ({
        ...prev,
        shops: prev.shops.map((shop) =>
          shop.id === sellerPublicId
            ? {
                ...shop,
                status: normalizedApplication.status ?? shop.status,
                rejectedReason: normalizedApplication.rejectedReason,
                approvedAt: normalizedApplication.approvedAt
              }
            : shop
        )
      }));

      return {
        ok: true as const,
        message: action === "approve" ? "Da duyet ho so seller." : "Da tu choi ho so seller.",
        application: normalizedApplication
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false as const, message: error.message };
      }

      return { ok: false as const, message: "Khong the cap nhat trang thai ho so seller luc nay." };
    }
  }, []);

  const switchRole = useCallback((role: Role | "GUEST") => {
    const user = state.users.find((entry) => entry.id === state.sessionUserId);
    if (role !== "GUEST" && role !== "CUSTOMER" && !user?.roles.includes(role)) {
      return false;
    }

    const nextState = { ...state, activeRole: role };
    setState(nextState);
    persistState(nextState);
    return true;
  }, [state]);

  const addToCart = useCallback((variantId: string, quantity: number) => {
    if (!state.sessionUserId) {
      return { ok: false, message: "Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng." };
    }
    setState((prev) => {
      const existing = prev.cartItems.find((item) => item.variantId === variantId);
      if (existing) {
        return {
          ...prev,
          cartItems: prev.cartItems.map((item) =>
            item.variantId === variantId ? { ...item, quantity: item.quantity + quantity, isSelected: true } : item
          )
        };
      }
      return {
        ...prev,
        cartItems: [
          ...prev.cartItems,
          { id: `cart-${prev.cartItems.length + 1}`, variantId, quantity, isSelected: true }
        ]
      };
    });
    return { ok: true, message: "Đã thêm vào giỏ hàng." };
  }, [state.sessionUserId]);

  const updateCartItem = useCallback((cartItemId: string, changes: { quantity?: number; isSelected?: boolean }) => {
    setState((prev) => ({
      ...prev,
      cartItems: prev.cartItems.map((item) =>
        item.id === cartItemId
          ? { ...item, quantity: Math.max(1, changes.quantity ?? item.quantity), isSelected: changes.isSelected ?? item.isSelected }
          : item
      )
    }));
  }, []);

  const removeCartItem = useCallback((cartItemId: string) => {
    setState((prev) => ({ ...prev, cartItems: prev.cartItems.filter((item) => item.id !== cartItemId) }));
  }, []);

  const selectAllCart = useCallback((selected: boolean) => {
    setState((prev) => ({ ...prev, cartItems: prev.cartItems.map((item) => ({ ...item, isSelected: selected })) }));
  }, []);

  const checkout = useCallback((addressId: string, method: PaymentMethod, note: string) => {
    if (!currentUser) return { ok: false, message: "Bạn cần đăng nhập để checkout.", paymentCode: undefined };
    const address = state.addresses.find((item) => item.id === addressId);
    if (!address) return { ok: false, message: "Vui lòng chọn địa chỉ giao hàng.", paymentCode: undefined };
    const rows = getCartRows(state.cartItems, state.products, state.variants, state.shops);
    const selectedUnavailable = rows.find((row) => row.item.isSelected && row.unavailable);
    if (selectedUnavailable) {
      return { ok: false, message: `Checkout thất bại: ${selectedUnavailable.reason}.`, paymentCode: undefined };
    }
    const groups = selectedCheckoutGroups(rows);
    if (!groups.length) return { ok: false, message: "Chưa có sản phẩm hợp lệ được chọn.", paymentCode: undefined };

    let paymentCode = "";
    setState((prev) => {
      const orders = groups.map((group, index) =>
        createOrderFromGroup(makeOrderCode(prev.orders.length + index), currentUser, group, address, note, prev.orders.length + index)
      );
      paymentCode = makePaymentCode(prev.payments.length);
      const payment = createPaymentFromOrders(paymentCode, currentUser.id, method, orders, prev.payments.length);
      const checkedVariantIds = new Set(groups.flatMap((group) => group.rows.map((row) => row.variant.id)));
      return {
        ...prev,
        orders: [...orders, ...prev.orders],
        payments: [payment, ...prev.payments],
        cartItems: prev.cartItems.filter((item) => !checkedVariantIds.has(item.variantId)),
        lastCheckoutPaymentCode: payment.paymentCode
      };
    });
    return { ok: true, message: "Đã tạo payment chung và tách đơn theo shop.", paymentCode };
  }, [currentUser, state.addresses, state.cartItems, state.products, state.shops, state.variants]);

  const updatePaymentStatus = useCallback((paymentCode: string, status: PaymentStatus) => {
    setState((prev) => {
      const payment = prev.payments.find((item) => item.paymentCode === paymentCode);
      const linkedCodes = new Set(payment?.orderCodes ?? []);
      return {
        ...prev,
        payments: prev.payments.map((item) =>
          item.paymentCode === paymentCode
            ? {
                ...item,
                paymentStatus: status,
                paidAt: status === "PAID" ? "2026-06-29T08:30:00.000Z" : item.paidAt,
                failedAt: status === "FAILED" ? "2026-06-29T08:30:00.000Z" : item.failedAt,
                cancelledAt: status === "CANCELLED" ? "2026-06-29T08:30:00.000Z" : item.cancelledAt
              }
            : item
        ),
        orders: prev.orders.map((order) =>
          linkedCodes.has(order.orderCode)
            ? {
                ...order,
                paymentStatus: status === "PAID" ? "PAID" : status === "FAILED" ? "FAILED" : status === "CANCELLED" ? "CANCELLED" : order.paymentStatus
              }
            : order
        )
      };
    });
  }, []);

  const retryPayment = useCallback((paymentCode: string) => {
    updatePaymentStatus(paymentCode, "PENDING");
  }, [updatePaymentStatus]);

  const cancelCustomerOrder = useCallback((orderCode: string) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((order) =>
        order.orderCode === orderCode && canCustomerCancel(order)
          ? {
              ...order,
              orderStatus: "CANCELLED",
              paymentStatus: "CANCELLED",
              cancelledAt: "2026-06-29T08:45:00.000Z",
              timeline: [
                ...order.timeline,
                {
                  id: `${order.orderCode}-cancel`,
                  oldStatus: order.orderStatus,
                  newStatus: "CANCELLED",
                  note: "Khách hàng hủy khi chưa thanh toán và shop chưa xác nhận",
                  createdAt: "2026-06-29T08:45:00.000Z"
                }
              ]
            }
          : order
      )
    }));
  }, []);

  const updateSellerOrder = useCallback((orderCode: string, nextStatus: OrderStatus) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((order) => {
        if (order.orderCode !== orderCode) return order;
        if (nextStatus === "CANCELLED" && !canSellerCancel(order)) return order;
        if (nextStatus === "READY_TO_SHIP" && order.paymentStatus !== "PAID") return order;
        if (nextStatus === "SHIPPING" && (order.paymentStatus !== "PAID" || !order.sellerConfirmed)) return order;
        return {
          ...order,
          sellerConfirmed: nextStatus === "READY_TO_SHIP" || nextStatus === "SHIPPING" || order.sellerConfirmed,
          sellerConfirmedAt:
            nextStatus === "READY_TO_SHIP" || nextStatus === "SHIPPING"
              ? "2026-06-29T09:00:00.000Z"
              : order.sellerConfirmedAt,
          orderStatus: nextStatus,
          completedAt: nextStatus === "COMPLETED" ? "2026-06-29T09:00:00.000Z" : order.completedAt,
          cancelledAt: nextStatus === "CANCELLED" ? "2026-06-29T09:00:00.000Z" : order.cancelledAt,
          timeline: [
            ...order.timeline,
            {
              id: `${order.orderCode}-${nextStatus}`,
              oldStatus: order.orderStatus,
              newStatus: nextStatus,
              note: "Người bán cập nhật trạng thái theo rule MVP",
              createdAt: "2026-06-29T09:00:00.000Z"
            }
          ]
        };
      })
    }));
  }, []);

  const updateSellerStatus = useCallback((shopId: string, status: SellerStatus, reason?: string) => {
    setState((prev) => ({
      ...prev,
      shops: prev.shops.map((shop) =>
        shop.id === shopId
          ? {
              ...shop,
              status,
              rejectedReason: status === "REJECTED" ? reason ?? "Hồ sơ chưa đạt yêu cầu." : shop.rejectedReason,
              approvedAt: status === "APPROVED" ? "2026-06-29T09:30:00.000Z" : shop.approvedAt,
              closedAt: status === "CLOSED" ? "2026-06-29T09:30:00.000Z" : shop.closedAt
            }
          : shop
      ),
      users:
        status === "APPROVED"
          ? prev.users.map((user) => {
              const shop = prev.shops.find((item) => item.id === shopId);
              if (shop?.userId !== user.id || user.roles.includes("SELLER")) return user;
              return { ...user, roles: [...user.roles, "SELLER"] };
            })
          : prev.users
    }));
  }, []);

  const toggleUserLock = useCallback((userId: string) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((user) =>
        user.id === userId
          ? user.status === "LOCKED"
            ? { ...user, status: "ACTIVE", lockedUntil: undefined, lockReason: undefined }
            : {
                ...user,
                status: "LOCKED",
                lockedUntil: "2026-07-29T00:00:00.000Z",
                lockReason: "Admin khóa thủ công từ dashboard."
              }
          : user
      )
    }));
  }, []);

  const fetchSellerProducts = useCallback(async (force = false) => {
    if (!currentShop) return { ok: false, message: "Shop không tồn tại." };
    if (!force && fetchedSellerProductsRef.current) return { ok: true, products: [] };
    fetchedSellerProductsRef.current = true;
    try {
      const response = await apiFetch<BackendProductListResponse>(SELLER_PRODUCT_ROUTES.list);
      const normalized = response.items.map((item) => normalizeBackendProduct(item, currentShop.id));
      const products = normalized.map((n) => n.product);
      const variants = normalized.flatMap((n) => n.variants);
      
      setState((prev) => {
        const productIds = new Set(products.map((p) => p.id));
        return {
          ...prev,
          products: [...prev.products.filter((p) => p.sellerId !== currentShop.id), ...products],
          variants: [...prev.variants.filter((v) => !productIds.has(v.productId)), ...variants]
        };
      });
      return { ok: true, products };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi tải sản phẩm." };
    }
  }, [currentShop]);

  const createSellerProduct = useCallback(async (payload: any) => {
    if (!currentShop) return { ok: false, message: "Shop không tồn tại." };
    try {
      const response = await apiFetch<BackendProductResponse>(SELLER_PRODUCT_ROUTES.create, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const { product, variants } = normalizeBackendProduct(response, currentShop.id);
      setState((prev) => ({
        ...prev,
        products: [product, ...prev.products.filter((p) => p.id !== product.id)],
        variants: [...variants, ...prev.variants.filter((v) => v.productId !== product.id)]
      }));
      return { ok: true, product };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi tạo sản phẩm." };
    }
  }, [currentShop]);

  const updateSellerProduct = useCallback(async (productId: string, payload: any) => {
    if (!currentShop) return { ok: false, message: "Shop không tồn tại." };
    try {
      const response = await apiFetch<BackendProductResponse>(SELLER_PRODUCT_ROUTES.update(productId), {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      const { product, variants } = normalizeBackendProduct(response, currentShop.id);
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) => p.id === product.id ? product : p),
        variants: [...variants, ...prev.variants.filter((v) => v.productId !== product.id)]
      }));
      return { ok: true, product };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi cập nhật sản phẩm." };
    }
  }, [currentShop]);

  const hideSellerProduct = useCallback(async (productId: string) => {
    if (!currentShop) return { ok: false, message: "Shop không tồn tại." };
    try {
      const response = await apiFetch<BackendProductResponse>(SELLER_PRODUCT_ROUTES.hide(productId), {
        method: "PATCH"
      });
      const { product, variants } = normalizeBackendProduct(response, currentShop.id);
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) => p.id === product.id ? product : p),
        variants: [...variants, ...prev.variants.filter((v) => v.productId !== product.id)]
      }));
      return { ok: true, product };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi ẩn sản phẩm." };
    }
  }, [currentShop]);

  const deleteSellerProduct = useCallback(async (productId: string) => {
    try {
      await apiFetch(SELLER_PRODUCT_ROUTES.delete(productId), { method: "DELETE" });
      setState((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== productId),
        variants: prev.variants.filter((v) => v.productId !== productId)
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi xóa sản phẩm." };
    }
  }, []);

  const fetchSellerOrders = useCallback(async (status?: OrderStatus | "", force = false) => {
    if (!currentShop || !currentUser) return { ok: false, message: "Shop không tồn tại." };
    const queryStatus = status || "";
    if (!force && fetchedSellerOrdersStatusRef.current === queryStatus) return { ok: true, orders: [] };
    fetchedSellerOrdersStatusRef.current = queryStatus;
    try {
      const query = new URLSearchParams({ page: "1", limit: "100" });
      if (status) query.set("status", status);
      const response = await apiFetch<BackendOrderListResponse>(`${SELLER_ORDER_ROUTES.list}?${query.toString()}`);
      
      const orders = response.items.map((item) => normalizeBackendOrder(item, currentShop.id, currentUser.id));
      
      setState((prev) => {
        const incomingIds = new Set(orders.map((o) => o.id));
        return {
          ...prev,
          orders: [
            ...orders,
            ...prev.orders.filter((o) => o.sellerId !== currentShop.id || !incomingIds.has(o.id))
          ]
        };
      });
      return { ok: true, orders };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi tải đơn hàng." };
    }
  }, [currentShop, currentUser]);

  const confirmSellerOrder = useCallback(async (orderId: string) => {
    if (!currentShop || !currentUser) return { ok: false, message: "Shop không tồn tại." };
    try {
      const response = await apiFetch<BackendOrderResponse>(SELLER_ORDER_ROUTES.confirm(orderId), {
        method: "PATCH"
      });
      const order = normalizeBackendOrder(response, currentShop.id, currentUser.id);
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === order.id ? { ...o, ...order } : o))
      }));
      return { ok: true, order };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi xác nhận đơn hàng." };
    }
  }, [currentShop, currentUser]);

  const shippingSellerOrder = useCallback(async (orderId: string) => {
    if (!currentShop || !currentUser) return { ok: false, message: "Shop không tồn tại." };
    try {
      const response = await apiFetch<BackendOrderResponse>(SELLER_ORDER_ROUTES.shipping(orderId), {
        method: "PATCH"
      });
      const order = normalizeBackendOrder(response, currentShop.id, currentUser.id);
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === order.id ? { ...o, ...order } : o))
      }));
      return { ok: true, order };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi chuyển trạng thái shipping." };
    }
  }, [currentShop, currentUser]);

  const saveProduct = useCallback((product: Product, productVariants = state.variants.filter((variant) => variant.productId === product.id)) => {
    setState((prev) => {
      const exists = prev.products.some((item) => item.id === product.id);
      const incomingVariantIds = new Set(productVariants.map((variant) => variant.id));
      return {
        ...prev,
        products: exists ? prev.products.map((item) => (item.id === product.id ? product : item)) : [product, ...prev.products],
        variants: [
          ...prev.variants.filter((variant) => variant.productId !== product.id || !incomingVariantIds.has(variant.id)),
          ...productVariants
        ]
      };
    });
  }, [state.variants]);

  const addAddress = useCallback((address: Omit<Address, "id" | "userId">) => {
    if (!currentUser) return;
    setState((prev) => ({
      ...prev,
      addresses: [
        ...prev.addresses.map((item) =>
          item.userId === currentUser.id && address.isDefault ? { ...item, isDefault: false } : item
        ),
        { ...address, id: `addr-${prev.addresses.length + 1}`, userId: currentUser.id }
      ]
    }));
  }, [currentUser]);

  const resetDemo = useCallback(() => {
    const fresh = cloneState();
    setState(fresh);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    state,
    ready,
    currentUser,
    currentShop,
    verificationContext,
    cartRows,
    login,
    register,
    verifyEmail,
    verifyPhone,
    resendEmailVerification,
    resendPhoneVerification,
    requestPasswordReset,
    resetPassword,
    changePassword,
    logout,
    logoutAll,
    getSellerApplication,
    saveSellerApplication,
    listSellerApplications,
    getSellerApplicationDetail,
    reviewSellerApplication,
    switchRole,
    addToCart,
    updateCartItem,
    removeCartItem,
    selectAllCart,
    checkout,
    updatePaymentStatus,
    retryPayment,
    cancelCustomerOrder,
    updateSellerOrder,
    updateSellerStatus,
    toggleUserLock,
    fetchSellerProducts,
    createSellerProduct,
    updateSellerProduct,
    hideSellerProduct,
    deleteSellerProduct,
    setCategories,
    fetchSellerOrders,
    confirmSellerOrder,
    shippingSellerOrder,
    saveProduct,
    addAddress,
    resetDemo
  };
};
