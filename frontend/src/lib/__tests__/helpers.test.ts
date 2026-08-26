import test from "node:test";
import assert from "node:assert/strict";
import {
  orderStatusLabel,
  paymentMethodLabel,
  returnStatusLabel,
  canCustomerConfirmReceipt,
  canCustomerReturn,
  canCustomerDispute,
  canSellerDeliver,
  canSellerApproveReturn,
  canSellerRejectReturn,
  canSellerConfirmReturn,
  statusTone,
} from "../helpers";
import {
  normalizeBackendOrder,
  normalizeBackendOrderReturn,
} from "../../store/slices/normalizers";
import type { Order, OrderReturn, OrderStatus, PaymentMethod, OrderReturnStatus } from "../../types/models";

const mockBaseOrder: Order = {
  id: "ord-1",
  orderCode: "OD-123456",
  userId: "user-1",
  sellerId: "shop-1",
  orderStatus: "PLACED",
  paymentStatus: "PENDING",
  sellerConfirmed: false,
  subtotalAmount: 100000,
  shippingFee: 20000,
  totalAmount: 120000,
  paymentExpiresAt: "2026-08-21T00:00:00Z",
  sellerConfirmExpiresAt: "2026-08-22T00:00:00Z",
  items: [],
  shipment: {
    receiverName: "Nguyen Van A",
    receiverPhone: "0901234567",
    province: "Ha Noi",
    district: "Cau Giay",
    ward: "Dich Vong",
    detailAddress: "123 Duy Tan",
    addressType: "HOME",
  },
  timeline: [],
  createdAt: "2026-08-20T10:00:00Z",
  printCount: 0,
};

test("orderStatusLabel maps DELIVERED and RETURNED correctly", () => {
  assert.equal(orderStatusLabel.DELIVERED, "Đã giao hàng");
  assert.equal(orderStatusLabel.RETURNED, "Đã trả hàng/hoàn tiền");
  assert.equal(orderStatusLabel.SHIPPING, "Đang giao");
  assert.equal(orderStatusLabel.COMPLETED, "Hoàn thành");
});

test("paymentMethodLabel maps COD correctly", () => {
  assert.equal(paymentMethodLabel.COD, "Thanh toán khi nhận hàng (COD)");
  assert.equal(paymentMethodLabel.VNPAY, "VNPay");
  assert.equal(paymentMethodLabel.WALLET, "Ví tiền");
});

test("returnStatusLabel maps all OrderReturnStatus values", () => {
  const expectedStatuses: Record<OrderReturnStatus, string> = {
    REQUESTED: "Chờ Shop duyệt",
    SELLER_APPROVED: "Shop đồng ý trả hàng",
    RETURNING: "Đang trả hàng",
    COMPLETED: "Trả hàng thành công",
    SELLER_REJECTED: "Shop từ chối trả hàng",
    DISPUTED: "Đang khiếu nại lên Sàn",
    SUPPORT_APPROVED: "Sàn chấp thuận hoàn tiền",
    SUPPORT_REJECTED: "Sàn bác bỏ khiếu nại",
  };

  for (const [status, label] of Object.entries(expectedStatuses)) {
    assert.equal(returnStatusLabel[status as OrderReturnStatus], label);
  }
});

test("canCustomerConfirmReceipt requires orderStatus === DELIVERED", () => {
  const deliveredOrder: Order = { ...mockBaseOrder, orderStatus: "DELIVERED" };
  const shippingOrder: Order = { ...mockBaseOrder, orderStatus: "SHIPPING" };
  const placedOrder: Order = { ...mockBaseOrder, orderStatus: "PLACED" };
  const completedOrder: Order = { ...mockBaseOrder, orderStatus: "COMPLETED" };

  assert.equal(canCustomerConfirmReceipt(deliveredOrder), true);
  assert.equal(canCustomerConfirmReceipt(shippingOrder), false);
  assert.equal(canCustomerConfirmReceipt(placedOrder), false);
  assert.equal(canCustomerConfirmReceipt(completedOrder), false);
});

