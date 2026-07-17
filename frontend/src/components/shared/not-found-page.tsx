"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <EmptyState
        title="Không tìm thấy trang"
        description="Đường dẫn không đúng hoặc không còn tồn tại."
        action={<Button onClick={() => (window.location.href = "/")}>Về trang chủ</Button>}
      />
    </main>
  );
}
