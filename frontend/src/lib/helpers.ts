import type {
  Address,
  CartItem,
  Category,
  Order,
  OrderItem,
  OrderReturn,
  OrderReturnStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductVariant,
  Role,
  SellerStatus,
  Shop,
  User
} from "@/types/models";

export const formatVnd = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return "Liên hệ";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "Liên hệ";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(num);
};

/** Rút gọn số tiền VND cho nhãn trục biểu đồ: 85000000 → "85tr", 1200000000 → "1.2 tỷ". */
export const formatVndCompact = (value?: number | string | null) => {
  const num = value === null || value === undefined || value === "" ? NaN : Number(value);
  if (Number.isNaN(num)) return "0";
  const abs = Math.abs(num);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (abs >= 1_000_000_000) return `${trim(num / 1_000_000_000)} tỷ`;
  if (abs >= 1_000_000) return `${trim(num / 1_000_000)} tr`;
  if (abs >= 1_000) return `${Math.round(num / 1_000)}k`;
  return String(Math.round(num));
};

/** API datetimes are UTC but often serialized without a timezone suffix. */
export function parseApiDateTime(value?: string | Date): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  let s = value.trim();
  if (!s) return null;

  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
    const dateObj = new Date(s);
    return Number.isNaN(dateObj.getTime()) ? null : dateObj;
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s)) {
    s = s.replace(" ", "T") + "Z";
  }

  const dateObj = new Date(s);
  return Number.isNaN(dateObj.getTime()) ? null : dateObj;
}

export const formatDate = (value?: string | Date) => {
  const dateObj = parseApiDateTime(value);
  if (!dateObj) return "Chưa có";
  
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(dateObj).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);
  
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
};

export const currentPrice = (variant: ProductVariant) => variant.salePrice ?? variant.price;

export const getProductVariants = (product: Product, variants: ProductVariant[]) =>
  variants.filter((variant) => variant.productId === product.id);

export const getProductPriceRange = (product: Product, variants: ProductVariant[]) => {
  const prices = getProductVariants(product, variants).map(currentPrice);
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
};

export const getPrimaryVariant = (product: Product, variants: ProductVariant[]) =>
  getProductVariants(product, variants).find((variant) => variant.status === "ACTIVE") ??
  getProductVariants(product, variants)[0];

export const getShop = (shops: Shop[], sellerId: string) => shops.find((shop) => shop.id === sellerId);

export const getCategoryNames = (categories: Category[] = [], product: Product) => {
  if (product.categories && product.categories.length > 0) {
    return product.categories.map((c) => c.name).filter(Boolean).join(", ");
  }
  if (!product.categoryIds || product.categoryIds.length === 0) {
    return "";
  }
  return product.categoryIds
    .map((id) => categories.find((category) => String(category.id) === String(id))?.name)
    .filter(Boolean)
    .join(", ");
};

export const roleLabel: Record<Role | "GUEST", string> = {
  GUEST: "Khách",
  CUSTOMER: "Khách hàng",
  SELLER: "Người bán",
  ADMIN: "Admin",
  SUPPORTER: "Supporter"
};

export const sellerStatusLabel: Record<SellerStatus, string> = {
  PENDING: "Chưa hoạt động",
  APPROVED: "Đang hoạt động",
  REJECTED: "Từ chối",
  SUSPENDED: "Đã bị khóa",
  CLOSED: "Đã đóng cửa"
};


export const productStatusLabel: Record<Product["status"], string> = {
  ACTIVE: "Đang bán",
  HIDDEN: "Đang ẩn",
  OUT_OF_STOCK: "Hết hàng",
  DELETED: "Đã xóa"
};

export const orderStatusLabel: Record<Order["orderStatus"], string> = {
  PLACED: "Đã đặt hàng",
  READY_TO_SHIP: "Sẵn sàng giao",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao hàng",
  COMPLETED: "Hoàn thành",
  DELIVERY_FAILED: "Giao thất bại",
  RETURNED: "Đã trả hàng/hoàn tiền",
  CANCELLED: "Đã hủy"
};

