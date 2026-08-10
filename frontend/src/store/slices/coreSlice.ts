import { MarketplaceStore, persistState, STORAGE_KEY, ToastTone } from './types';
import { StateCreator } from "zustand";
import type { AppState, User, Conversation } from "@/types/models";

export const createCoreSlice: StateCreator<MarketplaceStore, [], [], any> = (set, get) => {
  const toastTimeoutRef = { current: null as any };

  const setState = (updater: ((state: AppState) => AppState) | Partial<AppState>) => {
    set((store) => {
      const nextState = typeof updater === 'function' ? updater(store.state) : { ...store.state, ...updater };
      persistState(nextState);
      return { state: nextState };
    });
  };
  const setToast = (toast: any) => set({ toast });
  const cloneState = () => typeof structuredClone === 'function' ? structuredClone(get().state) : JSON.parse(JSON.stringify(get().state));
  return {
    resetDemo: async () => {
      const { state, verificationContext } = get();

    const fresh = cloneState();
    setState(fresh);
    window.localStorage.removeItem(STORAGE_KEY);
  },
    showToast: async (message: string, tone: ToastTone = "info") => {
      const { state, verificationContext } = get();

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, tone });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(undefined);
      toastTimeoutRef.current = null;
    }, 2600);
  },
    setUsers: async (users: User[]) => {
      const { state, verificationContext } = get();

    setState((prev: AppState) => ({ ...prev, users }));
  },
    toggleSidebar: () => {
      setState((prev: AppState) => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
    },
    setConversations: async (conversations: Conversation[]) => {
      const { state, verificationContext } = get();

    setState((prev: AppState) => ({ ...prev, conversations }));
  },
    submitViolationReport: async (reportData: { productId: string; reasonType: string; description: string; imageUrls?: string[] }) => {
      const state = get().state;
      const currentUser = get().getCurrentUser();
      const product = state.products.find(p => p.id === reportData.productId);

      const newReport: import("@/types/models").ViolationReport = {
        id: "rep_" + Date.now(),
        reporterId: currentUser?.id || "guest",
        reporterName: currentUser?.fullName || "Khách hàng",
        reporterEmail: currentUser?.email || "user@example.com",
        productId: reportData.productId,
        productName: product?.name || "Sản phẩm",
        productImage: product?.thumbnailUrl || product?.imageUrls?.[0] || "",
        reasonType: reportData.reasonType,
        description: reportData.description,
        imageUrls: reportData.imageUrls || [],
        status: "PENDING",
        createdAt: new Date().toISOString()
      };

      setState((prev: AppState) => ({
        ...prev,
        violationReports: [newReport, ...(prev.violationReports || [])]
      }));

      try {
        const { apiFetch } = await import("@/services/api");
        await apiFetch("/reports", {
          method: "POST",
          body: JSON.stringify({
            product_id: parseInt(reportData.productId) || reportData.productId,
            reason_type: reportData.reasonType,
            description: reportData.description,
            image_urls: reportData.imageUrls || []
          })
        });
      } catch (e) {
        console.warn("Backend API submit report call ignored, local state updated:", e);
      }

      return newReport;
    },
    updateViolationReportStatus: async (reportId: string, status: import("@/types/models").ViolationReportStatus) => {
      setState((prev: AppState) => ({
        ...prev,
        violationReports: (prev.violationReports || []).map((r) =>
          r.id === reportId
            ? { ...r, status, resolvedAt: status === "RESOLVED" || status === "REJECTED" ? new Date().toISOString() : r.resolvedAt }
            : r
        )
      }));

      try {
        const { apiFetch } = await import("@/services/api");
        await apiFetch(`/admin/violation-reports/${reportId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status })
        });
      } catch (e) {
        console.warn("Backend API update report status call ignored, local state updated:", e);
      }
    },
    hideProductByAdmin: async (productId: string, productPublicId?: string) => {
      try {
        const { apiFetch } = await import("@/services/api");
        await apiFetch(`/admin/products/${productId}/hide`, {
          method: "PATCH"
        });
        
        setState((prev: AppState) => ({
          ...prev,
          hiddenProductIds: [...prev.hiddenProductIds, productId, ...(productPublicId ? [productPublicId] : [])],
          products: prev.products.map((p) => p.id === (productPublicId || productId) ? { ...p, status: "HIDDEN" } : p)
        }));
        
        return { ok: true };
      } catch (error: any) {
        return { ok: false, message: error?.message || "Lỗi khi ẩn sản phẩm." };
      }
    },
    deleteViolationReport: async (reportId: string) => {
      setState((prev: AppState) => ({
        ...prev,
        violationReports: (prev.violationReports || []).filter((r) => r.id !== reportId)
      }));
    }
  };
};
