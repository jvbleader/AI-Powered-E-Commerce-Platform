"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Mail, KeyRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

const authEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type PasswordFormErrors = Partial<Record<"email" | "token" | "currentPassword" | "newPassword" | "confirmPassword", string>>;

export default function PasswordPage({ mode }: { mode: "forgot" | "reset" }) {
  const store = useMarketplaceStore();
  const searchParams = useSearchParams();
  const tokenFromQuery = searchParams ? searchParams.get("token") ?? "" : "";
  const { showToast } = store;

  const [email, setEmail] = useState("");
  const [token, setToken] = useState(tokenFromQuery);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formErrors, setFormErrors] = useState<PasswordFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const validatePasswordForm = () => {
    const nextErrors: PasswordFormErrors = {};
    const normalizedEmail = email.trim().toLowerCase();

    if (mode === "forgot" && !authEmailPattern.test(normalizedEmail)) {
      nextErrors.email = "Email không hợp lệ.";
    }

    if (mode === "reset") {
      if (!token.trim()) {
        nextErrors.token = "Vui lòng nhập token reset.";
      }
      if (newPassword.trim().length < 8) {
        nextErrors.newPassword = "Mật khẩu mới phải có ít nhất 8 ký tự.";
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        nextErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
      }
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitPasswordForm = async () => {
    if (!validatePasswordForm()) return;

    try {
      const result =
        mode === "forgot"
          ? await store.requestPasswordReset(email)
          : await store.resetPassword(token, newPassword, confirmPassword);
      showToast(result.message, result.ok ? "success" : "danger");

      const redirectTo = result.ok && "redirectTo" in result && typeof result.redirectTo === "string"
        ? result.redirectTo
        : "";
      if (redirectTo) {
        window.location.href = redirectTo;
      } else {
        setSubmitting(false);
      }
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center p-4 sm:p-6 lg:p-8 bg-canvas">
      <div className="bento-card relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-2xl">
        <div className="flex flex-col justify-center p-6 sm:p-10 bg-white/90">
          
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h1 className="font-heading text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {mode === "forgot" ? "Quên mật khẩu" : "Đặt lại mật khẩu"}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {mode === "forgot" 
                ? "Nhập email của bạn để nhận liên kết khôi phục mật khẩu" 
                : "Nhập token và mật khẩu mới của bạn để hoàn tất đặt lại"}
            </p>
          </div>

          <div className="space-y-4">
            {mode === "forgot" ? (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Địa chỉ Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className={`w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                      formErrors.email
                        ? "border-rose-500 focus:border-rose-500"
                        : "border-slate-200 focus:border-emerald-600"
                    }`}
                  />
                </div>
                {formErrors.email && <p className="mt-1 text-xs font-semibold text-rose-500">{formErrors.email}</p>}
              </div>
            ) : (
              <>
                {!tokenFromQuery && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">Token reset</label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={token}
                        onChange={(event) => setToken(event.target.value)}
                        placeholder="Mã token đặt lại mật khẩu"
                        autoComplete="one-time-code"
                        className={`w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                          formErrors.token
                            ? "border-rose-500 focus:border-rose-500"
                            : "border-slate-200 focus:border-emerald-600"
                        }`}
                      />
                    </div>
                    {formErrors.token && <p className="mt-1 text-xs font-semibold text-rose-500">{formErrors.token}</p>}
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Tối thiểu 8 ký tự"
                      autoComplete="new-password"
                      className={`w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                        formErrors.newPassword
                          ? "border-rose-500 focus:border-rose-500"
                          : "border-slate-200 focus:border-emerald-600"
                      }`}
                    />
                  </div>
                  {formErrors.newPassword && <p className="mt-1 text-xs font-semibold text-rose-500">{formErrors.newPassword}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Nhập lại mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Tối thiểu 8 ký tự"
                      autoComplete="new-password"
                      className={`w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                        formErrors.confirmPassword
                          ? "border-rose-500 focus:border-rose-500"
                          : "border-slate-200 focus:border-emerald-600"
                      }`}
                    />
                  </div>
                  {formErrors.confirmPassword && <p className="mt-1 text-xs font-semibold text-rose-500">{formErrors.confirmPassword}</p>}
                </div>
              </>
            )}

            <Button
              disabled={submitting}
              onClick={submitPasswordForm}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:opacity-70"
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Đang xử lý...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>{mode === "forgot" ? "Gửi link reset" : "Đổi mật khẩu"}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>

            <div className="mt-6 text-center">
              {mode === "reset" ? (
                <a href="/forgot-password" className="text-sm font-bold text-emerald-700 hover:underline">Gửi lại link reset</a>
              ) : (
                <a href="/login" className="text-sm font-bold text-emerald-700 hover:underline">Quay lại đăng nhập</a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
