"use client";

import { EmptyState } from "@/components/ui/feedback";
import { Section } from "@/components/ui/containers";

export default function SystemReportsPage() {
  return (
    <Section title="Báo cáo hệ thống">
      <EmptyState title="Chưa có báo cáo" description="Không có báo cáo hệ thống nào để hiển thị." />
    </Section>
  );
}
