import type { User, Shop, AppState, SellerApplication, SellerStatus, Role } from "@/types/models";
import type { BackendUser, BackendSellerApplication } from "./types";
import { initialState } from "@/store/initial-state";
import { cloneState, persistState } from "./constants";
import { normalizeBackendUser, sameUserSnapshot, sellerApplicationToShop, sameShopSnapshot } from "./normalizers";

export const mergeById = <T extends { id: string }>(seed: T[], saved?: T[]) => {
  const savedMap = new Map((saved ?? []).map((item) => [item.id, item]));
  const merged = seed.map((item) => savedMap.get(item.id) ?? item);
  const extraSaved = (saved ?? []).filter((item) => !seed.some((seedItem) => seedItem.id === item.id));
  return [...merged, ...extraSaved];
};

export const hydrateSavedState = (saved: AppState): AppState => {
  const seed = cloneState();
  return {
    ...seed,
    ...saved,
    users: mergeById(seed.users, saved.users),
    shops: mergeById(seed.shops, saved.shops),
    categories: mergeById(seed.categories, saved.categories),
    products: mergeById(seed.products, saved.products),
    variants: mergeById(seed.variants, saved.variants),
    addresses: [],
    orders: mergeById(seed.orders, saved.orders),
    payments: mergeById(seed.payments, saved.payments),
    notifications: mergeById(seed.notifications, saved.notifications),
    conversations: mergeById(seed.conversations, saved.conversations),
    cartItems: saved.cartItems ?? seed.cartItems,
    activeRole: saved.activeRole ?? seed.activeRole
  };
};

export const preferredRoleFor = (user: User) =>
  user.roles.includes("ADMIN")
    ? "ADMIN"
    : user.roles.includes("SUPPORTER")
      ? "SUPPORTER"
      : user.roles.includes("CUSTOMER")
        ? "CUSTOMER"
        : user.roles.includes("SELLER")
          ? "SELLER"
          : "CUSTOMER";

export const activeRoleForUser = (user: User, currentRole: Role | "GUEST") => {
  if (currentRole === "CUSTOMER") return "CUSTOMER";
  if (currentRole !== "GUEST" && user.roles.includes(currentRole)) return currentRole;
  return preferredRoleFor(user);
};

export const applyBackendUser = (
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

export const upsertBackendUser = (prev: AppState, backendUser: BackendUser): { state: AppState; user: User } => {
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

export const upsertSellerApplicationShop = (
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
