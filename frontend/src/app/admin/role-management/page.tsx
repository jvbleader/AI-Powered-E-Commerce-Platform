"use client";

import { useState, useEffect } from "react";
import { Search, UserPlus, Shield, UserCheck, Key, Phone, Mail, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input, Checkbox, Field } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { apiFetch } from "@/services/api";
import type { User, Role } from "@/types/models";

const normalizeUser = (u: any): User => ({
  id: u.publicId ?? u.public_id ?? u.email,
  fullName: u.fullName ?? u.full_name ?? u.fullname ?? u.email,
  email: u.email,
  phone: u.phone,
  avatarUrl: u.avatarUrl ?? u.avatar_url ?? "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=240&q=80",
  status: u.status ?? "ACTIVE",
  roles: u.roles ?? ["CUSTOMER"],
  emailVerified: Boolean(u.emailVerifiedAt ?? u.email_verified_at),
  phoneVerified: Boolean(u.phoneVerifiedAt ?? u.phone_verified_at),
  gender: u.gender ?? undefined,
  birthday: u.dateOfBirth ?? u.date_of_birth ?? undefined,
  lockedUntil: u.lockedUntil ?? u.locked_until ?? undefined,
  lockReason: u.lockReason ?? u.lock_reason ?? undefined,
});