test("canCustomerReturn requires DELIVERED status and no active returnRequest", () => {
  const deliveredOrder: Order = { ...mockBaseOrder, orderStatus: "DELIVERED" };
  const deliveredWithReturn: Order = {
    ...mockBaseOrder,
    orderStatus: "DELIVERED",
    returnRequest: {
      id: "ret-1",
      returnCode: "RET-123",
      orderId: "ord-1",
      userId: "user-1",
      sellerId: "shop-1",
      returnStatus: "REQUESTED",
      reason: "Damaged",
      description: "Broken item",
      createdAt: "2026-08-20T10:00:00Z",
    },
  };
  const shippingOrder: Order = { ...mockBaseOrder, orderStatus: "SHIPPING" };

  assert.equal(canCustomerReturn(deliveredOrder), true);
  assert.equal(canCustomerReturn(deliveredWithReturn), false);
  assert.equal(canCustomerReturn(shippingOrder), false);
});

test("canCustomerDispute requires returnRequest with SELLER_REJECTED status", () => {
  const orderWithRejectedReturn: Order = {
    ...mockBaseOrder,
    orderStatus: "DELIVERED",
    returnRequest: {
      id: "ret-1",
      returnCode: "RET-123",
      orderId: "ord-1",
      userId: "user-1",
      sellerId: "shop-1",
      returnStatus: "SELLER_REJECTED",
      reason: "Damaged",
      description: "Broken item",
      createdAt: "2026-08-20T10:00:00Z",
    },
  };

  const orderWithPendingReturn: Order = {
    ...mockBaseOrder,
    orderStatus: "DELIVERED",
    returnRequest: {
      id: "ret-1",
      returnCode: "RET-123",
      orderId: "ord-1",
      userId: "user-1",
      sellerId: "shop-1",
      returnStatus: "REQUESTED",
      reason: "Damaged",
      description: "Broken item",
      createdAt: "2026-08-20T10:00:00Z",
    },
  };

  assert.equal(canCustomerDispute(orderWithRejectedReturn), true);
  assert.equal(canCustomerDispute(orderWithPendingReturn), false);
  assert.equal(canCustomerDispute(mockBaseOrder), false);
});

test("canSellerDeliver requires orderStatus === SHIPPING", () => {
  const shippingOrder: Order = { ...mockBaseOrder, orderStatus: "SHIPPING" };
  const readyOrder: Order = { ...mockBaseOrder, orderStatus: "READY_TO_SHIP" };
  const deliveredOrder: Order = { ...mockBaseOrder, orderStatus: "DELIVERED" };

  assert.equal(canSellerDeliver(shippingOrder), true);
  assert.equal(canSellerDeliver(readyOrder), false);
  assert.equal(canSellerDeliver(deliveredOrder), false);
});

test("canSellerApproveReturn and canSellerRejectReturn require returnStatus === REQUESTED", () => {
  const requestedReturnOrder: Order = {
    ...mockBaseOrder,
    returnRequest: {
      id: "ret-1",
      returnCode: "RET-123",
      orderId: "ord-1",
      userId: "user-1",
      sellerId: "shop-1",
      returnStatus: "REQUESTED",
      reason: "Defective",
      description: "Not working",
      createdAt: "2026-08-20T10:00:00Z",
    },
  };

  const approvedReturnOrder: Order = {
    ...mockBaseOrder,
    returnRequest: {
      id: "ret-1",
      returnCode: "RET-123",
      orderId: "ord-1",
      userId: "user-1",
      sellerId: "shop-1",
      returnStatus: "SELLER_APPROVED",
      reason: "Defective",
      description: "Not working",
      createdAt: "2026-08-20T10:00:00Z",
    },
  };

  assert.equal(canSellerApproveReturn(requestedReturnOrder), true);
  assert.equal(canSellerRejectReturn(requestedReturnOrder), true);
  assert.equal(canSellerApproveReturn(approvedReturnOrder), false);
  assert.equal(canSellerRejectReturn(approvedReturnOrder), false);
  assert.equal(canSellerApproveReturn(mockBaseOrder), false);
});