export const returnStatusLabel: Record<OrderReturnStatus, string> = {
  REQUESTED: "Chờ Shop duyệt",
  SELLER_APPROVED: "Shop đồng ý trả hàng",
  RETURNING: "Đang trả hàng",
  COMPLETED: "Trả hàng thành công",
  SELLER_REJECTED: "Shop từ chối trả hàng",
  DISPUTED: "Đang khiếu nại lên Sàn",
  SUPPORT_APPROVED: "Sàn chấp thuận hoàn tiền",
  SUPPORT_REJECTED: "Sàn bác bỏ khiếu nại"
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FAILED: "Thanh toán lỗi",
  CANCELLED: "Đã hủy",
  REFUND_PENDING: "Chờ hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
  PARTIAL_REFUND_PENDING: "Chờ hoàn một phần",
  PARTIALLY_REFUNDED: "Đã hoàn một phần"
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  VNPAY: "VNPay",
  WALLET: "Ví tiền",
  COD: "Thanh toán khi nhận hàng (COD)"
};

export const resolveOrderPaymentMethod = (
  order: Order,
  payment?: Payment
): PaymentMethod | undefined => payment?.paymentMethod ?? order.preferredPaymentMethod;

export const orderPaymentMethodLabel = (order: Order, payment?: Payment) => {
  const method = resolveOrderPaymentMethod(order, payment);
  return method ? paymentMethodLabel[method] : "Chưa tạo giao dịch";
};

export type ProductQuery = {
  keyword?: string;
  categorySlug?: string;
  shopSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  sellerId?: string;
  sort?: "newest" | "price-asc" | "price-desc" | "sold" | "rating";
};

export const filterProducts = (
  products: Product[],
  variants: ProductVariant[],
  shops: Shop[],
  categories: Category[],
  query: ProductQuery
) => {
  const keyword = query.keyword?.trim().toLowerCase();
  const category = query.categorySlug ? categories.find((item) => item.slug === query.categorySlug) : undefined;
  const shop = query.shopSlug ? shops.find((item) => item.shopSlug === query.shopSlug) : undefined;

  const filtered = products.filter((product) => {
    const productShop = shops.find((item) => item.id === product.sellerId);
    const price = getProductPriceRange(product, variants).min;
    const inKeyword =
      !keyword ||
      product.name.toLowerCase().includes(keyword) ||
      product.shortDescription.toLowerCase().includes(keyword) ||
      productShop?.shopName.toLowerCase().includes(keyword) ||
      product.categoryIds.some((id) => categories.find((item) => item.id === id)?.name.toLowerCase().includes(keyword));

    return (
      inKeyword &&
      (!category || product.categoryIds.includes(category.id)) &&
      (!shop || product.sellerId === shop.id) &&
      (!query.sellerId || product.sellerId === query.sellerId) &&
      (!query.rating || product.averageRating >= query.rating || product.reviewCount === 0) &&
      (!query.minPrice || price >= query.minPrice) &&
      (!query.maxPrice || price <= query.maxPrice)
    );
  });

  return [...filtered].sort((a, b) => {
    if (query.sort === "price-asc") return getProductPriceRange(a, variants).min - getProductPriceRange(b, variants).min;
    if (query.sort === "price-desc") return getProductPriceRange(b, variants).min - getProductPriceRange(a, variants).min;
    if (query.sort === "sold") return b.soldCount - a.soldCount;
    if (query.sort === "rating") {
      if (a.reviewCount === 0 && b.reviewCount > 0) return 1;
      if (b.reviewCount === 0 && a.reviewCount > 0) return -1;
      return b.averageRating - a.averageRating;
    }
    return (parseApiDateTime(b.createdAt)?.getTime() || 0) - (parseApiDateTime(a.createdAt)?.getTime() || 0);
  });
};




