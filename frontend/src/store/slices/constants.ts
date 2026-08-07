import { initialState } from "@/store/initial-state";
import type { AppState, Role, VerificationContext } from "@/types/models";

import { STORAGE_KEYS } from "@/constants/storage-keys";
import { ENV } from "@/config/env";

export const STORAGE_KEY = STORAGE_KEYS.MARKETPLACE_STATE;
export const VERIFICATION_CONTEXT_KEY = STORAGE_KEYS.VERIFICATION_CONTEXT;
export const LEGACY_STORAGE_KEYS = STORAGE_KEYS.LEGACY_KEYS;
export const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=240&q=80";
export const DEFAULT_SHOP_LOGO = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=240&q=80";

export const AUTH_BASE_PATH = ENV.NEXT_PUBLIC_AUTH_BASE_PATH;

export const AUTH_ROUTES = {
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

export const SELLER_ROUTES = {
  me: "/seller/me",
  application: "/seller/application",
  dashboardSummary: "/seller/dashboard-summary",
  recalculateDashboardSummary: "/seller/dashboard-summary/recalculate"
};


export const ADMIN_SELLER_APPLICATION_ROUTES = {
  list: "/admin/seller-applications",
  detail: (sellerPublicId: string) => `/admin/seller-applications/${sellerPublicId}`,
  approve: (sellerPublicId: string) => `/admin/seller-applications/${sellerPublicId}/approve`,
  reject: (sellerPublicId: string) => `/admin/seller-applications/${sellerPublicId}/reject`
};

export const SELLER_PRODUCT_ROUTES = {
  list: "/seller/products",
  create: "/seller/products",
  update: (productId: string) => `/seller/products/${productId}`,
  hide: (productId: string) => `/seller/products/${productId}/hide`,
  unhide: (productId: string) => '/seller/products/' + productId + '/unhide',
  delete: (productId: string) => `/seller/products/${productId}`
};

export const SELLER_ORDER_ROUTES = {
  list: "/seller/orders",
  confirm: (orderId: string) => `/seller/orders/${orderId}/confirm`,
  shipping: (orderId: string) => `/seller/orders/${orderId}/shipping`,
  cancel: (orderId: string) => `/seller/orders/${orderId}/cancel`
};

export const cloneState = (): AppState => JSON.parse(JSON.stringify(initialState)) as AppState;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^0(3|5|7|8|9)\d{8}$/;

export const persistState = (state: AppState) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
};

export const readVerificationContext = (): VerificationContext | undefined => {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(VERIFICATION_CONTEXT_KEY);
  return raw ? (JSON.parse(raw) as VerificationContext) : undefined;
};

export const persistVerificationContext = (context: VerificationContext | undefined) => {
  if (typeof window === "undefined") return;
  if (context) {
    window.localStorage.setItem(VERIFICATION_CONTEXT_KEY, JSON.stringify(context));
  } else {
    window.localStorage.removeItem(VERIFICATION_CONTEXT_KEY);
  }
};

export const roleHomePath = (role: Role | "GUEST") => {
  if (role === "ADMIN") return "/admin";
  if (role === "SUPPORTER") return "/supporter";
  if (role === "SELLER") return "/seller";
  return "/";
};
