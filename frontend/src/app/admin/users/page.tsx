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

  const handleToggleLock = async (userId: string) => {
    try {
      const updatedUser = await toggleAdminUserLock(userId);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: updatedUser.status } : u)));
      showToast(updatedUser.status === "LOCKED" ? "Đã khóa tài khoản thành công." : "Đã mở khóa tài khoản thành công.", "success");
    } catch (error: any) {
      console.error(error);
      showToast(error.message ?? "Lỗi cập nhật trạng thái khóa.", "danger");
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
              onClick={() => handleToggleLock(user.id)}
            >
              {user.status === "LOCKED" ? "Unlock" : "Lock"}
            </Button>
          ])}
        />
      )}
    </Section>
  );
}
