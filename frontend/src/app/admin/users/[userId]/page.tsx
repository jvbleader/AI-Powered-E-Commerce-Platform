"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, Section } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

import { useEffect, useState } from "react";
import { fetchAdminUsers, toggleAdminUserLock } from "@/services/admin-api";
import { User } from "@/types/models";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-line bg-white p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

function NotFoundPage({ onBack }: { onBack?: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <EmptyState
        title="Không tìm thấy route"
        description="Đường dẫn không đúng hoặc không còn tồn tại."
        action={<Button onClick={onBack}>Về trang chủ</Button>}
      />
    </main>
  );
}

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const store = useMarketplaceStore();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submittingLock, setSubmittingLock] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        const users = await fetchAdminUsers();
        const found = users.find((u) => u.id === userId);
        setUser(found || null);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [userId]);

  const confirmToggleLock = async () => {
    if (!user) return;
    try {
      setSubmittingLock(true);
      const updatedUser = await toggleAdminUserLock(user.id);
      setUser({ ...user, status: updatedUser.status });
      store.showToast(updatedUser.status === "LOCKED" ? "Đã khóa tài khoản thành công." : "Đã mở khóa tài khoản thành công.", "success");
      setConfirmOpen(false);
    } catch (error: any) {
      console.error(error);
      store.showToast(error.message ?? "Lỗi cập nhật trạng thái khóa.", "danger");
    } finally {
      setSubmittingLock(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Đang tải...</div>;
  if (!user) return <NotFoundPage onBack={() => router.push("/")} />;

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
          onClick={() => setConfirmOpen(true)}
        >
          {user.status === "LOCKED" ? "Unlock user" : "Lock user"}
        </Button>
      </Panel>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-detail-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-panel border border-line bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 id="confirm-detail-modal-title" className="text-lg font-bold text-ink">
              {user.status === "LOCKED" ? "Xác nhận mở khóa tài khoản" : "Xác nhận khóa tài khoản"}
            </h3>
            <p className="mt-2 text-sm text-muted">
              Bạn có chắc chắn muốn {user.status === "LOCKED" ? "mở khóa" : "khóa"} tài khoản của người dùng{" "}
              <strong className="text-ink">{user.fullName || user.email}</strong> không?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                disabled={submittingLock}
                onClick={() => setConfirmOpen(false)}
              >
                Hủy
              </Button>
              <Button
                variant={user.status === "LOCKED" ? "primary" : "danger"}
                disabled={submittingLock}
                onClick={confirmToggleLock}
              >
                {submittingLock ? "Đang xử lý..." : (user.status === "LOCKED" ? "Mở khóa" : "Khóa tài khoản")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
