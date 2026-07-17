"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

interface SupporterUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  roles: string[];
  status: string;
}

export default function SupportersAdminPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [supporters, setSupporters] = useState<SupporterUser[]>(() =>
    store.state.users.filter((user) => user.roles.includes("SUPPORTER"))
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = () => {
    if (!fullName || !email) {
      showToast("Vui lòng nhập đầy đủ họ tên và email.", "danger");
      return;
    }
    const newSupporter = {
      id: `user-${Date.now()}`,
      fullName,
      email,
      phone,
      roles: ["SUPPORTER" as const],
      status: "ACTIVE" as const,
      avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=240&q=80",
      emailVerified: true,
      phoneVerified: true
    };
    store.setUsers([...store.state.users, newSupporter]);
    setSupporters([...supporters, newSupporter]);
    showToast("Đã tạo supporter.", "success");
    setFullName("");
    setEmail("");
    setPhone("");
  };

  return (
    <Section title="Supporter accounts">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <DataTable
          columns={["Name", "Email", "Status"]}
          rows={supporters.map((user) => [user.fullName, user.email, user.status])}
        />
        <Panel>
          <h3 className="font-bold">Tạo supporter</h3>
          <div className="mt-3 grid gap-3">
            <Input placeholder="Họ tên" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button onClick={handleSubmit}>Tạo</Button>
          </div>
        </Panel>
      </div>
    </Section>
  );
}
