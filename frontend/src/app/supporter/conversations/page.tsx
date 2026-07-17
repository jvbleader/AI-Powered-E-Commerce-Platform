"use client";

import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";
import { formatDate } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function SupporterConversationsPage() {
  const store = useMarketplaceStore();

  return (
    <Section title="Conversations được phân">
      <DataTable
        columns={["Title", "Customer", "Mode", "Last message", "Action"]}
        rows={store.state.conversations.map((conv) => [
          conv.title,
          conv.customerName,
          conv.mode,
          formatDate(conv.lastMessageAt),
          <a key="open" className="font-bold text-primary" href={`/supporter/conversations/${conv.id}`}>
            Mở
          </a>
        ])}
      />
    </Section>
  );
}
