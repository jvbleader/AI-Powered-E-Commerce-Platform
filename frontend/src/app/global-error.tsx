"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global ErrorBoundary Caught]:", error);
  }, [error]);

  return (
    <html lang="vi">
      <body className="min-h-screen bg-[#faf6f0] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-md">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Lỗi Hệ Thống Nghiêm Trọng</h2>
          <p className="text-sm text-slate-600 mb-6">
            {error?.message || "Đã xảy ra lỗi ngoài dự kiến trong ứng dụng. Vui lòng thử tải lại trang."}
          </p>
          <Button onClick={() => reset()} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tải lại ứng dụng
          </Button>
        </div>
      </body>
    </html>
  );
}
