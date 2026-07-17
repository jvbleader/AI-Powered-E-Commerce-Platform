"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

interface ViolationReport {
  id: string;
  report: string;
  product: string;
  reason: string;
  status: string;
}

export default function ViolationReportsPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [reports, setReports] = useState<ViolationReport[]>([
    { id: "1", report: "RP-001", product: "Điện thoại giả", reason: "Bán hàng giả mạo thương hiệu", status: "PENDING" },
    { id: "2", report: "RP-002", product: "Mỹ phẩm kém chất lượng", reason: "Gây dị ứng cho người dùng", status: "PENDING" },
  ]);

  const handleProcess = (id: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "APPROVED" } : r))
    );
    showToast("Đã xử lý báo cáo.", "success");
  };

  const handleReject = (id: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "REJECTED" } : r))
    );
    showToast("Đã từ chối báo cáo.", "info");
  };

  return (
    <Section title="Violation reports">
      <DataTable
        columns={["Report", "Product", "Reason", "Status", "Actions"]}
        rows={reports.map((report) => [
          report.report,
          report.product,
          report.reason,
          <StatusBadge key={`st-${report.id}`} status={report.status} label={report.status} />,
          <div key={`actions-${report.id}`} className="flex gap-2">
            <Button variant="secondary" onClick={() => handleProcess(report.id)}>
              Xử lý
            </Button>
            <Button variant="ghost" onClick={() => handleReject(report.id)}>
              Từ chối
            </Button>
          </div>
        ])}
      />
    </Section>
  );
}
