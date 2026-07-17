"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function Unauthorized({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <ErrorState
        title={title}
        description={description}
        action={<Button onClick={() => (window.location.href = "/login")}>Đăng nhập</Button>}
      />
    </main>
  );
}
