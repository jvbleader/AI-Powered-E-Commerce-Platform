"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2, Check } from "lucide-react";
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

  const [autoVerifying, setAutoVerifying] = useState(type === "email" && !!token);
  const [autoVerifySuccess, setAutoVerifySuccess] = useState(false);
  const autoVerifyRef = useRef(false);

  useEffect(() => {
    if (type === "phone" && !phone && store.verificationContext?.phone) {
      setPhone(store.verificationContext.phone);
    }
  }, [phone, type, store.verificationContext?.phone]);

  useEffect(() => {
    if (type === "email" && token && !autoVerifyRef.current) {
      autoVerifyRef.current = true;
      const doVerify = async () => {
        setAutoVerifying(true);
        try {
          const result = await store.verifyEmail(token);
          if (result.ok) {
            setAutoVerifySuccess(true);
            showToast("Xác thực email thành công!", "success");
          } else {
            setFieldError(result.message || "Xác thực thất bại");
          }
        } catch (error) {
          setFieldError("Có lỗi xảy ra khi xác thực");
        } finally {
          setAutoVerifying(false);
        }
      };
      doVerify();
    }
  }, [type, token, store, showToast]);

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
          {type === "email" ? (
            token ? (
              <>
                {autoVerifying ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-sm font-medium text-muted">Đang tự động xác thực email của bạn...</p>
                  </div>
                ) : autoVerifySuccess ? (
                  <div className="flex flex-col items-center justify-center text-center gap-4 py-4">
                    <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                      <Check className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-ink">Xác thực thành công!</h2>
                    <p className="text-sm text-muted">
                      Email của bạn đã được xác thực thành công. Bạn có thể tiếp tục đăng nhập để trải nghiệm Shepoo.
                    </p>
                    <Button onClick={() => window.location.href = '/login'} className="w-full mt-2">
                      Đến trang đăng nhập
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col text-center gap-4 py-4">
                    <div className="rounded-md bg-coral/10 p-4 border border-coral/20">
                      <p className="text-sm font-medium text-coral">
                        {fieldError || "Xác thực thất bại hoặc link đã hết hạn."}
                      </p>
                    </div>
                    <Button variant="secondary" onClick={() => window.location.href = '/login'} className="w-full">
                      Quay lại đăng nhập
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rounded-md bg-emerald-50 p-4 border border-emerald-100">
                  <p className="text-sm font-medium text-emerald-800">
                    Chúng tôi đã gửi một email xác thực tới địa chỉ của bạn. Vui lòng kiểm tra hộp thư (bao gồm cả mục Spam) để xác thực email.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={resendVerification} className="w-full">
                    Gửi lại email xác thực
                  </Button>
                </div>
              </>
            )
          ) : (
            <>
              <Field label="Số điện thoại">
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0901234567"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
              <Field label="OTP điện thoại">
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Nhập 6 chữ số"
                  inputMode="numeric"
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
            </>
          )}
        </div>
      </Panel>
    </main>
  );
}
