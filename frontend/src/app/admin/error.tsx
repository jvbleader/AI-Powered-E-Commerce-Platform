"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Shield } from "lucide-react";
import Link from "next/link";

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Admin ErrorBoundary Caught]:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Lỗi Trang Quản Trị</h2>
        <p className="text-sm text-slate-600 mb-6">
          {error?.message || "Không thể tải dữ liệu quản trị hệ thống. Vui lòng thử lại."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => reset()} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </Button>
          <Link href="/admin">
            <Button variant="secondary" className="gap-2">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Trang quản trị
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
