"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function AdminUsersPage() {
  const store = useMarketplaceStore();

  return (
    <Section title="Quản lý users">
      <DataTable
        columns={["User", "Email", "Roles", "Status", "Action"]}
        rows={store.state.users.map((user) => [
          <a key="name" href={`/admin/users/${user.id}`} className="font-bold text-primary">
            {user.fullName}
          </a>,
          user.email,
          user.roles.join(", "),
          <StatusBadge key="st" status={user.status} label={user.status} />,
          <Button
            key="lock"
            variant={user.status === "LOCKED" ? "secondary" : "danger"}
            onClick={() => store.toggleUserLock(user.id)}
          >
            {user.status === "LOCKED" ? "Unlock" : "Lock"}
          </Button>
        ])}
      />
    </Section>
  );
}
