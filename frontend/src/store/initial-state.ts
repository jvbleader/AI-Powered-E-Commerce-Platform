import type {
  Address,
  AppState,
  Category,
  Conversation,
  Notification,
  Order,
  Payment,
  Product,
  ProductVariant,
  Shop,
  User
} from "@/types/models";

export const categories: Category[] = [];
export const users: User[] = [];
export const shops: Shop[] = [];
export const products: Product[] = [];
export const variants: ProductVariant[] = [];
export const addresses: Address[] = [];
export const orders: Order[] = [];
export const payments: Payment[] = [];
export const notifications: Notification[] = [];
export const conversations: Conversation[] = [];

export const initialState: AppState = {
  users,
  shops,
  categories,
  products,
  variants,
  cartItems: [],
  addresses,
  orders,
  payments,
  notifications,
  conversations,
  sessionUserId: undefined,
  activeRole: "GUEST",
  lastCheckoutPaymentCode: undefined
};

export const hotKeywords = ["tai nghe chống ồn", "sneaker trắng", "serum B5", "áo sơ mi linen", "đèn bàn LED"];
