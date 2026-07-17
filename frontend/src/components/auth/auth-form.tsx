"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

const authEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const authPhonePattern = /^0(3|5|7|8|9)\d{8}$/;
const normalizeAuthPhoneInput = (value: string) => {
  const compact = value.trim().replace(/[\s.\-()]/g, "");
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`;
  if (compact.startsWith("84") && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
};

type AuthFormErrors = Partial<Record<"fullName" | "email" | "phone" | "password" | "confirmPassword", string>>;

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const store = useMarketplaceStore();
  const router = useRouter();
  const { showToast } = store;

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formErrors, setFormErrors] = useState<AuthFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-5 px-4 py-8 lg:grid-cols-[1fr_420px]">
      <div>
        <StatusBadge status="ACTIVE" label="Tài khoản Shepoo" />
        <h1 className="mt-4 text-4xl font-black text-ink">{mode === "login" ? "Đăng nhập Shepoo" : "Tạo tài khoản khách hàng"}</h1>
      </div>
      <Panel>
        <div className="grid gap-4">
          {mode === "register" ? (
            <>
              <Field label="Họ tên" hint={formErrors.fullName ? <span className="text-coral">{formErrors.fullName}</span> : null}>
                <Input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nguyễn Văn A"
                  autoComplete="name"
                  className={formErrors.fullName ? "border-coral" : undefined}
                />
              </Field>
              <Field label="Số điện thoại" hint={formErrors.phone ? <span className="text-coral">{formErrors.phone}</span> : null}>
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0901234567"
                  autoComplete="tel"
                  inputMode="tel"
                  className={formErrors.phone ? "border-coral" : undefined}
                />
              </Field>
            </>
          ) : null}
          <Field
            label={mode === "login" ? "Email hoặc số điện thoại" : "Email"}
            hint={formErrors.email ? <span className="text-coral">{formErrors.email}</span> : null}
          >
            <Input
              type={mode === "login" ? "text" : "email"}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={mode === "login" ? "email@example.com hoặc 0901234567" : "email@example.com"}
              autoComplete={mode === "login" ? "username" : "email"}
              inputMode={mode === "login" ? "text" : "email"}
              className={formErrors.email ? "border-coral" : undefined}
            />
          </Field>
          <Field label="Mật khẩu" hint={formErrors.password ? <span className="text-coral">{formErrors.password}</span> : null}>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "login" ? "Mật khẩu" : "Tối thiểu 8 ký tự"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={formErrors.password ? "border-coral" : undefined}
            />
          </Field>
          {mode === "register" ? (
            <Field label="Nhập lại mật khẩu" hint={formErrors.confirmPassword ? <span className="text-coral">{formErrors.confirmPassword}</span> : null}>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Nhập lại mật khẩu"
                autoComplete="new-password"
                className={formErrors.confirmPassword ? "border-coral" : undefined}
              />
            </Field>
          ) : null}
          <Button
            disabled={submitting}
            onClick={async () => {
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
              if (result.ok) router.push(result.redirectTo ?? "/");
            }}
          >
            {submitting ? "Đang xử lý" : mode === "login" ? "Đăng nhập" : "Đăng ký"}
          </Button>
          <div className="flex flex-wrap gap-2 text-sm text-muted">
            <a href="/forgot-password" className="font-semibold text-primary">Quên mật khẩu</a>
            <a href={mode === "login" ? "/register" : "/login"} className="font-semibold text-primary">
              {mode === "login" ? "Tạo tài khoản" : "Đã có tài khoản"}
            </a>
          </div>
        </div>
      </Panel>
    </main>
  );
}