test("canSellerConfirmReturn requires SELLER_APPROVED or RETURNING", () => {
  const makeOrderWithReturnStatus = (status: OrderReturnStatus): Order => ({
    ...mockBaseOrder,
    returnRequest: {
      id: "ret-1",
      returnCode: "RET-123",
      orderId: "ord-1",
      userId: "user-1",
      sellerId: "shop-1",
      returnStatus: status,
      reason: "Defective",
      description: "Not working",
      createdAt: "2026-08-20T10:00:00Z",
    },
  });

  assert.equal(canSellerConfirmReturn(makeOrderWithReturnStatus("SELLER_APPROVED")), true);
  assert.equal(canSellerConfirmReturn(makeOrderWithReturnStatus("RETURNING")), true);
  assert.equal(canSellerConfirmReturn(makeOrderWithReturnStatus("REQUESTED")), false);
  assert.equal(canSellerConfirmReturn(makeOrderWithReturnStatus("COMPLETED")), false);
  assert.equal(canSellerConfirmReturn(makeOrderWithReturnStatus("SELLER_REJECTED")), false);
});

test("statusTone returns correct tone for new statuses", () => {
  assert.equal(statusTone("DELIVERED"), "success");
  assert.equal(statusTone("SUPPORT_APPROVED"), "success");
  assert.equal(statusTone("RETURNED"), "neutral");
  assert.equal(statusTone("REQUESTED"), "warning");
  assert.equal(statusTone("SELLER_APPROVED"), "warning");
  assert.equal(statusTone("RETURNING"), "warning");
  assert.equal(statusTone("DISPUTED"), "warning");
  assert.equal(statusTone("SELLER_REJECTED"), "danger");
  assert.equal(statusTone("SUPPORT_REJECTED"), "danger");
});

test("normalizers correctly handle delivered_at, auto_complete_at, return_tag, return_request", () => {
  const backendData: any = {
    public_id: "ord-pub-1",
    order_code: "OD-999888",
    order_status: "DELIVERED",
    payment_status: "PAID",
    seller_confirmed: true,
    subtotal_amount: "500000",
    shipping_fee: "30000",
    total_amount: "530000",
    preferred_payment_method: "COD",
    payment_expires_at: "2026-08-21T00:00:00Z",
    seller_confirm_expires_at: "2026-08-22T00:00:00Z",
    delivered_at: "2026-08-20T12:00:00Z",
    auto_complete_at: "2026-08-27T12:00:00Z",
    return_tag: "DISPUTED",
    return_request: {
      id: 10,
      public_id: "ret-pub-10",
      return_code: "RET-20260820-001",
      order_id: 1,
      user_id: 2,
      seller_id: 3,
      return_status: "DISPUTED",
      reason: "Hàng lỗi",
      description: "Không hoạt động được",
      evidence_images: ["https://example.com/img1.jpg"],
      seller_reject_reason: "Hàng vẫn dùng được",
      dispute_reason: "Tôi đã kiểm tra kỹ và gửi video bằng chứng",
      created_at: "2026-08-20T13:00:00Z",
    },
    created_at: "2026-08-20T08:00:00Z",
  };

  const normalized = normalizeBackendOrder(backendData, "seller-pub-3", "user-pub-2");

  assert.equal(normalized.orderStatus, "DELIVERED");
  assert.equal(normalized.preferredPaymentMethod, "COD");
  assert.equal(normalized.deliveredAt, "2026-08-20T12:00:00Z");
  assert.equal(normalized.autoCompleteAt, "2026-08-27T12:00:00Z");
  assert.equal(normalized.returnTag, "DISPUTED");
  assert.ok(normalized.returnRequest);
  assert.equal(normalized.returnRequest?.returnCode, "RET-20260820-001");
  assert.equal(normalized.returnRequest?.returnStatus, "DISPUTED");
  assert.equal(normalized.returnRequest?.evidenceImages?.length, 1);
  assert.equal(normalized.returnRequest?.sellerRejectReason, "Hàng vẫn dùng được");
  assert.equal(normalized.returnRequest?.disputeReason, "Tôi đã kiểm tra kỹ và gửi video bằng chứng");
});
