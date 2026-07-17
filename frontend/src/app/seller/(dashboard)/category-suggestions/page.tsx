"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function CategorySuggestionsPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [name, setName] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    showToast("Đã gửi đề xuất category.", "success");
    setName("");
    setReason("");
  };

  return (
    <Section title="Đề xuất category">
      <Panel>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Tên category đề xuất">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Lý do">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button onClick={handleSubmit}>Gửi</Button>
          </div>
        </div>
      </Panel>
    </Section>
  );
}
