"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/feedback";
import { Panel, Section } from "@/components/ui/containers";
import { Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { sellerStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { SellerApplication, SellerStatus } from "@/types/models";

export default function AdminSellersPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const [status, setStatus] = useState<SellerStatus | "">("");
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [applicationsError, setApplicationsError] = useState("");
  const [busyApplicationId, setBusyApplicationId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingApplications(true);
    setApplicationsError("");

    store.listSellerApplications(status)
      .then((result) => {
        if (cancelled) return;

        if (!result.ok) {
          setApplicationsError(result.message);
          setApplications([]);
          return;
        }

        setApplications(result.applications);
      })
      .finally(() => {
        if (!cancelled) setLoadingApplications(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, store.listSellerApplications]);

  const reviewApplication = async (application: SellerApplication, action: "approve" | "reject") => {
    if (!application.publicId) return;

    setBusyApplicationId(application.publicId);
    const result = await store.reviewSellerApplication(
      application.publicId,
      action,
      action === "reject" ? "Hồ sơ thiếu thông tin." : undefined
    );
    setBusyApplicationId("");

    if (!result.ok) {
      showToast(result.message, "danger");
      return;
    }

    showToast(result.message, "success");
    setApplications((prev) =>
      prev.map((item) =>
        item.publicId === application.publicId
          ? {
              ...item,
              status: result.application.status,
              rejectedReason: result.application.rejectedReason,
              approvedAt: result.application.approvedAt
            }
          : item
      )
    );
  };

  return (
    <Section
      title="Duyệt seller"
      action={
        <Select value={status} onChange={(event) => setStatus(event.target.value as SellerStatus | "")} className="w-44">
          <option value="">Tất cả</option>
          {Object.entries(sellerStatusLabel).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      }
    >
      {loadingApplications ? (
        <Panel>
          <div className="flex items-center gap-3">
            <RefreshCcw className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-muted">Đang tải hồ sơ seller...</p>
          </div>
        </Panel>
      ) : applicationsError ? (
        <ErrorState title="Không tải được hồ sơ seller" description={applicationsError} />
      ) : (
        <DataTable
          columns={["Shop", "Slug", "Status", "Tax", "Bank", "Action"]}
          rows={applications.map((application) => {
            const applicationStatus = application.status ?? "PENDING";
            const busy = busyApplicationId === application.publicId;
            return [
              <a key="shop" className="font-bold text-primary" href={`/admin/sellers/${application.publicId}`}>
                {application.shopName}
              </a>,
              application.shopSlug ?? "-",
              <StatusBadge key="st" status={applicationStatus} label={sellerStatusLabel[applicationStatus]} />,
              application.taxCode,
              application.bankName,
              <div key="act" className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={busy || applicationStatus !== "PENDING"}
                  onClick={() => reviewApplication(application, "approve")}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  disabled={busy || applicationStatus !== "PENDING"}
                  onClick={() => reviewApplication(application, "reject")}
                >
                  Reject
                </Button>
              </div>
            ];
          })}
        />
      )}
    </Section>
  );
}
