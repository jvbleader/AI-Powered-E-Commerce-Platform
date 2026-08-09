"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function ChatRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    const sessionId = searchParams.get("session_id");
    const shopId = searchParams.get("shop_id");

    if (tab === "SELLER") {
      const params = new URLSearchParams();
      params.set("tab", "SELLER");
      if (sessionId) params.set("session_id", sessionId);
      if (shopId) params.set("shop_id", shopId);
      router.replace(`/?${params.toString()}`);
      return;
    }

    if (sessionId) {
      router.replace(`/support?session_id=${sessionId}`);
      return;
    }

    router.replace("/support");
  }, [router, searchParams]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
    </div>
  );
}

/** Redirect legacy /chat URLs to /support or home (seller widget deep-links). */
export default function ChatRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      }
    >
      <ChatRedirectContent />
    </Suspense>
  );
}
