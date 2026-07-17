"use client";

import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function AdminChatsPage() {
  const store = useMarketplaceStore();

  return (
    <Section title="Admin xem chat">
      <DataTable
        columns={["Conversation", "Customer", "Supporter", "Status", "Mode"]}
        rows={store.state.conversations.map((conv) => [
          conv.title,
          conv.customerName,
          conv.assignedSupporter,
          conv.status,
          conv.mode
        ])}
      />
    </Section>
  );
}
