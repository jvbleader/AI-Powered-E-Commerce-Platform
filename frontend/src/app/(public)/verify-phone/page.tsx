"use client";

import VerificationPage from "@/components/auth/verification-form";
import { Suspense } from "react";

export default function VerifyPhonePage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <VerificationPage type="phone" />
    </Suspense>
  );
}
