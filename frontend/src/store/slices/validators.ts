import type { User } from "@/types/models";
import type { BackendRegisterResponse, RegistrationStatusResponse, VerificationContext, SellerApplicationPayload } from "./types";
import { EMAIL_RE, PHONE_RE } from "./constants";

export const slugifyShopName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const normalizeAuthEmail = (email: string) => email.trim().toLowerCase();

export const normalizeAuthPhone = (phone: string) => {
  const compact = phone.trim().replace(/[\s.\-()]/g, "");
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`;
  if (compact.startsWith("84") && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
};

export const authIdentifier = (identifier: string) => {
  const value = identifier.trim();
  if (value.includes("@")) return normalizeAuthEmail(value);
  const phone = normalizeAuthPhone(value);
  return PHONE_RE.test(phone) ? phone : value;
};

export const validateRegistrationPayload = (
  payload: Pick<User, "fullName" | "email" | "phone"> & { userName: string; password: string; confirmPassword: string }
) => {
  const fullName = payload.fullName.trim();
  const userName = payload.userName.trim();
  const email = normalizeAuthEmail(payload.email);
  const phone = normalizeAuthPhone(payload.phone);
  const password = payload.password.trim();
  const confirmPassword = payload.confirmPassword.trim();

  if (fullName.length < 2) return { ok: false as const, message: "Họ tên phải có ít nhất 2 ký tự." };
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(userName)) return { ok: false as const, message: "Tên đăng nhập phải có 3-30 ký tự, chỉ gồm chữ, số, dấu gạch dưới." };
  if (!EMAIL_RE.test(email)) return { ok: false as const, message: "Email không hợp lệ." };
  if (!PHONE_RE.test(phone)) return { ok: false as const, message: "Số điện thoại không hợp lệ." };
  if (password.length < 8) return { ok: false as const, message: "Mật khẩu phải có ít nhất 8 ký tự." };
  if (password !== confirmPassword) return { ok: false as const, message: "Mật khẩu xác nhận không khớp." };
  return { ok: true as const, fullName, userName, email, phone, password, confirmPassword };
};

export const validateNewPasswordPayload = (newPasswordValue: string, confirmPasswordValue: string) => {
  const newPassword = newPasswordValue.trim();
  const confirmPassword = confirmPasswordValue.trim();

  if (newPassword.length < 8) return { ok: false as const, message: "Mật khẩu mới phải có ít nhất 8 ký tự." };
  if (newPassword !== confirmPassword) return { ok: false as const, message: "Mật khẩu xác nhận không khớp." };
  return { ok: true as const, newPassword, confirmPassword };
};

export const validateSellerApplicationPayload = (payload: SellerApplicationPayload) => {
  const shopName = payload.shopName.trim();
  const phone = normalizeAuthPhone(payload.phone);
  const email = normalizeAuthEmail(payload.email);
  const pickupAddress = payload.pickupAddress.trim();
  const taxCode = payload.taxCode.trim();
  const bankName = payload.bankName.trim();
  const bankAccountNumber = payload.bankAccountNumber.trim();
  const bankAccountName = payload.bankAccountName.trim();

  if (shopName.length < 4 || shopName.length > 100) return { ok: false as const, message: "Tên shop phải có 4-100 ký tự." };
  if (!PHONE_RE.test(phone)) return { ok: false as const, message: "Số điện thoại shop không hợp lệ." };
  if (!EMAIL_RE.test(email)) return { ok: false as const, message: "Email shop không hợp lệ." };
  if (pickupAddress.length < 10 || pickupAddress.length > 200) return { ok: false as const, message: "Địa chỉ lấy hàng phải có 10-200 ký tự." };
  if (taxCode.length < 10 || taxCode.length > 14) return { ok: false as const, message: "Mã số thuế phải có 10-14 ký tự." };
  if (bankName.length < 2 || bankName.length > 150) return { ok: false as const, message: "Tên ngân hàng phải có 2-150 ký tự." };
  if (bankAccountNumber.length < 3 || bankAccountNumber.length > 30) return { ok: false as const, message: "Số tài khoản phải có 3-30 ký tự." };
  if (bankAccountName.length < 8 || bankAccountName.length > 100) return { ok: false as const, message: "Tên chủ tài khoản phải có 8-100 ký tự." };

  return {
    ok: true as const,
    shopName,
    phone,
    email,
    pickupAddress,
    taxCode,
    bankName,
    bankAccountNumber,
    bankAccountName
  };
};

export const usernameFromRegistration = (email: string, phone: string) => {
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";
  const cleaned = localPart.replace(/[^a-z0-9_]/g, "").slice(0, 32);
  if (cleaned.length >= 2) return cleaned;
  return `user${phone.slice(-6)}`.slice(0, 40);
};

export const backendRegisterToStatus = (result: BackendRegisterResponse): RegistrationStatusResponse => ({
  message: "Đăng ký thành công. Vui lòng xác thực email.",
  registrationId: result.user_name,
  email: result.email,
  phone: result.phone,
  emailVerified: false,
  phoneVerified: true,
  completed: false
});

export const statusToVerificationContext = (status: RegistrationStatusResponse): VerificationContext => ({
  registrationId: status.registrationId,
  email: status.email,
  phone: status.phone,
  emailVerified: status.emailVerified,
  phoneVerified: status.phoneVerified
});
