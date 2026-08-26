"use client";

export interface AdminUserBreakdownData {
  total_customers: number;
  total_sellers: number;
  total_supporters: number;
  total_admins: number;
  active_users: number;
  locked_users: number;
}

const ROLES: Array<{ key: keyof AdminUserBreakdownData; label: string; icon: string }> = [
  { key: "total_customers", label: "Khách hàng", icon: "🛍️" },
  { key: "total_sellers", label: "Người bán (Shop)", icon: "🏪" },
  { key: "total_supporters", label: "Hỗ trợ viên (CSKH)", icon: "🎧" },
  { key: "total_admins", label: "Quản trị viên", icon: "🛡️" }
];

export function UserBreakdown({ breakdown }: { breakdown: AdminUserBreakdownData }) {
  const total =
    breakdown.total_customers +
    breakdown.total_sellers +
    breakdown.total_supporters +
    breakdown.total_admins;

  return (
    <div className="space-y-3 rounded-panel border border-line bg-white p-4 shadow-soft">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-ink">Cơ cấu người dùng</h3>
        <span className="text-xs text-muted">
          Tổng: <strong className="font-bold text-ink">{total.toLocaleString("vi-VN")}</strong>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((role) => {
          const value = Number(breakdown[role.key] ?? 0);
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div
              key={role.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-slate-50/60 px-3 py-2.5"
            >
              <span className="min-w-0 truncate text-xs text-slate-600">
                <span aria-hidden="true">{role.icon}</span> {role.label}
              </span>
              <span className="shrink-0 text-right">
                <strong className="block text-sm font-bold text-ink">{value.toLocaleString("vi-VN")}</strong>
                <span className="text-[10px] text-muted">{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-line pt-2 text-xs text-muted">
        <span>
          Đang hoạt động:{" "}
          <strong className="font-semibold text-emerald-600">
            {(breakdown.active_users ?? 0).toLocaleString("vi-VN")}
          </strong>
        </span>
        <span>
          Bị khóa:{" "}
          <strong className="font-semibold text-rose-600">
            {(breakdown.locked_users ?? 0).toLocaleString("vi-VN")}
          </strong>
        </span>
      </div>

      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`Hoạt động ${breakdown.active_users ?? 0}, bị khóa ${breakdown.locked_users ?? 0}`}
      >
        {(() => {
          const activePct = total > 0 ? ((breakdown.active_users ?? 0) / total) * 100 : 0;
          const lockedPct = total > 0 ? ((breakdown.locked_users ?? 0) / total) * 100 : 0;
          return (
            <>
              <div className="h-full bg-emerald-500" style={{ width: `${activePct}%` }} />
              <div className="h-full bg-rose-400" style={{ width: `${lockedPct}%` }} />
            </>
          );
        })()}
      </div>
    </div>
  );
}