export const getCartRows = (
  cartItems: CartItem[],
  products: Product[],
  variants: ProductVariant[],
  shops: Shop[]
) =>
  cartItems
    .map((item) => {
      const variant = variants.find((entry) => entry.id === item.variantId);
      const product = variant ? products.find((entry) => entry.id === variant.productId) : undefined;
      const shop = product ? shops.find((entry) => entry.id === product.sellerId) : undefined;
      if (!variant || !product || !shop) return undefined;
      const unavailable =
        product.status !== "ACTIVE" ||
        variant.status !== "ACTIVE" ||
        variant.inventory.quantity <= 0 ||
        shop.status !== "APPROVED";
      return {
        item,
        variant,
        product,
        shop,
        unitPrice: currentPrice(variant),
        subtotal: currentPrice(variant) * item.quantity,
        unavailable,
        reason:
          product.status === "DELETED"
            ? "Sản phẩm đã bị xóa"
            : product.status === "HIDDEN" || variant.status === "HIDDEN"
              ? "Sản phẩm/phân loại đang ẩn"
              : product.status === "OUT_OF_STOCK" || variant.status === "OUT_OF_STOCK" || variant.inventory.quantity <= 0
                ? "Hết hàng"
                : shop.status !== "APPROVED"
                  ? "Shop không còn hoạt động"
                  : ""
      };
    })
    .filter((row): row is CartRow => Boolean(row));

export type CartRow = {
  item: CartItem;
  variant: ProductVariant;
  product: Product;
  shop: Shop;
  unitPrice: number;
  subtotal: number;
  unavailable: boolean;
  reason: string;
};

export const groupCartByShop = (rows: CartRow[]) =>
  rows.reduce<Record<string, { shop: Shop; rows: CartRow[]; subtotal: number; shippingFee: number; total: number }>>(
    (acc, row) => {
      if (!acc[row.shop.id]) {
        acc[row.shop.id] = { shop: row.shop, rows: [], subtotal: 0, shippingFee: 0, total: 0 };
      }
      acc[row.shop.id].rows.push(row);
      if (row.item.isSelected && !row.unavailable) {
        acc[row.shop.id].subtotal += row.subtotal;
        acc[row.shop.id].total += row.subtotal;
      }
      return acc;
    },
    {}
  );

export const selectedCheckoutGroups = (rows: CartRow[]) =>
  Object.values(groupCartByShop(rows.filter((row) => row.item.isSelected && !row.unavailable))).map((group) => ({
    ...group,
    total: group.subtotal + group.shippingFee
  }));

export const makeOrderCode = (count: number) => `OD-260629-${String(count + 1).padStart(3, "0")}`;
export const makePaymentCode = (count: number) => `PAY-260629-${String(count + 1).padStart(3, "0")}`;

