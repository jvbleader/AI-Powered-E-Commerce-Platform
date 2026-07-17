import { 
  MarketplaceStore, 
  persistState, 
  SELLER_ROUTES, 
  ADMIN_SELLER_APPLICATION_ROUTES,
  BackendSellerMeResponse,
  BackendSellerApplication,
  normalizeBackendSellerApplication,
  upsertSellerApplicationShop,
  BackendSellerApplicationDetail,
  SellerApplicationPayload,
  validateSellerApplicationPayload,
  normalizeBackendUser,
  upsertBackendUser,
  SellerApplicationDetail
} from './types';
import { StateCreator } from "zustand";
import type { AppState, SellerStatus, User, Role, Shop, SellerApplication } from "@/types/models";
import { ApiError, apiFetch } from "@/services/api";

export const createSellerSlice: StateCreator<MarketplaceStore, [], [], any> = (set, get) => {
  const setState = (updater: ((state: AppState) => AppState) | Partial<AppState>) => {
    set((store) => {
      const nextState = typeof updater === 'function' ? updater(store.state) : { ...store.state, ...updater };
      persistState(nextState);
      return { state: nextState };
    });
  };

  return {
    getSellerApplication: async () => {
      const { state, verificationContext } = get();

    const user = get().getCurrentUser();
    if (!user) {
      return { ok: false as const, message: "Bạn cần đăng nhập để xem hồ sơ shop." };
    }

    try {
      const sellerMe = await apiFetch<BackendSellerMeResponse>(SELLER_ROUTES.me);

      if (!sellerMe.has_seller_profile) {
        return {
          ok: true as const,
          sellerMe,
          application: undefined,
          message: "Bạn chưa gửi hồ sơ shop."
        };
      }

      const backendApplication = await apiFetch<BackendSellerApplication>(SELLER_ROUTES.application);
      const application = normalizeBackendSellerApplication(backendApplication, sellerMe.status);
      setState((prev: AppState) =>
        upsertSellerApplicationShop(prev, user, application, backendApplication, sellerMe.status ?? "PENDING")
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

      return { ok: false as const, message: "Không thể kết nối đến server hồ sơ người bán." };
    }
  },
    saveSellerApplication: async (payload: SellerApplicationPayload, mode: "create" | "update" = "create") => {
      const { state, verificationContext } = get();

    const user = get().getCurrentUser();
    if (!user) {
      return { ok: false as const, message: "Bạn cần đăng nhập để gửi hồ sơ shop." };
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
      setState((prev: AppState) => upsertSellerApplicationShop(prev, user, application, backendApplication, "PENDING"));

      return {
        ok: true as const,
        message: mode === "update" ? "Đã cập nhật hồ sơ shop và chuyển về chờ duyệt." : "Đã gửi hồ sơ shop, vui lòng chờ admin duyệt.",
        application,
        redirectTo: "/seller/pending"
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false as const, message: error.message };
      }

      return { ok: false as const, message: "Không thể gửi hồ sơ shop lên máy chủ lúc này." };
    }
  },
    listSellerApplications: async (status?: SellerStatus | "") => {
      const { state, verificationContext } = get();

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

      return { ok: false as const, message: "Không thể tải danh sách hồ sơ người bán lúc này." };
    }
  },
    getSellerApplicationDetail: async (sellerPublicId: string) => {
      const { state, verificationContext } = get();

    try {
      const result = await apiFetch<BackendSellerApplicationDetail>(
        ADMIN_SELLER_APPLICATION_ROUTES.detail(sellerPublicId)
      );
      const user = normalizeBackendUser(result.user);
      const application = normalizeBackendSellerApplication(result.seller_profile);

      setState((prev: AppState) => {
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

      return { ok: false as const, message: "Không thể tải chi tiết hồ sơ người bán lúc này." };
    }
  },
    reviewSellerApplication: async (sellerPublicId: string, action: "approve" | "reject", rejectedReason?: string) => {
      const { state, verificationContext } = get();

      const cleanReason = rejectedReason?.trim();
      if (action === "reject" && !cleanReason) {
        return { ok: false as const, message: "Vui lòng nhập lý do từ chối hồ sơ." };
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
        setState((prev: AppState) => ({
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
          message: action === "approve" ? "Đã duyệt hồ sơ người bán." : "Đã từ chối hồ sơ người bán.",
          application: normalizedApplication
        };
      } catch (error) {
        if (error instanceof ApiError) {
          return { ok: false as const, message: error.message };
        }

        return { ok: false as const, message: "Không thể cập nhật trạng thái hồ sơ người bán lúc này." };
      }
    },
    saveShop: async (shop: Shop) => {
      const { state, verificationContext } = get();

      setState((prev: AppState) => {
        const exists = prev.shops.some((item) => item.id === shop.id);
        if (exists) return prev;
        return { ...prev, shops: [...prev.shops, shop] };
      });
    },
  };
};
