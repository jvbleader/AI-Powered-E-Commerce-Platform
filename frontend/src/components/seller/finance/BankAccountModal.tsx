"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Building2, CreditCard, User, AlertCircle, X } from "lucide-react";
import type { BankAccountPayload } from "@/store/slices/types";

interface BankAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBankInfo?: {
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_account_name?: string | null;
  };
  onSubmit: (payload: BankAccountPayload) => Promise<boolean>;
}

const POPULAR_BANKS = [
  "Vietcombank (VCB)",
  "Techcombank (TCB)",
  "MBBank (Ngân hàng Quân Đội)",
  "BIDV",
  "VietinBank",
  "ACB (Á Châu)",
  "TPBank (Tiên Phong)",
  "VPBank (Việt Nam Thịnh Vượng)",
  "Sacombank",
  "HDBank",
  "VIB (Quốc Tế)",
  "MSB (Hàng Hải)",
  "SHB (Sài Gòn - Hà Nội)",
  "SeABank",
  "Agribank",
  "Khác (Tự nhập)",
];

export function BankAccountModal({
  open,
  onOpenChange,
  initialBankInfo,
  onSubmit,
}: BankAccountModalProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [customBankName, setCustomBankName] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [accountName, setAccountName] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && initialBankInfo) {
      const bName = initialBankInfo.bank_name || "";
      if (POPULAR_BANKS.includes(bName)) {
        setSelectedBank(bName);
        setCustomBankName("");
      } else if (bName) {
        setSelectedBank("Khác (Tự nhập)");
        setCustomBankName(bName);
      } else {
        setSelectedBank(POPULAR_BANKS[0]);
        setCustomBankName("");
      }
      setAccountNumber(initialBankInfo.bank_account_number || "");
      setAccountName(initialBankInfo.bank_account_name || "");
      setErrorMsg("");
    }
  }, [open, initialBankInfo]);

  if (!mounted || !open || typeof document === "undefined") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalBankName = selectedBank === "Khác (Tự nhập)" ? customBankName.trim() : selectedBank.trim();

    if (!finalBankName) {
      setErrorMsg("Vui lòng chọn hoặc nhập tên ngân hàng.");
      return;
    }
    if (!accountNumber.trim()) {
      setErrorMsg("Vui lòng nhập số tài khoản ngân hàng.");
      return;
    }
    if (!accountName.trim()) {
      setErrorMsg("Vui lòng nhập tên chủ tài khoản.");
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onSubmit({
        bank_name: finalBankName,
        bank_account_number: accountNumber.trim(),
        bank_account_name: accountName.trim().toUpperCase(),
      });
      if (ok) {
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-line p-6 relative">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 text-slate-400 hover:text-ink transition-colors p-1"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky/15 text-sky">
            <Building2 className="h-4 w-4" />
          </div>
          <h3 className="text-base font-bold text-ink">Thiết lập tài khoản ngân hàng nhận tiền</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bank Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              Ngân hàng thụ hưởng
            </label>
            <Select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="h-10 text-xs w-full"
            >
              {POPULAR_BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>

            {selectedBank === "Khác (Tự nhập)" && (
              <Input
                type="text"
                value={customBankName}
                onChange={(e) => setCustomBankName(e.target.value)}
                placeholder="Nhập tên đầy đủ của ngân hàng..."
                className="h-9 text-xs mt-2"
                required
              />
            )}
          </div>

          {/* Account Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-slate-400" />
              Số tài khoản ngân hàng
            </label>
            <Input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="VD: 19036789123456"
              className="h-10 text-xs font-mono font-bold"
              required
            />
          </div>

          {/* Account Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" />
              Tên chủ tài khoản (In hoa không dấu)
            </label>
            <Input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value.toUpperCase())}
              placeholder="VD: NGUYEN VAN A"
              className="h-10 text-xs uppercase font-bold"
              required
            />
            <p className="text-[11px] text-muted">Tên chủ tài khoản cần khớp chính xác với thông tin đăng ký tại ngân hàng.</p>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {errorMsg}
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-2 pt-2 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="h-9 text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary-dark text-white h-9 text-xs"
            >
              {submitting ? "Đang lưu..." : "Lưu tài khoản"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
