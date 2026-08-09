"use client";

import { Loader2 } from "lucide-react";

export function PaymentLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600 mb-3" />
      <p className="text-sm text-muted">Đang tải thông tin thanh toán...</p>
    </main>
  );
}
