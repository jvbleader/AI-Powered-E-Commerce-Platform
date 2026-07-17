"use client";

import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { Toast } from "@/components/ui/feedback";

export function GlobalToast() {
  const { toast } = useMarketplaceStore();
  return <Toast message={toast?.message} tone={toast?.tone} />;
}
