"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/containers";
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
    <main className="mx-auto max-w-xl px-4 py-10">
      <Panel>
        <Lock className="h-10 w-10 text-primary" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-black text-ink">{mode === "forgot" ? "Quên mật khẩu" : "Đặt lại mật khẩu"}</h1>
        <div className="mt-4 grid gap-3">
          {mode === "forgot" ? (
            <Field label="Email" hint={formErrors.email ? <span className="text-coral">{formErrors.email}</span> : null}>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@example.com"
                autoComplete="email"
                className={formErrors.email ? "border-coral" : undefined}
              />
            </Field>
          ) : (
            <>
              <Field label="Token reset" hint={formErrors.token ? <span className="text-coral">{formErrors.token}</span> : null}>
                <Input
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  autoComplete="one-time-code"
                  className={formErrors.token ? "border-coral" : undefined}
                />
              </Field>
              <Field label="Mật khẩu mới" hint={formErrors.newPassword ? <span className="text-coral">{formErrors.newPassword}</span> : null}>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  autoComplete="new-password"
                  className={formErrors.newPassword ? "border-coral" : undefined}
                />
              </Field>
              <Field label="Nhập lại mật khẩu" hint={formErrors.confirmPassword ? <span className="text-coral">{formErrors.confirmPassword}</span> : null}>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  autoComplete="new-password"
                  className={formErrors.confirmPassword ? "border-coral" : undefined}
                />
              </Field>
            </>
          )}
          <Button disabled={submitting} onClick={submitPasswordForm}>
            {submitting ? "Đang xử lý" : mode === "forgot" ? "Gửi link reset" : "Đổi mật khẩu"}
          </Button>
          {mode === "reset" ? (
            <a href="/forgot-password" className="text-sm font-semibold text-primary">Gửi lại link reset</a>
          ) : (
            <a href="/login" className="text-sm font-semibold text-primary">Quay lại đăng nhập</a>
          )}
        </div>
      </Panel>
    </main>
  );
}
