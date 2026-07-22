import { 
  MarketplaceStore, 
  BackendUser, 
  BackendRegisterResponse, 
  RegistrationStatusResponse, 
  MessageResponse, 
  BackendStatusResponse, 
  VerificationContext,
  AUTH_ROUTES,
  PHONE_RE,
  EMAIL_RE,
  persistState,
  persistVerificationContext,
  authIdentifier,
  normalizeAuthEmail,
  normalizeAuthPhone,
  validateRegistrationPayload,
  validateNewPasswordPayload,
  usernameFromRegistration,
  backendRegisterToStatus,
  statusToVerificationContext,
  roleHomePath,
  hydrateSavedState,
  preferredRoleFor,
  normalizeBackendUser,
  applyBackendUser
} from './types';
import { StateCreator } from "zustand";
import type { User, AppState, SellerStatus, Role } from "@/types/models";
import { ApiError, apiFetch } from "@/services/api";
import { fetchMyCart } from "@/services/cart-api";

export const createAuthSlice: StateCreator<MarketplaceStore, [], [], any> = (set, get) => {
  const setState = (updater: ((state: AppState) => AppState) | Partial<AppState>) => {
    set((store) => {
      const nextState = typeof updater === 'function' ? updater(store.state) : { ...store.state, ...updater };
      persistState(nextState);
      return { state: nextState };
    });
  };
  const setVerificationContext = (ctx: VerificationContext | undefined) => set({ verificationContext: ctx });
  return {
    login: async (identifier: string, password: string) => {
      const { state, verificationContext } = get();

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
        setState((prev: AppState) => applyBackendUser(prev, backendUser, false));
        if (user.roles?.includes("SELLER")) {
          try {
            await get().getSellerApplication();
          } catch (e) {
            console.error("Failed to fetch seller application on login", e);
          }
        }
        try {
          const cartResp = await fetchMyCart();
          setState((prev: AppState) => ({
            ...prev,
            cartItems: cartResp.items.map(item => ({
              id: String(item.id),
              variantId: item.variantPublicId,
              quantity: item.quantity,
              isSelected: item.isSelected
            }))
          }));
        } catch (e) {
          console.error("Failed to fetch cart on login", e);
        }
        const preferredRole = preferredRoleFor(user);
        const message =
          "message" in loginResult && loginResult.message
            ? loginResult.message
            : `Đã đăng nhập bằng ${user.fullName}.`;
        return {
          ok: true,
          message,
          redirectTo: roleHomePath(preferredRole)
        };
      } catch (error) {
        if (error instanceof ApiError) {
          return { ok: false, message: error.message };
        }
        return {
          ok: false,
          message: "Không thể kết nối đến server. Vui lòng kiểm tra lại kết nối mạng."
        };
      }
    },
    register: async (payload: Pick<User, "fullName" | "email" | "phone"> & { password: string; confirmPassword: string }) => {
      const { state, verificationContext } = get();

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
            ? `Đăng ký thành công, nhưng chưa gửi được OTP: ${error.message}`
            : "Đăng ký thành công, nhưng chưa gửi được OTP. Hãy bấm Gửi lại mã.";
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
        message: "Không kết nối được backend đăng ký. Hãy chạy backend ở http://127.0.0.1:8000 rồi thử lại."
      };
    }
  },
    verifyEmail: async (token: string) => {
      const { state, verificationContext } = get();

    if (!token.trim()) return { ok: false, message: "Vui lòng nhập mã xác thực email." };

    try {
      const query = new URLSearchParams({ token: token.trim() });
      const result = await apiFetch<BackendStatusResponse>(`${AUTH_ROUTES.verifyEmail}?${query.toString()}`, {
        method: "POST"
      });
      const status: RegistrationStatusResponse = {
        message: result.message ?? "Xác thực email thành công.",
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
        setState((prev: AppState) => ({ ...prev, sessionUserId: undefined, activeRole: "GUEST" }));
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
      return { ok: false, message: "Không thể xác thực email lúc này." };
    }
  },
    verifyPhone: async (phone: string, otp: string) => {
      const { state, verificationContext } = get();

      const normalizedPhone = normalizeAuthPhone(phone);
      if (!PHONE_RE.test(normalizedPhone)) return { ok: false, message: "Số điện thoại không hợp lệ." };
      if (!/^\d{6}$/.test(otp.trim())) return { ok: false, message: "OTP phải gồm 6 chữ số." };

      try {
        const query = new URLSearchParams({ phone: normalizedPhone, otp: otp.trim() });
        const result = await apiFetch<BackendStatusResponse>(`${AUTH_ROUTES.verifyPhone}?${query.toString()}`, {
          method: "POST"
        });
        const status: RegistrationStatusResponse = {
          message: result.message ?? "Xác thực số điện thoại thành công.",
          registrationId: verificationContext?.registrationId,
          email: verificationContext?.email ?? get().getCurrentUser()?.email ?? "",
          phone: normalizedPhone,
          emailVerified: verificationContext?.emailVerified ?? get().getCurrentUser()?.emailVerified ?? false,
          phoneVerified: result.completed,
          completed: Boolean((verificationContext?.emailVerified ?? get().getCurrentUser()?.emailVerified) && result.completed)
        };
        if (status.completed) {
          persistVerificationContext(undefined);
          setVerificationContext(undefined);
          setState((prev: AppState) => ({ ...prev, sessionUserId: undefined, activeRole: "GUEST" }));
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
        return { ok: false, message: "Không thể xác thực số điện thoại lúc này." };
      }
    },
    resendEmailVerification: async () => {
      const { state, verificationContext } = get();

      try {
        const query = new URLSearchParams({
          email: verificationContext?.email ?? "",
          full_name: get().getCurrentUser()?.fullName ?? verificationContext?.email?.split("@")[0] ?? ""
        });
        const result = await apiFetch<MessageResponse>(`${AUTH_ROUTES.resendEmail}?${query.toString()}`, {
          method: "POST"
        });
        return { ok: true, message: result.message };
      } catch (error) {
        if (error instanceof ApiError) {
          return { ok: false, message: error.message };
        }
        return { ok: false, message: "Không thể gửi lại mã xác thực email lúc này." };
      }
    },
    resendPhoneVerification: async (phoneOverride?: string) => {
      const { state, verificationContext } = get();

      const normalizedPhone = normalizeAuthPhone(phoneOverride ?? verificationContext?.phone ?? get().getCurrentUser()?.phone ?? "");
      if (!PHONE_RE.test(normalizedPhone)) return { ok: false, message: "Số điện thoại không hợp lệ." };

      try {
        const query = new URLSearchParams({ phone: normalizedPhone });
        const result = await apiFetch<MessageResponse>(`${AUTH_ROUTES.resendPhone}?${query.toString()}`, {
          method: "POST"
        });
        const context: VerificationContext = {
          registrationId: verificationContext?.registrationId,
          email: verificationContext?.email ?? get().getCurrentUser()?.email ?? "",
          phone: normalizedPhone,
          emailVerified: verificationContext?.emailVerified ?? get().getCurrentUser()?.emailVerified ?? false,
          phoneVerified: false
        };
        persistVerificationContext(context);
        setVerificationContext(context);
        return { ok: true, message: result.message };
      } catch (error) {
        if (error instanceof ApiError) {
          return { ok: false, message: error.message };
        }
        return { ok: false, message: "Không thể gửi lại OTP lúc này." };
      }
    },
    requestPasswordReset: async (email: string) => {
      const { state, verificationContext } = get();

      const normalizedEmail = normalizeAuthEmail(email);
      if (!EMAIL_RE.test(normalizedEmail)) return { ok: false, message: "Email không hợp lệ." };

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
        return { ok: false, message: "Không thể gửi email đặt lại mật khẩu lúc này." };
      }
    },
    resetPassword: async (token: string, newPasswordValue: string, confirmPasswordValue: string) => {
      const { state, verificationContext } = get();

      const cleanToken = token.trim();
      if (!cleanToken) return { ok: false, message: "Vui lòng nhập token đặt lại mật khẩu." };

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
        return { ok: false, message: "Không thể đặt lại mật khẩu lúc này." };
      }
    },
    changePassword: async (currentPasswordValue: string, newPasswordValue: string, confirmPasswordValue: string) => {
      const { state, verificationContext } = get();

    const currentPassword = currentPasswordValue.trim();
    if (currentPassword.length < 8) return { ok: false, message: "Mật khẩu hiện tại phải có ít nhất 8 chữ số." };

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
      return { ok: false, message: "Không thể đổi mật khẩu lúc này." };
    }
  },
    updateProfile: async (updates: {
    fullName?: string;
    gender?: string;
    dateOfBirth?: string;
    avatarUrl?: string;
  }) => {
      const { state, verificationContext } = get();

    try {
      const result = await apiFetch<BackendUser>(AUTH_ROUTES.me, {
        method: "PUT",
        body: JSON.stringify({
          full_name: updates.fullName,
          gender: updates.gender,
          date_of_birth: updates.dateOfBirth || null,
          avatar_url: updates.avatarUrl || null,
        }),
      });
      setState((prev: AppState) => applyBackendUser(prev, result));
      return { ok: true, message: "Cập nhật hồ sơ thành công." };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, message: error.message };
      }
      return { ok: false, message: "Lỗi cập nhật hồ sơ." };
    }
  },
    logout: async () => {
      const { state, verificationContext } = get();

      try {
        await apiFetch<{ message: string }>(AUTH_ROUTES.logout, { method: "POST" });
      } catch {
        // Keep logout local even if the backend is offline.
      } finally {
        setState((prev: AppState) => ({ ...prev, sessionUserId: undefined, activeRole: "GUEST" }));
      }
    },
    logoutAll: async () => {
      const { state, verificationContext } = get();

      try {
        const result = await apiFetch<MessageResponse>(AUTH_ROUTES.logoutAll, { method: "POST" });
        setState((prev: AppState) => ({ ...prev, sessionUserId: undefined, activeRole: "GUEST" }));
        return { ok: true, message: result.message };
      } catch (error) {
        if (error instanceof ApiError) {
          return { ok: false, message: error.message };
        }
        return { ok: false, message: "Không thể đăng xuất tất cả thiết bị lúc này." };
      }
    },
    switchRole: async (role: Role | "GUEST") => {
      const { state, verificationContext } = get();

      const user = state.users.find((entry: any) => entry.id === state.sessionUserId);
      if (role !== "GUEST" && !user?.roles.includes(role as Role)) {
        return false;
      }

      const nextState = { ...state, activeRole: role };
      setState(nextState);
      return true;
    },
    toggleUserLock: async (userId: string) => {
      const { showToast } = get();
      try {
        const updatedUser = await apiFetch<any>(`/admin/users/${userId}/toggle-lock`, {
          method: "POST"
        });
        const normalized = {
          id: updatedUser.publicId ?? updatedUser.public_id ?? updatedUser.email,
          fullName: updatedUser.fullName ?? updatedUser.full_name ?? updatedUser.fullname ?? updatedUser.email,
          email: updatedUser.email,
          phone: updatedUser.phone,
          avatarUrl: updatedUser.avatarUrl ?? updatedUser.avatar_url ?? "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=240&q=80",
          gender: updatedUser.gender ?? undefined,
          birthday: updatedUser.dateOfBirth ?? updatedUser.date_of_birth ?? undefined,
          emailVerified: Boolean(updatedUser.emailVerifiedAt ?? updatedUser.email_verified_at),
          phoneVerified: Boolean(updatedUser.phoneVerifiedAt ?? updatedUser.phone_verified_at),
          status: updatedUser.status ?? "ACTIVE",
          lockedUntil: updatedUser.lockedUntil ?? updatedUser.locked_until ?? undefined,
          lockReason: updatedUser.lockReason ?? updatedUser.lock_reason ?? undefined,
          roles: updatedUser.roles ?? ["CUSTOMER"]
        };
        setState((prev: AppState) => ({
          ...prev,
          users: prev.users.map((u) => u.id === userId ? normalized : u)
        }));
        if (showToast) {
          showToast(
            normalized.status === "LOCKED" ? "Đã khóa tài khoản thành công." : "Đã mở khóa tài khoản thành công.",
            "success"
          );
        }
      } catch (error: any) {
        console.error("Failed to toggle lock:", error);
        if (showToast) {
          showToast(error.message ?? "Lỗi cập nhật trạng thái khóa.", "danger");
        }
      }
    },
    updateSellerStatus: async (shopId: string, status: SellerStatus, reason?: string) => {
      const { state, verificationContext } = get();

      setState((prev: AppState) => ({
        ...prev,
        shops: prev.shops.map((shop) =>
          shop.id === shopId
            ? {
                ...shop,
                status,
                rejectedReason: status === "REJECTED" ? reason ?? "Hồ sơ chưa đạt yêu cầu." : shop.rejectedReason,
                approvedAt: status === "APPROVED" ? new Date().toISOString() : shop.approvedAt,
                closedAt: status === "CLOSED" ? new Date().toISOString() : shop.closedAt
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
    },
  };
};