export const createOrderFromGroup = (
  code: string,
  user: User,
  group: ReturnType<typeof selectedCheckoutGroups>[number],
  address: Address,
  customerNote: string,
  existingCount: number
): Order => {
  const items: OrderItem[] = group.rows.map((row, index) => ({
    id: `oi-new-${existingCount}-${index}`,
    productId: row.product.id,
    variantId: row.variant.id,
    productNameSnapshot: row.product.name,
    variantNameSnapshot: row.variant.variantName,
    productImageSnapshot: row.product.thumbnailUrl,
    sellerNameSnapshot: row.shop.shopName,
    skuSnapshot: row.variant.sku,
    unitPrice: row.unitPrice,
    quantity: row.item.quantity,
    subtotal: row.subtotal
  }));

  return {
    id: `order-new-${existingCount}-${group.shop.id}`,
    orderCode: code,
    userId: user.id,
    sellerId: group.shop.id,
    orderStatus: "PLACED",
    paymentStatus: "PENDING",
    sellerConfirmed: false,
    subtotalAmount: group.subtotal,
    shippingFee: group.shippingFee,
    totalAmount: group.total,
    customerNote,
    paymentExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    sellerConfirmExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    items,
    shipment: {
      shippingProviderName: group.shop.shippingProviders?.[0]?.name || "Giao hàng nhanh",
      receiverName: address.receiverName,
      receiverPhone: address.phone,
      province: address.province,
      district: address.district,
      ward: address.ward,
      detailAddress: address.detailAddress,
      addressType: address.addressType
    },
    timeline: [
      {
        id: `${code}-log-1`,
        newStatus: "PLACED",
        note: "Đã đặt hàng từ checkout nhiều shop",
        createdAt: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString(),
    printCount: 0
  };
};

export const createPaymentFromOrders = (
  code: string,
  userId: string,
  method: PaymentMethod,
  orders: Order[],
  count: number
): Payment => ({
  id: `pay-new-${count}`,
  paymentCode: code,
  userId,
  paymentMethod: method,
  paymentGateway: method === "VNPAY" ? "VNPAY" : method === "WALLET" ? "WALLET" : method,
  paymentStatus: "PENDING",
  amount: orders.reduce((sum, order) => sum + order.totalAmount, 0),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  orderCodes: orders.map((order) => order.orderCode),
  createdAt: new Date().toISOString()
});

export const canContinuePayment = (order: Order) =>
  order.orderStatus !== "CANCELLED" &&
  (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED") &&
  order.preferredPaymentMethod !== "COD";

export const canCustomerCancel = (order: Order) => order.orderStatus === "PLACED" || order.orderStatus === "READY_TO_SHIP";

export const canSellerCancel = (order: Order) => order.orderStatus === "PLACED" && !order.sellerConfirmed;

export const canCustomerConfirmReceipt = (order: Order) => order.orderStatus === "DELIVERED";

export const canCustomerReturn = (order: Order) => order.orderStatus === "DELIVERED" && !order.returnRequest;

export const canCustomerDispute = (order: Order) => order.returnRequest?.returnStatus === "SELLER_REJECTED";

export const canSellerConfirm = (order: Order) => order.orderStatus === "PLACED" && !order.sellerConfirmed;

export const canSellerShip = (order: Order) => order.orderStatus === "READY_TO_SHIP";

export const canSellerDeliver = (order: Order) => order.orderStatus === "SHIPPING";

export const canSellerApproveReturn = (order: Order) => order.returnRequest?.returnStatus === "REQUESTED";

export const canSellerRejectReturn = (order: Order) => order.returnRequest?.returnStatus === "REQUESTED";

export const canSellerConfirmReturn = (order: Order) =>
  order.returnRequest?.returnStatus === "SELLER_APPROVED" || order.returnRequest?.returnStatus === "RETURNING";

export const statusTone = (status: string) => {
  if (["ACTIVE", "APPROVED", "PAID", "COMPLETED", "DELIVERED", "SUPPORT_APPROVED"].includes(status)) return "success";
  if (
    [
      "PENDING",
      "PLACED",
      "READY_TO_SHIP",
      "SHIPPING",
      "PARTIAL_REFUND_PENDING",
      "REFUND_PENDING",
      "REQUESTED",
      "SELLER_APPROVED",
      "RETURNING",
      "DISPUTED"
    ].includes(status)
  )
    return "warning";
  if (
    [
      "FAILED",
      "REJECTED",
      "SUSPENDED",
      "LOCKED",
      "OUT_OF_STOCK",
      "DELIVERY_FAILED",
      "CANCELLED",
      "SELLER_REJECTED",
      "SUPPORT_REJECTED"
    ].includes(status)
  )
    return "danger";
  if (["HIDDEN", "CLOSED", "DELETED", "REFUNDED", "PARTIALLY_REFUNDED", "RETURNED"].includes(status)) return "neutral";
  return "neutral";
};
