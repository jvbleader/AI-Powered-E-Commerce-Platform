"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

interface KnowledgeDoc {
  id: string;
  document: string;
  type: string;
  status: string;
  chunks: number;
  updated: string;
}

export default function AiKnowledgePage() {
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [documents, setDocuments] = useState<KnowledgeDoc[]>([
    { id: "1", document: "Quy chế hoạt động sàn.pdf", type: "POLICY", status: "Active", chunks: 42, updated: "2026-07-10 14:00" },
    { id: "2", document: "Câu hỏi thường gặp FAQ.txt", type: "FAQ", status: "Active", chunks: 18, updated: "2026-07-12 09:30" }
  ]);

  const [name, setName] = useState("");
  const [type, setType] = useState("POLICY");
  const [file, setFile] = useState("");

  const handleUpload = () => {
    if (!name || !file) {
      showToast("Vui lòng điền tên tài liệu và chọn file.", "danger");
      return;
    }
    const newDoc: KnowledgeDoc = {
      id: Date.now().toString(),
      document: name,
      type: type,
      status: "Active",
      chunks: Math.floor(Math.random() * 50) + 5,
      updated: new Date().toISOString().replace("T", " ").substring(0, 16)
    };
    setDocuments([...documents, newDoc]);
    showToast("Đã upload knowledge.", "success");
    setName("");
    setFile("");
  };

  const rows = documents.map((doc) => [
    doc.document,
    doc.type,
    doc.status,
    doc.chunks.toString(),
    doc.updated
  ]);

  return (
    <Section title="AI knowledge/RAG">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <DataTable columns={["Document", "Type", "Status", "Chunks", "Updated"]} rows={rows} />
        <Panel>
          <h3 className="font-bold">Upload knowledge</h3>
          <div className="mt-3 grid gap-3">
            <Input placeholder="Tên tài liệu" value={name} onChange={(e) => setName(e.target.value)} />
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option>POLICY</option>
              <option>FAQ</option>
              <option>PRODUCT_GUIDE</option>
            </Select>
            <Input type="file" value={file} onChange={(e) => setFile(e.target.value)} />
            <Button onClick={handleUpload}>Upload</Button>
          </div>
        </Panel>
      </div>
    </Section>
  );
}