export default function RoleManagementPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [activeTab, setActiveTab] = useState<"assign" | "create">("assign");
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["ADMIN"]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch users from database on load
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any[]>("/admin/users");
      const normalized = data.map(normalizeUser);
      store.setUsers(normalized);
      setUsersList(normalized);
    } catch (err: any) {
      console.error(err);
      showToast(err.message ?? "Không thể tải danh sách người dùng từ Database.", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleRole = async (targetUser: User, roleToToggle: string) => {
    let nextRoles = [...targetUser.roles];
    const isAdding = !nextRoles.includes(roleToToggle as Role);

    if (isAdding) {
      if (roleToToggle === "ADMIN") {
        nextRoles = nextRoles.filter((r) => r !== "SUPPORTER" && r !== "CUSTOMER");
        nextRoles.push("ADMIN");
      } else if (roleToToggle === "SUPPORTER") {
        if (targetUser.id === store.getCurrentUser()?.id && targetUser.roles.includes("ADMIN")) {
          showToast("Bạn không thể tự chuyển quyền Admin thành Supporter của chính mình.", "danger");
          return;
        }
        nextRoles = nextRoles.filter((r) => r !== "ADMIN" && r !== "CUSTOMER");
        nextRoles.push("SUPPORTER");
      } else {
        nextRoles.push(roleToToggle as Role);
      }
    } else {
      // Prevent self-revoking admin role
      if (targetUser.id === store.getCurrentUser()?.id && roleToToggle === "ADMIN") {
        showToast("Bạn không thể tự thu hồi quyền Admin của chính mình.", "danger");
        return;
      }
      nextRoles = nextRoles.filter((r) => r !== roleToToggle);
    }

    // Default to CUSTOMER if no roles left
    if (nextRoles.length === 0) {
      nextRoles.push("CUSTOMER");
    }

    try {
      const updatedUser = await apiFetch<any>(`/admin/users/${targetUser.id}/roles`, {
        method: "PUT",
        body: JSON.stringify({ roles: nextRoles })
      });
      const normalized = normalizeUser(updatedUser);

      const nextUsers = store.state.users.map((u) => u.id === targetUser.id ? normalized : u);
      store.setUsers(nextUsers);
      setUsersList(nextUsers);
      showToast(`Đã cập nhật quyền thành công cho ${targetUser.fullName}.`, "success");
    } catch (error: any) {
      console.error(error);
      showToast(error.message ?? "Lỗi cập nhật vai trò người dùng.", "danger");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !phone || !password) {
      showToast("Vui lòng điền đầy đủ tất cả thông tin bắt buộc.", "danger");
      return;
    }
    if (password.length < 8) {
      showToast("Mật khẩu phải chứa ít nhất 8 ký tự.", "danger");
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiFetch<any>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          password,
          roles: selectedRoles
        })
      });

      const normalized = normalizeUser(created);

      const nextUsers = [normalized, ...store.state.users];
      store.setUsers(nextUsers);
      setUsersList(nextUsers);

      showToast(`Đã tạo thành công tài khoản ${normalized.fullName} trong Database.`, "success");

      // Reset Form
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setSelectedRoles(["ADMIN"]);
      setActiveTab("assign");
    } catch (error: any) {
      console.error(error);
      showToast(error.message ?? "Lỗi tạo tài khoản mới.", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRoleSelection = (role: string) => {
    if (selectedRoles.includes(role)) {
      const next = selectedRoles.filter((r) => r !== role);
      setSelectedRoles(next.length === 0 ? ["ADMIN"] : next);
    } else {
      if (role === "ADMIN") {
        setSelectedRoles(["ADMIN"]);
      } else if (role === "SUPPORTER") {
        setSelectedRoles(["SUPPORTER"]);
      } else if (role === "CUSTOMER") {
        setSelectedRoles(["CUSTOMER"]);
      } else {
        setSelectedRoles([...selectedRoles.filter((r) => r !== "ADMIN" && r !== "SUPPORTER"), role]);
      }
    }
  };

  const filteredUsers = usersList.filter(
    (user) =>
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.includes(searchQuery)
  );

  return (
    <Section
      title="Quản lý phân quyền"
      description="Cấp quyền Admin & Supporter trực tiếp vào Database, hoặc khởi tạo tài khoản quản trị mới."
    >
      {/* Premium Tabs */}
      <div className="flex gap-2 border-b border-line pb-px mb-6">
        <button
          onClick={() => setActiveTab("assign")}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition duration-200 -mb-px ${
            activeTab === "assign"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Cấp quyền tài khoản có sẵn
        </button>
        <button
          onClick={() => setActiveTab("create")}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition duration-200 -mb-px ${
            activeTab === "create"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Tạo tài khoản quản trị mới
        </button>
      </div>

      {activeTab === "assign" ? (
        <div className="grid gap-4">
          <Panel>
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center mb-4">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  placeholder="Tìm kiếm theo Tên, Email hoặc Số điện thoại..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-canvas border-line focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <Button onClick={fetchUsers} variant="secondary" className="w-full sm:w-auto">
                Làm mới danh sách
              </Button>
            </div>

            {loading ? (
              <div className="py-10 text-center text-muted">Đang tải danh sách người dùng từ Database...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-10 text-center text-muted">Không tìm thấy người dùng phù hợp.</div>
            ) : (
              <div className="overflow-x-auto">
                <DataTable
                  columns={["Người dùng", "Liên hệ", "Trạng thái", "Vai trò Admin", "Vai trò Supporter", "Hành động"]}
                  rows={filteredUsers.map((user) => [
                    <div key="user" className="flex items-center gap-3 py-1">
                      <img
                        src={user.avatarUrl}
                        alt={user.fullName}
                        className="h-9 w-9 rounded-full object-cover border border-line"
                      />
                      <div>
                        <p className="font-bold text-ink leading-tight">{user.fullName}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {user.roles.includes("ADMIN") ? (
                            <span className="text-amber font-semibold">Admin</span>
                          ) : user.roles.includes("SUPPORTER") ? (
                            <span className="text-sky font-semibold">Supporter</span>
                          ) : (
                            <span>Khách hàng</span>
                          )}
                        </p>
                      </div>
                    </div>,
                    <div key="contact">
                      <p className="text-sm font-medium text-ink">{user.email}</p>
                      <p className="text-xs text-muted mt-0.5">{user.phone || "Không có SĐT"}</p>
                    </div>,
                    <StatusBadge key="status" status={user.status} label={user.status === "ACTIVE" ? "Đang hoạt động" : "Bị khóa"} />,
                    <div key="admin-role" className="flex justify-center">
                      <Checkbox
                        label={<span className="text-xs text-muted font-semibold">ADMIN</span>}
                        checked={user.roles.includes("ADMIN")}
                        disabled={user.id === store.getCurrentUser()?.id}
                        onChange={() => handleToggleRole(user, "ADMIN")}
                      />
                    </div>,
                    <div key="supporter-role" className="flex justify-center">
                      <Checkbox
                        label={<span className="text-xs text-muted font-semibold">SUPPORTER</span>}
                        checked={user.roles.includes("SUPPORTER")}
                        onChange={() => handleToggleRole(user, "SUPPORTER")}
                      />
                    </div>,
                    <div key="actions" className="flex gap-2">
                      <Button
                        variant={user.status === "LOCKED" ? "secondary" : "danger"}
                        onClick={() => store.toggleUserLock(user.id)}
                        disabled={user.id === store.getCurrentUser()?.id}
                        className="text-xs py-1 px-3 h-8 min-h-8 font-bold"
                      >
                        {user.status === "LOCKED" ? "Mở khóa" : "Khóa"}
                      </Button>
                    </div>
                  ])}
                />
              </div>
            )}
          </Panel>
        </div>
      ) : (
        <Panel className="max-w-3xl mx-auto shadow-md border-line">
          <div className="mb-6 border-b border-line pb-4 flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2.5 rounded-panel">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink">Thêm tài khoản quản trị mới</h3>
              <p className="text-sm text-muted">Tài khoản tạo ở đây sẽ được ghi trực tiếp vào Database ở trạng thái Active.</p>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Họ và tên">
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    placeholder="Nguyễn Văn A"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </Field>

              <Field label="Mật khẩu khởi tạo">
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    type="password"
                    placeholder="Tối thiểu 8 ký tự"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </Field>

              <Field label="Địa chỉ Email">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </Field>

              <Field label="Số điện thoại">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    type="tel"
                    placeholder="Ví dụ: 0912345678"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </Field>
            </div>

            <div className="border-t border-line pt-4 mt-6">
              <label className="block text-sm font-semibold text-ink mb-3">Vai trò tài khoản (Chọn ít nhất một):</label>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer bg-canvas px-4 py-2.5 rounded-panel border border-line hover:border-primary/45 transition">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes("ADMIN")}
                    onChange={() => handleToggleRoleSelection("ADMIN")}
                    className="h-4 w-4 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-bold text-ink">Quản trị viên (ADMIN)</p>
                    <p className="text-xs text-muted">Toàn quyền cấu hình, duyệt shop, phân quyền.</p>
                  </div>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer bg-canvas px-4 py-2.5 rounded-panel border border-line hover:border-primary/45 transition">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes("SUPPORTER")}
                    onChange={() => handleToggleRoleSelection("SUPPORTER")}
                    className="h-4 w-4 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-bold text-ink">Nhân viên hỗ trợ (SUPPORTER)</p>
                    <p className="text-xs text-muted">Tham gia chat chăm sóc khách hàng, giải quyết khiếu nại.</p>
                  </div>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer bg-canvas px-4 py-2.5 rounded-panel border border-line hover:border-primary/45 transition opacity-60">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes("CUSTOMER")}
                    onChange={() => handleToggleRoleSelection("CUSTOMER")}
                    className="h-4 w-4 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-bold text-ink font-medium">Người mua hàng (CUSTOMER)</p>
                    <p className="text-xs text-muted">Quyền truy cập mua sắm thông thường (Mặc định).</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="border-t border-line pt-4 mt-6 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setActiveTab("assign")}>
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản quản trị"}
              </Button>
            </div>
          </form>
        </Panel>
      )}
    </Section>
  );
}
