"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

const authPhonePattern = /^0(3|5|7|8|9)\d{8}$/;
const normalizeAuthPhoneInput = (value: string) => {
  const compact = value.trim().replace(/[\s.\-()]/g, "");
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`;
  if (compact.startsWith("84") && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
};

export default function VerificationPage({ type }: { type: "email" | "phone" }) {
  const store = useMarketplaceStore();
  const searchParams = useSearchParams();
  const token = searchParams ? searchParams.get("token") ?? "" : "";
  const { showToast } = store;

  const [code, setCode] = useState(type === "email" ? token : "");
  const [phone, setPhone] = useState(store.verificationContext?.phone ?? store.getCurrentUser()?.phone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    if (type === "phone" && !phone && store.verificationContext?.phone) {
      setPhone(store.verificationContext.phone);
    }
  }, [phone, type, store.verificationContext?.phone]);

  const submitVerification = async () => {
    setFieldError("");
    const normalizedPhone = normalizeAuthPhoneInput(phone || store.verificationContext?.phone || store.getCurrentUser()?.phone || "");
    if (type === "phone" && !authPhonePattern.test(normalizedPhone)) {
      setFieldError("Số điện thoại không hợp lệ.");
      return;
    }
    if (type === "phone" && !/^\d{6}$/.test(code.trim())) {
      setFieldError("OTP phải gồm 6 chữ số.");
      return;
    }
    if (type === "email" && !code.trim()) {
      setFieldError("Vui lòng nhập mã xác thực email.");
      return;
    }

    setSubmitting(true);
    try {
      const result =
        type === "email"
          ? await store.verifyEmail(code)
          : await store.verifyPhone(normalizedPhone, code);
      showToast(result.message, result.ok ? "success" : "danger");
      if (result.ok) {
        window.location.href = result.redirectTo ?? "/";
      } else {
        setSubmitting(false);
      }
    } catch {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    const result =
      type === "email"
        ? await store.resendEmailVerification()
        : await store.resendPhoneVerification(normalizeAuthPhoneInput(phone || store.verificationContext?.phone || store.getCurrentUser()?.phone || ""));
    showToast(result.message, result.ok ? "success" : "danger");
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Panel>
        <ShieldCheck className="h-10 w-10 text-primary" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-black text-ink">{type === "email" ? "Xác thực email" : "Xác thực số điện thoại"}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {type === "email" ? store.verificationContext?.email ?? store.getCurrentUser()?.email : store.verificationContext?.phone ?? store.getCurrentUser()?.phone}
        </p>
        <div className="mt-4 grid gap-3">
          {type === "phone" ? (
            <Field label="Số điện thoại">
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0901234567"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>
          ) : null}
          <Field label={type === "email" ? "Mã xác thực email" : "OTP điện thoại"}>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={type === "email" ? "Nhập mã xác thực" : "Nhập 6 chữ số"}
              inputMode={type === "phone" ? "numeric" : "text"}
              autoComplete="one-time-code"
              className={fieldError ? "border-coral" : undefined}
            />
          </Field>
          {fieldError ? <p className="text-xs font-semibold text-coral">{fieldError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={submitting} onClick={submitVerification}>
              {submitting ? "Đang xác thực" : "Xác thực"}
            </Button>
            <Button type="button" variant="secondary" onClick={resendVerification}>
              Gửi lại mã
            </Button>
          </div>
        </div>
      </Panel>
    </main>
  );
}
