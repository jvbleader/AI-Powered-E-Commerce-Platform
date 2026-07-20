"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { BRAND_NAME } from "@/lib/constants";

const authEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const authPhonePattern = /^0(3|5|7|8|9)\d{8}$/;
const normalizeAuthPhoneInput = (value: string) => {
  const compact = value.trim().replace(/[\s.\-()]/g, "");
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`;
  if (compact.startsWith("84") && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
};

type AuthFormErrors = Partial<Record<"fullName" | "email" | "phone" | "password" | "confirmPassword", string>>;

export default function AuthPage({ mode: initialMode }: { mode: "login" | "register" }) {
  const store = useMarketplaceStore();
  const router = useRouter();
  const { showToast } = store;

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<AuthFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // 1-Click Quick Demo Account Switcher
  const fillDemoAccount = (role: "buyer" | "seller" | "admin") => {
    setMode("login");
    setFormErrors({});
    if (role === "buyer") {
      setEmail("buyer@shepoo.com");
      setPassword("12345678");
      showToast("Đã điền tự động tài khoản Khách hàng Demo!", "info");
    } else if (role === "seller") {
      setEmail("seller@shepoo.com");
      setPassword("12345678");
      showToast("Đã điền tự động tài khoản Người bán Demo!", "info");
    } else if (role === "admin") {
      setEmail("admin@shepoo.com");
      setPassword("12345678");
      showToast("Đã điền tự động tài khoản Admin Demo!", "info");
    }
  };

  // Real-time password strength calculation
  const getPasswordStrength = () => {
    if (!password) return { label: "", score: 0, color: "bg-slate-200" };
    if (password.length < 6) return { label: "Yếu", score: 33, color: "bg-rose-500" };
    if (password.length < 10) return { label: "Trung bình", score: 66, color: "bg-amber-500" };
    return { label: "Mạnh", score: 100, color: "bg-emerald-600" };
  };

  const passwordStrength = getPasswordStrength();

  const validateAuthForm = () => {
    const nextErrors: AuthFormErrors = {};
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizeAuthPhoneInput(phone);
    const normalizedLoginPhone = normalizeAuthPhoneInput(email);
    const isLoginIdentifierValid =
      authEmailPattern.test(normalizedEmail) || authPhonePattern.test(normalizedLoginPhone);

    if (mode === "register" && fullName.trim().length < 2) {
      nextErrors.fullName = "Họ tên phải có ít nhất 2 ký tự.";
    }
    if (mode === "login" ? !isLoginIdentifierValid : !authEmailPattern.test(normalizedEmail)) {
      nextErrors.email = mode === "login" ? "Nhập email hoặc số điện thoại hợp lệ." : "Email không hợp lệ.";
    }
    if (mode === "register" && !authPhonePattern.test(normalizedPhone)) {
      nextErrors.phone = "Số điện thoại không hợp lệ.";
    }
    if (password.length < (mode === "register" ? 8 : 1)) {
      nextErrors.password = mode === "register" ? "Mật khẩu phải có ít nhất 8 ký tự." : "Vui lòng nhập mật khẩu.";
    }
    if (mode === "register" && password !== confirmPassword) {
      nextErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAuthForm()) return;
    setSubmitting(true);
    const normalizedPhone = normalizeAuthPhoneInput(phone);
    const result =
      mode === "login"
        ? await store.login(email, password)
        : await store.register({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: normalizedPhone,
            password,
            confirmPassword
          });
    setSubmitting(false);
    showToast(result.message, result.ok ? "success" : "danger");
    if (result.ok) router.push(result.redirectTo || "/");
  };

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center p-4 sm:p-6 lg:p-8 bg-canvas">
      <div className="bento-card relative w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-2xl lg:grid lg:grid-cols-12">
        {/* LEFT BRAND PANEL (Deep Emerald Contrast) */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-10 text-white lg:col-span-5 lg:flex">
          {/* Ambient Glows */}
          <div className="pointer-events-none absolute -left-12 -top-12 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />

          {/* Top Logo & Tag */}
          <div className="relative z-10">
            <a href="/" className="inline-flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 font-heading text-xl font-black text-slate-950 shadow-lg shadow-emerald-500/30">
                S
              </span>
              <span className="font-heading text-2xl font-black tracking-tight text-white">{BRAND_NAME}</span>
            </a>

            <div className="mt-10 space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-300">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                Xác thực tài khoản Porcelain
              </span>

              <h2 className="font-heading text-3xl font-extrabold leading-tight text-white">
                Truy cập hệ sinh thái mua sắm <span className="text-gradient-neon">thông minh</span>
              </h2>

              <p className="text-xs leading-relaxed text-slate-300">
                Tận hưởng đặc quyền khách hàng VIP, quản lý đơn hàng theo thời gian thực và trải nghiệm mua sắm AI thế hệ mới.
              </p>
            </div>
          </div>

          {/* Middle Feature Highlights */}
          <div className="relative z-10 my-6 space-y-3 border-y border-white/10 py-5">
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-200">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <span>100% gian hàng được Verified bởi Shepoo</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-200">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <span>Mã hóa bảo mật thông tin tuyệt đối</span>
            </div>
          </div>

          {/* Bottom Trust Badge */}
          <div className="relative z-10 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="flex items-center gap-1 text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400" />
              ))}
              <span className="ml-2 font-heading text-xs font-bold text-white">4.9 / 5.0 Rating</span>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-300">
              "Đăng nhập 1-Click nhanh chóng, trải nghiệm mua sắm vô cùng tuyệt vời!"
            </p>
          </div>
        </div>

        {/* RIGHT AUTH FORM PANEL (Clean Porcelain Mode) */}
        <div className="flex flex-col justify-center p-6 sm:p-10 lg:col-span-7 bg-white/90">
          {/* 1-CLICK QUICK DEMO FILLER RIBBON */}
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
              <Zap className="h-4 w-4 fill-emerald-600 text-emerald-600 animate-pulse" />
              <span>Thử Nghiệm Nhanh - 1-Click Demo Login:</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount("buyer")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors shadow-sm"
              >
                👤 Khách Hàng Demo
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("seller")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-700 transition-colors shadow-sm"
              >
                🏪 Người Bán Demo
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("admin")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors shadow-sm"
              >
                ⚡ Admin Demo
              </button>
            </div>
          </div>

          {/* Header Switcher Tabs */}
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h1 className="font-heading text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {mode === "login" ? "Đăng Nhập" : "Tạo Tài Khoản"}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                {mode === "login" ? "Nhập thông tin tài khoản của bạn để tiếp tục" : "Điền thông tin đăng ký tài khoản Shepoo"}
              </p>
            </div>

            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setFormErrors({});
                }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                  mode === "login" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setFormErrors({});
                }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                  mode === "register" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Đăng ký
              </button>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* REGISTER FIELDS */}
            {mode === "register" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Họ và tên</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      autoComplete="name"
                      className={`w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                        formErrors.fullName
                          ? "border-rose-500 focus:border-rose-500"
                          : "border-slate-200 focus:border-emerald-600"
                      }`}
                    />
                  </div>
                  {formErrors.fullName && <p className="mt-1 text-xs font-semibold text-rose-500">{formErrors.fullName}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Số điện thoại</label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0901234567"
                      autoComplete="tel"
                      className={`w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                        formErrors.phone
                          ? "border-rose-500 focus:border-rose-500"
                          : "border-slate-200 focus:border-emerald-600"
                      }`}
                    />
                  </div>
                  {formErrors.phone && <p className="mt-1 text-xs font-semibold text-rose-500">{formErrors.phone}</p>}
                </div>
              </>
            )}

            {/* EMAIL FIELD */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                {mode === "login" ? "Email hoặc số điện thoại" : "Địa chỉ Email"}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={mode === "login" ? "text" : "email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === "login" ? "buyer@shepoo.com hoặc 0901234567" : "name@example.com"}
                  autoComplete={mode === "login" ? "username" : "email"}
                  className={`w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                    formErrors.email
                      ? "border-rose-500 focus:border-rose-500"
                      : "border-slate-200 focus:border-emerald-600"
                  }`}
                />
              </div>
              {formErrors.email && <p className="mt-1 text-xs font-semibold text-rose-500">{formErrors.email}</p>}
            </div>

            {/* PASSWORD FIELD */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Mật khẩu</label>
                {mode === "login" && (
                  <a href="/forgot-password" className="text-xs font-bold text-emerald-700 hover:underline">
                    Quên mật khẩu?
                  </a>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "login" ? "••••••••" : "Tối thiểu 8 ký tự"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className={`w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                    formErrors.password
                      ? "border-rose-500 focus:border-rose-500"
                      : "border-slate-200 focus:border-emerald-600"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Indicator for Register */}
              {mode === "register" && password && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Độ mạnh mật khẩu:</span>
                    <span className="text-emerald-700">{passwordStrength.label}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all ${passwordStrength.color}`}
                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>
                </div>
              )}

              {formErrors.password && <p className="mt-1 text-xs font-semibold text-rose-500">{formErrors.password}</p>}
            </div>

            {/* CONFIRM PASSWORD FOR REGISTER */}
            {mode === "register" && (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Xác nhận mật khẩu</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    autoComplete="new-password"
                    className={`w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                      formErrors.confirmPassword
                        ? "border-rose-500 focus:border-rose-500"
                        : "border-slate-200 focus:border-emerald-600"
                    }`}
                  />
                </div>
                {formErrors.confirmPassword && (
                  <p className="mt-1 text-xs font-semibold text-rose-500">{formErrors.confirmPassword}</p>
                )}
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <Button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:opacity-70"
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Xác thực hệ thống...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>{mode === "login" ? "Đăng Nhập Ngay" : "Tạo Tài Khoản Shepoo"}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}



