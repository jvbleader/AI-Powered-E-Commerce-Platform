"use client";

import PasswordPage from "@/components/auth/password-form";
import { Suspense } from "react";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <PasswordPage mode="reset" />
    </Suspense>
  );
}
