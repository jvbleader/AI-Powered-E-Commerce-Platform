"use client";

import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";

interface SystemReport {
  code: string;
  severity: string;
  module: string;
  status: string;
}

export default function SystemReportsPage() {
  const [reports] = useState<SystemReport[]>([
    { code: "SYS-001", severity: "HIGH", module: "AUTH", status: "ERROR" },
    { code: "SYS-002", severity: "MEDIUM", module: "PAYMENT", status: "WARNING" },
    { code: "SYS-003", severity: "LOW", module: "SEARCH", status: "INFO" },
  ]);

  const rows = reports.map((report) => [
    report.code,
    report.severity,
    report.module,
    report.status,
  ]);

  return (
    <Section title="System reports">
      <DataTable columns={["Code", "Severity", "Module", "Status"]} rows={rows} />
    </Section>
  );
}
