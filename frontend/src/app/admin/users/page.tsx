"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { fetchAdminUsers, toggleAdminUserLock } from "@/services/admin-api";
import { User } from "@/types/models";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { TableSkeleton } from "@/components/ui/skeleton";

export default function AdminUsersPage() {
  const { showToast } = useMarketplaceStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [submittingLock, setSubmittingLock] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (error) {
      console.error(error);
      showToast("Lỗi tải danh sách người dùng", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const confirmToggleLock = async () => {
    if (!confirmUser) return;
    try {
      setSubmittingLock(true);
      const updatedUser = await toggleAdminUserLock(confirmUser.id);
      setUsers((prev) => prev.map((u) => (u.id === confirmUser.id ? { ...u, status: updatedUser.status } : u)));
      showToast(updatedUser.status === "LOCKED" ? "Đã khóa tài khoản thành công." : "Đã mở khóa tài khoản thành công.", "success");
      setConfirmUser(null);
    } catch (error: any) {
      console.error(error);
      showToast(error.message ?? "Lỗi cập nhật trạng thái khóa.", "danger");
    } finally {
      setSubmittingLock(false);
    }
  };

  return (
    <Section title="Quản lý users" className="h-full flex flex-col overflow-hidden pb-0">
      {loading ? (
        <div className="p-4"><TableSkeleton headers={["User", "Email", "Roles", "Status", "Action"]} rows={10} /></div>
      ) : (
        <DataTable
          columns={["User", "Email", "Roles", "Status", "Action"]}
          rows={users.map((user) => [
            <a key="name" href={`/admin/users/${user.id}`} className="font-bold text-primary">
              {user.fullName || "Chưa có tên"}
            </a>,
            user.email,
            user.roles?.join(", "),
            <StatusBadge key="st" status={user.status} label={user.status} />,
            <Button
              key="lock"
              variant={user.status === "LOCKED" ? "secondary" : "danger"}
              onClick={() => setConfirmUser(user)}
            >
              {user.status === "LOCKED" ? "Unlock" : "Lock"}
            </Button>
          ])}
        />
      )}

      {confirmUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-panel border border-line bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h3 id="confirm-modal-title" className="text-lg font-bold text-ink">
              {confirmUser.status === "LOCKED" ? "Xác nhận mở khóa tài khoản" : "Xác nhận khóa tài khoản"}
            </h3>
            <p className="mt-2 text-sm text-muted">
              Bạn có chắc chắn muốn {confirmUser.status === "LOCKED" ? "mở khóa" : "khóa"} tài khoản của người dùng{" "}
              <strong className="text-ink">{confirmUser.fullName || confirmUser.email}</strong> không?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                disabled={submittingLock}
                onClick={() => setConfirmUser(null)}
              >
                Hủy
              </Button>
              <Button
                variant={confirmUser.status === "LOCKED" ? "primary" : "danger"}
                disabled={submittingLock}
                onClick={confirmToggleLock}
              >
                {submittingLock ? "Đang xử lý..." : (confirmUser.status === "LOCKED" ? "Mở khóa" : "Khóa tài khoản")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
