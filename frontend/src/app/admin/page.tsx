"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/containers";
import { MetricCard } from "@/components/shared/cards";
import { formatVnd } from "@/lib/helpers";
import { fetchAdminDashboardStats, AdminDashboardStats } from "@/services/admin-api";
import { Loader2 } from "lucide-react";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    fetchAdminDashboardStats()
      .then((data) => {
        if (isMounted) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load admin stats", err);
        if (isMounted) {
          setError("Không thể tải dữ liệu tổng quan");
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <Section title="Tổng quan">
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </Section>
    );
  }

  if (error || !stats) {
    return (
      <Section title="Tổng quan">
        <div className="flex h-40 items-center justify-center text-rose-500 font-medium">
          {error || "Lỗi tải dữ liệu"}
        </div>
      </Section>
    );
  }

  return (
    <Section title="Tổng quan">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Doanh thu toàn sàn"
          value={formatVnd(stats.total_revenue)}
        />
        <MetricCard label="Người dùng" value={`${stats.total_users}`} />
        <MetricCard label="Người bán" value={`${stats.total_sellers}`} />
        <MetricCard
          label="Hồ sơ chờ duyệt"
          value={`${stats.pending_seller_applications}`}
        />
      </div>
    </Section>
  );
}
