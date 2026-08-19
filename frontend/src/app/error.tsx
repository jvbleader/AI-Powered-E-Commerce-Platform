"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Root ErrorBoundary Caught]:", error);
  }, [error]);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Đã có lỗi xảy ra</h2>
        <p className="text-sm text-slate-600 mb-6">
          {error?.message || "Hệ thống gặp sự cố trong quá trình xử lý. Bạn có thể thử tải lại trang hoặc quay về trang chủ."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => reset()} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </Button>
          <Link href="/">
            <Button variant="secondary" className="gap-2">
              <Home className="h-4 w-4" aria-hidden="true" />
              Trang chủ
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
