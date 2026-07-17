import type * as Models from "./models";

declare global {
  namespace Types {
    export type Address = Models.Address;
    export type AddressType = Models.AddressType;
    export type AppState = Models.AppState;
    export type OrderStatus = Models.OrderStatus;
    export type PaymentMethod = Models.PaymentMethod;
    export type PaymentStatus = Models.PaymentStatus;
    export type Product = Models.Product;
    export type Role = Models.Role;
    export type SellerApplication = Models.SellerApplication;
    export type SellerStatus = Models.SellerStatus;
    export type Shop = Models.Shop;
    export type User = Models.User;
    export type ProductVariant = Models.ProductVariant;
    export type Order = Models.Order;
    export type Payment = Models.Payment;
    export type Category = Models.Category;
    export type Conversation = Models.Conversation;
  }
}
