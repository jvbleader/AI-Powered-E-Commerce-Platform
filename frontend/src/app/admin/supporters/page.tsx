"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { apiFetch } from "@/services/api";

interface SupporterUser {
  publicId: string;
  full_name: string;
  email: string;
  phone: string;
  roles: string[];
  status: string;
}

export default function SupportersAdminPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [supporters, setSupporters] = useState<SupporterUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const fetchSupporters = async () => {
    setIsLoading(true);
    try {
      const users = await apiFetch<SupporterUser[]>("/admin/users");
      setSupporters(users.filter(u => u.roles.includes("SUPPORTER")));
    } catch (e: any) {
      showToast(e.message || "Lỗi khi tải danh sách supporter", "danger");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSupporters();
  }, []);

  const handleSubmit = async () => {
    if (!fullName || !email || !phone || !password) {
      showToast("Vui lòng nhập đầy đủ họ tên, email, SĐT và mật khẩu.", "danger");
      return;
    }
    try {
      const newUser = await apiFetch<SupporterUser>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          password,
          roles: ["SUPPORTER"]
        })
      });
      setSupporters([newUser, ...supporters]);
      showToast("Đã tạo supporter thành công.", "success");
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
    } catch (e: any) {
      showToast(e.message || "Lỗi khi tạo supporter", "danger");
    }
  };

  return (
    <Section title="Tài khoản hỗ trợ viên">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {isLoading ? (
          <div className="flex-1 rounded-panel border border-line bg-white p-12 text-center text-slate-500">
            Đang tải dữ liệu...
          </div>
        ) : (
          <div className="h-[75vh] flex flex-col">
            <DataTable
              columns={["Họ tên", "Email", "SĐT", "Trạng thái"]}
              rows={supporters.map((user) => [user.full_name, user.email, user.phone, user.status])}
            />
          </div>
        )}
        <div className="rounded-panel border border-line bg-white p-4 h-fit">
          <h3 className="font-bold">Tạo supporter mới</h3>
          <div className="mt-3 grid gap-3">
            <Input placeholder="Họ tên" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input placeholder="Mật khẩu (tối thiểu 8 ký tự)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button onClick={handleSubmit}>Tạo tài khoản</Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
