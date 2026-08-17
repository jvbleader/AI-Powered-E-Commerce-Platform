"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { apiFetch } from "@/services/api";
import type { User } from "@/types/models";
import { cn } from "@/lib/utils";

const normalizeUser = (u: any): User => ({
  id: u.publicId ?? u.public_id ?? u.email,
  fullName: u.fullName ?? u.full_name ?? u.fullname ?? u.email,
  email: u.email,
  phone: u.phone,
  avatarUrl:
    u.avatarUrl ??
    u.avatar_url ??
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80",
  status: u.status ?? "ACTIVE",
  roles: u.roles ?? ["CUSTOMER"],
  emailVerified: Boolean(u.emailVerifiedAt ?? u.email_verified_at),
  phoneVerified: Boolean(u.phoneVerifiedAt ?? u.phone_verified_at),
});

export default function RoleManagementPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const currentUser = store.getCurrentUser();

  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "SUPPORTER">("ALL");

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "SUPPORTER">("ADMIN");
  const [submitting, setSubmitting] = useState(false);

  const fetchStaffUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any[]>("/admin/users");
      const normalized = data.map(normalizeUser);
      setUsersList(normalized);
      store.setUsers(normalized);
    } catch (err: any) {
      showToast(err.message || "Không thể tải danh sách tài khoản.", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      showToast("Vui lòng nhập đầy đủ thông tin.", "danger");
      return;
    }
    if (password.length < 8) {
      showToast("Mật khẩu phải có ít nhất 8 ký tự.", "danger");
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiFetch<any>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          roles: [selectedRole]
        })
      });

      const normalized = normalizeUser(created);
      const nextUsers = [normalized, ...usersList];
      setUsersList(nextUsers);
      store.setUsers(nextUsers);

      showToast(`Đã tạo tài khoản ${normalized.fullName} thành công.`, "success");

      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
    } catch (error: any) {
      showToast(error.message || "Không thể tạo tài khoản.", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLock = async (user: User) => {
    if (user.id === currentUser?.id) {
      showToast("Không thể tự khóa tài khoản đang đăng nhập.", "danger");
      return;
    }
    try {
      const updated = await apiFetch<any>(`/admin/users/${user.id}/toggle-lock`, { method: "POST" });
      const normalized = normalizeUser(updated);
      const nextUsers = usersList.map((u) => (u.id === user.id ? normalized : u));
      setUsersList(nextUsers);
      store.setUsers(nextUsers);
      showToast(`Đã ${normalized.status === "LOCKED" ? "khóa" : "mở khóa"} tài khoản ${user.fullName}.`, "success");
    } catch (err: any) {
      showToast(err.message || "Lỗi thao tác tài khoản.", "danger");
    }
  };

  const staffUsers = usersList.filter(
    (u) => u.roles.includes("ADMIN") || u.roles.includes("SUPPORTER")
  );

  const filteredStaff = staffUsers.filter((user) => {
    const q = searchQuery.toLowerCase().trim();
    const matchText = !q || user.fullName.toLowerCase().includes(q) || user.email.toLowerCase().includes(q) || user.phone.includes(q);
    if (!matchText) return false;
    if (roleFilter === "ADMIN" && !user.roles.includes("ADMIN")) return false;
    if (roleFilter === "SUPPORTER" && !user.roles.includes("SUPPORTER")) return false;
    return true;
  });

  return (
    <Section title="Tạo tài khoản">
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Form Panel */}
        <div className="lg:col-span-4">
          <Panel className="p-4 space-y-4">
            <h3 className="font-bold text-ink text-sm">Thêm tài khoản mới</h3>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <Field label="Họ và tên">
                <Input
                  placeholder="Nguyễn Văn A"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>

              <Field label="Email">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field label="Số điện thoại">
                <Input
                  type="tel"
                  placeholder="0912345678"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>

              <Field label="Mật khẩu">
                <Input
                  type="password"
                  placeholder="Tối thiểu 8 ký tự"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              <Field label="Vai trò">
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as "ADMIN" | "SUPPORTER")}
                >
                  <option value="ADMIN">Quản trị viên (Admin)</option>
                  <option value="SUPPORTER">Hỗ trợ viên (Supporter)</option>
                </Select>
              </Field>

              <div className="pt-2">
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Đang tạo..." : "Tạo tài khoản"}
                </Button>
              </div>
            </form>
          </Panel>
        </div>

        {/* Staff List Panel */}
        <div className="lg:col-span-8">
          <Panel className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-ink text-sm">
                Danh sách nhân sự ({filteredStaff.length})
              </h3>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-56">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <Input
                    placeholder="Tìm kiếm..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>

                <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-line shrink-0">
                  {(
                    [
                      { key: "ALL", label: "Tất cả" },
                      { key: "ADMIN", label: "Admin" },
                      { key: "SUPPORTER", label: "Supporter" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setRoleFilter(tab.key)}
                      className={cn(
                        "px-2 py-1 text-xs font-semibold rounded-md transition-colors",
                        roleFilter === tab.key ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <Button
                  variant="secondary"
                  onClick={fetchStaffUsers}
                  disabled={loading}
                  className="text-xs h-8 px-2.5 shrink-0"
                  title="Làm mới danh sách"
                >
                  <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                </Button>
              </div>
            </div>

            <DataTable
              columns={["Họ tên", "Email", "Số điện thoại", "Vai trò", "Trạng thái", "Thao tác"]}
              rows={filteredStaff.map((user) => {
                const isAdmin = user.roles.includes("ADMIN");
                const isSelf = user.id === currentUser?.id;

                return [
                  <div key="name" className="flex items-center gap-2.5">
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName}
                      className="h-8 w-8 rounded-full object-cover border border-line shrink-0"
                    />
                    <div>
                      <span className="font-semibold text-ink">{user.fullName}</span>
                      {isSelf && (
                        <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-normal">
                          Bạn
                        </span>
                      )}
                    </div>
                  </div>,
                  <span key="email" className="text-slate-600">{user.email}</span>,
                  <span key="phone" className="text-slate-600">{user.phone || "-"}</span>,
                  <span
                    key="role"
                    className={cn(
                      "inline-flex px-2 py-0.5 rounded text-xs font-semibold",
                      isAdmin ? "bg-slate-900 text-white" : "bg-blue-100 text-blue-800"
                    )}
                  >
                    {isAdmin ? "Admin" : "Supporter"}
                  </span>,
                  <StatusBadge
                    key="status"
                    status={user.status}
                    label={user.status === "ACTIVE" ? "Hoạt động" : "Bị khóa"}
                  />,
                  <Button
                    key="action"
                    variant={user.status === "LOCKED" ? "secondary" : "danger"}
                    onClick={() => handleToggleLock(user)}
                    disabled={isSelf}
                    className="text-xs h-7 px-2"
                  >
                    {user.status === "LOCKED" ? "Mở khóa" : "Khóa"}
                  </Button>
                ];
              })}
            />
          </Panel>
        </div>
      </div>
    </Section>
  );
}


