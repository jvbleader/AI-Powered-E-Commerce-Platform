"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function NotFoundPage() {
  return (
    <main className="fixed inset-0 z-50 flex w-full items-center justify-center bg-[#faf6f0] px-4 overflow-hidden">
      <div className="w-full max-w-2xl">
        <EmptyState
          title="Không tìm thấy trang"
          description="Đường dẫn không đúng hoặc không còn tồn tại."
          action={<Button onClick={() => (window.location.href = "/")}>Về trang chủ</Button>}
        />
      </div>
    </main>
  );
}
