import { 
  MarketplaceStore, 
  persistState, 
  SELLER_ORDER_ROUTES, 
  normalizeBackendOrder,
  BackendOrderResponse,
  BackendOrderListResponse
} from './types';
import { StateCreator } from "zustand";
import type { AppState, PaymentMethod, PaymentStatus, OrderStatus, Payment } from "@/types/models";
import { ApiError, apiFetch } from "@/services/api";
import { orderApi } from "@/services/order-api";
import { paymentApi } from "@/services/payment-api";
import { 
  getCartRows, 
  selectedCheckoutGroups, 
  createPaymentFromOrders 
} from "@/lib/helpers";

export const createOrderSlice: StateCreator<MarketplaceStore, [], [], any> = (set, get) => {
  const fetchedCustomerOrdersStatusRef = { current: "idle" };
  const fetchedSellerOrdersStatusRef = { current: "idle" };

  const setState = (updater: ((state: AppState) => AppState) | Partial<AppState>) => {
    set((store) => {
      const nextState = typeof updater === 'function' ? updater(store.state) : { ...store.state, ...updater };
      persistState(nextState);
      return { state: nextState };
    });
  };
  const setToast = (toast: any) => set({ toast });
  const setReady = (ready: boolean) => set({ ready });
  const setVerificationContext = (ctx: any) => set({ verificationContext: ctx });
  const cloneState = () => typeof structuredClone === 'function' ? structuredClone(get().state) : JSON.parse(JSON.stringify(get().state));
  return {
    checkout: async (addressId: string, method: PaymentMethod, note: string) => {
      const { state } = get();

    if (!get().getCurrentUser()) return { ok: false, message: "Bạn cần đăng nhập để checkout.", paymentCode: undefined };
    const address = state.addresses.find((item: any) => item.id === addressId);
    if (!address) return { ok: false, message: "Vui lòng chọn địa chỉ giao hàng.", paymentCode: undefined };
    const rows = getCartRows(state.cartItems, state.products, state.variants, state.shops);
    const selectedUnavailable = rows.find((row) => row.item.isSelected && row.unavailable);
    if (selectedUnavailable) {
      return { ok: false, message: `Checkout thất bại: ${selectedUnavailable.reason}.`, paymentCode: undefined };
    }
    const groups = selectedCheckoutGroups(rows);
    if (!groups.length) return { ok: false, message: "Chưa có sản phẩm hợp lệ được chọn.", paymentCode: undefined };

    try {
      const cartItemIds = groups.flatMap(g => g.rows.map(r => Number(r.item.id)));
      const backendOrders = await orderApi.checkoutCart({
        cart_item_ids: cartItemIds,
        address_id: Number(addressId),
        customer_note: note || undefined
      }) as unknown as BackendOrderResponse[];

      const orderCodes = backendOrders.map(o => o.order_code);
      const rawPaymentRes = await paymentApi.createPayment({
        order_codes: orderCodes,
        payment_method: method
      }) as any;
      const paymentRes = {
        id: rawPaymentRes.public_id || "mock-id",
        paymentCode: rawPaymentRes.payment_code,
        userId: get().getCurrentUser()!.id,
        paymentMethod: rawPaymentRes.payment_method,
        paymentStatus: rawPaymentRes.payment_status,
        amount: parseFloat(rawPaymentRes.amount),
        transactionCode: rawPaymentRes.transaction_code,
        paymentGateway: rawPaymentRes.payment_gateway,
        orderCodes: rawPaymentRes.order_codes || orderCodes,
        expiresAt: rawPaymentRes.expires_at,
        createdAt: rawPaymentRes.created_at,
        paidAt: rawPaymentRes.paid_at,
        failedAt: rawPaymentRes.failed_at,
        cancelledAt: rawPaymentRes.cancelled_at
      } as Payment;
      
      const paymentCode = paymentRes.paymentCode;

      setState((prev: AppState) => {
        const newOrders = backendOrders.map(bo => normalizeBackendOrder(bo, bo.seller?.public_id || "UNKNOWN_SELLER", get().getCurrentUser()!.id));
        
        let newPayment = paymentRes;
        
        const checkedVariantIds = new Set(groups.flatMap((group) => group.rows.map((row) => row.variant.id)));
        return {
          ...prev,
          orders: [...newOrders, ...prev.orders],
          payments: [newPayment, ...prev.payments],
          cartItems: prev.cartItems.filter((item) => !checkedVariantIds.has(item.variantId)),
          lastCheckoutPaymentCode: newPayment.paymentCode
        };
      });

      return { ok: true, message: "Đặt hàng thành công.", paymentCode };
    } catch (e: any) {
      return { ok: false, message: e.message || "Lỗi khi đặt hàng.", paymentCode: undefined };
    }
  },
    updatePaymentStatus: async (paymentCode: string, status: PaymentStatus) => {
    setState((prev: AppState) => {
      const payment = prev.payments.find((item) => item.paymentCode === paymentCode);
      const linkedCodes = new Set(payment?.orderCodes ?? []);
      const now = new Date().toISOString();
      return {
        ...prev,
        payments: prev.payments.map((item) =>
          item.paymentCode === paymentCode
            ? {
                ...item,
                paymentStatus: status,
                paidAt: status === "PAID" ? now : item.paidAt,
                failedAt: status === "FAILED" ? now : item.failedAt,
                cancelledAt: status === "CANCELLED" ? now : item.cancelledAt
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
  },
    retryPayment: async (paymentCode: string) => {
      const { state, verificationContext } = get();

    get().updatePaymentStatus(paymentCode, "PENDING");
  },
    cancelCustomerOrder: async (orderCode: string) => {
      const { state, verificationContext } = get();

    if (!get().getCurrentUser()) return { ok: false, message: "Người dùng chưa đăng nhập." };
    try {
      const response = await orderApi.cancelOrder(orderCode, { reason: "Khách hàng hủy đơn" }) as unknown as BackendOrderResponse;
      const order = normalizeBackendOrder(response, response.seller?.public_id || "UNKNOWN_SELLER", get().getCurrentUser()!.id);
      setState((prev: Types.AppState) => ({
        ...prev,
        orders: prev.orders.some((o) => o.id === order.id || o.orderCode === order.orderCode)
          ? prev.orders.map((o) => (o.id === order.id || o.orderCode === order.orderCode ? order : o))
          : [...prev.orders, order]
      }));
      return { ok: true, order };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi hủy đơn." };
    }
  },
    confirmCustomerReceipt: async (orderCode: string) => {
      const { state, verificationContext } = get();

    if (!get().getCurrentUser()) return { ok: false, message: "Người dùng chưa đăng nhập." };
    try {
      const response = await orderApi.confirmReceipt(orderCode) as unknown as BackendOrderResponse;
      const order = normalizeBackendOrder(response, response.seller?.public_id || "UNKNOWN_SELLER", get().getCurrentUser()!.id);
      setState((prev: Types.AppState) => ({
        ...prev,
        orders: prev.orders.some((o) => o.id === order.id || o.orderCode === order.orderCode)
          ? prev.orders.map((o) => (o.id === order.id || o.orderCode === order.orderCode ? order : o))
          : [...prev.orders, order]
      }));
      return { ok: true, order };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi xác nhận nhận hàng." };
    }
  },
    fetchCustomerOrderDetail: async (orderCode: string) => {
      const { state, verificationContext } = get();

    if (!get().getCurrentUser()) return { ok: false, message: "Người dùng chưa đăng nhập." };
    try {
      const response = await orderApi.getOrderDetail(orderCode) as unknown as BackendOrderResponse;
      const order = normalizeBackendOrder(response, response.seller?.public_id || "UNKNOWN_SELLER", get().getCurrentUser()!.id);
      setState((prev: Types.AppState) => ({
        ...prev,
        orders: prev.orders.some((o) => o.id === order.id || o.orderCode === order.orderCode)
          ? prev.orders.map((o) => (o.id === order.id || o.orderCode === order.orderCode ? order : o))
          : [...prev.orders, order]
      }));
      return { ok: true, order };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi tải chi tiết đơn hàng." };
    }
  },
    fetchSellerOrderDetail: async (orderId: string) => {
      const { state, verificationContext } = get();

    if (!get().getCurrentShop() || !get().getCurrentUser()) return { ok: false, message: "Shop không tồn tại." };
    try {
      const response = await apiFetch<BackendOrderResponse>(`${SELLER_ORDER_ROUTES.list}/${orderId}`);
      const order = normalizeBackendOrder(response, get().getCurrentShop()!.id, get().getCurrentUser()!.id);
      setState((prev: Types.AppState) => ({
        ...prev,
        orders: prev.orders.some((o) => o.id === order.id || o.orderCode === order.orderCode)
          ? prev.orders.map((o) => (o.id === order.id || o.orderCode === order.orderCode ? order : o))
          : [...prev.orders, order]
      }));
      return { ok: true, order };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi tải chi tiết đơn hàng." };
    }
  },
    fetchSellerOrders: async (status?: OrderStatus | "", force = false) => {
      const currentUser = get().getCurrentUser();
      const currentShop = get().getCurrentShop();
      if (!currentShop || !currentUser) return { ok: false, message: "Shop không tồn tại." };

      const queryKey = `${currentShop.id}:${status || ""}`;
      if (!force && fetchedSellerOrdersStatusRef.current === queryKey) {
        return { ok: true, orders: get().state.orders.filter((o) => o.sellerId === currentShop.id) };
      }
      fetchedSellerOrdersStatusRef.current = queryKey;
      try {
        const query = new URLSearchParams({ page: "1", limit: "100" });
        if (status) query.set("status", status);
        const response = await apiFetch<BackendOrderListResponse>(`${SELLER_ORDER_ROUTES.list}?${query.toString()}`);
        
        const orders = response.items.map((item) => normalizeBackendOrder(item, currentShop.id, currentUser.id));
        
        setState((prev: AppState) => {
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
    },
    fetchCustomerOrders: async (status?: OrderStatus | "", force = false) => {
      const currentUser = get().getCurrentUser();
      if (!currentUser) return { ok: false, message: "Người dùng chưa đăng nhập." };

      const queryKey = `${currentUser.id}:${status || ""}`;
      if (!force && fetchedCustomerOrdersStatusRef.current === queryKey) {
        return { ok: true, orders: get().state.orders.filter((o) => o.userId === currentUser.id) };
      }
      fetchedCustomerOrdersStatusRef.current = queryKey;
      try {
        const response = await orderApi.getMyOrders();
        let rawOrders = response.items as unknown as BackendOrderResponse[];
        if (status) {
          rawOrders = rawOrders.filter(o => o.order_status === status);
        }
        
        const orders = rawOrders.map((item) => normalizeBackendOrder(item, item.seller?.public_id || "UNKNOWN_SELLER", currentUser.id));
        
        setState((prev: AppState) => {
          const incomingIds = new Set(orders.map((o) => o.id));
          return {
            ...prev,
            orders: [
              ...orders,
              ...prev.orders.filter((o) => o.userId !== currentUser.id || !incomingIds.has(o.id))
            ]
          };
        });
        return { ok: true, orders };
      } catch (error) {
        return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi tải đơn hàng của khách hàng." };
      }
    },
    confirmSellerOrder: async (orderId: string) => {
      const { state, verificationContext } = get();

    if (!get().getCurrentShop() || !get().getCurrentUser()) return { ok: false, message: "Shop không tồn tại." };
    try {
      const response = await apiFetch<BackendOrderResponse>(SELLER_ORDER_ROUTES.confirm(orderId), {
        method: "PATCH"
      });
      const order = normalizeBackendOrder(response, get().getCurrentShop()!.id, get().getCurrentUser()!.id);
      setState((prev: Types.AppState) => ({
        ...prev,
        orders: prev.orders.some((o) => o.id === order.id || o.orderCode === order.orderCode)
          ? prev.orders.map((o) => (o.id === order.id || o.orderCode === order.orderCode ? order : o))
          : [...prev.orders, order]
      }));
      return { ok: true, order };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi xác nhận đơn hàng." };
    }
  },
    shippingSellerOrder: async (orderId: string) => {
      const { state, verificationContext } = get();

    if (!get().getCurrentShop() || !get().getCurrentUser()) return { ok: false, message: "Shop không tồn tại." };
    try {
      const response = await apiFetch<BackendOrderResponse>(SELLER_ORDER_ROUTES.shipping(orderId), {
        method: "PATCH"
      });
      const order = normalizeBackendOrder(response, get().getCurrentShop()!.id, get().getCurrentUser()!.id);
      setState((prev: Types.AppState) => ({
        ...prev,
        orders: prev.orders.some((o) => o.id === order.id || o.orderCode === order.orderCode)
          ? prev.orders.map((o) => (o.id === order.id || o.orderCode === order.orderCode ? order : o))
          : [...prev.orders, order]
      }));
      return { ok: true, order };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi chuyển trạng thái shipping." };
    }
  },
    cancelSellerOrder: async (orderId: string) => {
      const { state, verificationContext } = get();

    if (!get().getCurrentShop() || !get().getCurrentUser()) return { ok: false, message: "Shop không tồn tại." };
    try {
      const response = await apiFetch<BackendOrderResponse>(SELLER_ORDER_ROUTES.cancel(orderId), {
        method: "POST",
        body: JSON.stringify({ reason: "Shop hủy đơn" })
      });
      const order = normalizeBackendOrder(response, get().getCurrentShop()!.id, get().getCurrentUser()!.id);
      setState((prev: Types.AppState) => ({
        ...prev,
        orders: prev.orders.some((o) => o.id === order.id || o.orderCode === order.orderCode)
          ? prev.orders.map((o) => (o.id === order.id || o.orderCode === order.orderCode ? order : o))
          : [...prev.orders, order]
      }));
      return { ok: true, order };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi từ chối đơn hàng." };
    }
  },
  };
};
