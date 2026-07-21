"use client";

import { EmptyState } from "@/components/ui/feedback";
import { Section } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function ViolationReportsPage() {
  const store = useMarketplaceStore();
  const reports = store.state.violationReports ?? [];

  return (
    <Section title="Báo cáo vi phạm">
      {reports.length === 0 ? (
        <EmptyState title="Chưa có báo cáo vi phạm" description="Không có báo cáo vi phạm nào từ người dùng." />
      ) : null}
    </Section>
  );
}
