"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, Section } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-line bg-white p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <EmptyState
        title="Không tìm thấy route"
        description="Đường dẫn không đúng hoặc không còn tồn tại."
        action={<Button onClick={() => (window.location.href = "/")}>Về trang chủ</Button>}
      />
    </main>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const store = useMarketplaceStore();
  const user = store.state.users.find((item) => item.id === userId);

  if (!user) return <NotFoundPage />;

  return (
    <Section title={`User ${user.fullName}`}>
      <Panel>
        <div className="grid gap-3 md:grid-cols-2">
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Phone" value={user.phone} />
          <InfoRow label="Roles" value={user.roles.join(", ")} />
          <InfoRow label="Status" value={user.status} />
          <InfoRow label="Lock reason" value={user.lockReason ?? "Không có"} />
        </div>
        <Button
          className="mt-4"
          variant={user.status === "LOCKED" ? "secondary" : "danger"}
          onClick={() => store.toggleUserLock(user.id)}
        >
          {user.status === "LOCKED" ? "Unlock user" : "Lock user"}
        </Button>
      </Panel>
    </Section>
  );
}
