"use client";

import PasswordPage from "@/components/auth/password-form";
import { Suspense } from "react";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <PasswordPage mode="forgot" />
    </Suspense>
  );
}
