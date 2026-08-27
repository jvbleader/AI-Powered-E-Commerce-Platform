"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatVnd } from "@/lib/helpers";
import { Wallet, AlertCircle, ArrowRight, Building2, X, KeyRound } from "lucide-react";
import type { WalletInfo } from "@/services/wallet-api";

interface UserWithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: WalletInfo | null;
  onSubmitWithdraw: (amount: number, pin?: string) => Promise<boolean>;
  onOpenBankSettings: () => void;
}

const PRESET_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000, 5000000];

export function UserWithdrawalModal({
  open,
  onOpenChange,
  wallet,
  onSubmitWithdraw,
  onOpenBankSettings,
}: UserWithdrawalModalProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [amountStr, setAmountStr] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setAmountStr("");
      setPin("");
      setErrorMsg("");
    }
  }, [open]);

  if (!mounted || !open || typeof document === "undefined") return null;

  const availableBalance = Number(wallet?.balance || 0);
  const bankInfo = wallet?.bank_info;
  const hasBankInfo = Boolean(bankInfo?.bank_name && bankInfo?.bank_account_number && bankInfo?.bank_account_name);
  const hasPin = Boolean(wallet?.has_pin);

  const amountNum = parseFloat(amountStr.replace(/[^0-9]/g, "")) || 0;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, "");
    if (!rawVal) {
      setAmountStr("");
      setErrorMsg("");
      return;
    }
    const num = parseInt(rawVal, 10);
    setAmountStr(num.toLocaleString("vi-VN"));

    if (num < 50000) {
      setErrorMsg("Số tiền rút tối thiểu là 50.000 VNĐ");
    } else if (num > 10000000) {
      setErrorMsg("Số tiền rút tối đa mỗi lần là 10.000.000 VNĐ");
    } else if (num > availableBalance) {
      setErrorMsg(`Số tiền vượt quá số dư khả dụng (${formatVnd(availableBalance)})`);
    } else {
      setErrorMsg("");
    }
  };

  const handleSelectPreset = (preset: number) => {
    const val = Math.min(preset, availableBalance);
    setAmountStr(val.toLocaleString("vi-VN"));
    if (val < 50000) {
      setErrorMsg("Số tiền rút tối thiểu là 50.000 VNĐ");
    } else if (val > 10000000) {
      setErrorMsg("Số tiền rút tối đa mỗi lần là 10.000.000 VNĐ");
    } else {
      setErrorMsg("");
    }
  };

  const handleSelectMax = () => {
    const capped = Math.min(Math.floor(availableBalance), 10000000);
    setAmountStr(capped.toLocaleString("vi-VN"));
    if (availableBalance < 50000) {
      setErrorMsg("Số dư khả dụng chưa đủ hạn mức tối thiểu 50.000 VNĐ");
    } else {
      setErrorMsg("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasBankInfo) {
      setErrorMsg("Vui lòng thiết lập tài khoản ngân hàng nhận tiền trước.");
      return;
    }
    if (amountNum < 50000) {
      setErrorMsg("Số tiền rút tối thiểu là 50.000 VNĐ");
      return;
    }
    if (amountNum > 10000000) {
      setErrorMsg("Số tiền rút tối đa mỗi lần là 10.000.000 VNĐ");
      return;
    }
    if (amountNum > availableBalance) {
      setErrorMsg("Số dư khả dụng không đủ.");
      return;
    }
    if (hasPin && !/^\d{6}$/.test(pin)) {
      setErrorMsg("Vui lòng nhập mã PIN ví gồm đúng 6 chữ số.");
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onSubmitWithdraw(amountNum, hasPin ? pin : undefined);
      if (ok) {
        setAmountStr("");
        setPin("");
        setErrorMsg("");
        onOpenChange(false);
      }
    } catch (err: any) {
      setPin("");
      setErrorMsg(err?.message || "Rút tiền thất bại. Vui lòng kiểm tra lại thông tin.");
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <Wallet className="h-4 w-4" />
          </div>
          <h3 className="text-base font-bold text-ink">Rút tiền từ Ví người dùng</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Balance display */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-800 font-medium">Số dư khả dụng</p>
              <p className="text-xl font-extrabold text-emerald-700 mt-0.5">{formatVnd(availableBalance)}</p>
            </div>
            <button
              type="button"
              onClick={handleSelectMax}
              className="text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-100/60 border border-emerald-300 px-2.5 py-1 rounded-lg transition-colors"
            >
              Rút tất cả
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Số tiền muốn rút (VNĐ)</label>
            <div className="relative">
              <Input
                type="text"
                value={amountStr}
                onChange={handleAmountChange}
                placeholder="Nhập số tiền (tối thiểu 50.000đ)"
                className="text-base font-bold pl-4 pr-12 h-11 border-line focus-visible:ring-emerald-500"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                VNĐ
              </span>
            </div>
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleSelectPreset(amt)}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-lg transition-colors"
              >
                {formatVnd(amt)}
              </button>
            ))}
          </div>

          {/* Target Bank Account Box */}
          <div className="border border-line rounded-xl p-3.5 bg-slate-50/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                Tài khoản nhận tiền:
              </span>
              <button
                type="button"
                onClick={onOpenBankSettings}
                className="text-primary hover:underline text-[11px] font-semibold"
              >
                {hasBankInfo ? "Thay đổi" : "Thêm tài khoản"}
              </button>
            </div>

            {hasBankInfo ? (
              <div className="space-y-1 text-xs bg-white p-2.5 rounded-lg border border-line/70">
                <div className="flex items-center justify-between font-bold text-ink">
                  <span>{bankInfo?.bank_name}</span>
                  <span className="font-mono text-emerald-700">{bankInfo?.bank_account_number}</span>
                </div>
                <p className="text-[11px] text-muted uppercase font-medium">{bankInfo?.bank_account_name}</p>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Chưa có thông tin ngân hàng</p>
                  <p className="text-[11px] mt-0.5">Vui lòng cập nhật số tài khoản ngân hàng để thực hiện rút tiền.</p>
                </div>
              </div>
            )}
          </div>

          {/* PIN Input (if wallet has PIN set) */}
          {hasPin && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                Mã PIN ví (6 chữ số)
              </label>
              <Input
                type="password"
                maxLength={6}
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Nhập 6 số PIN xác thực..."
                className="text-base font-mono tracking-widest text-center h-10 border-line focus-visible:ring-emerald-500"
              />
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {errorMsg}
            </p>
          )}

          {/* Transaction terms note */}
          <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-line/60">
            <div className="flex justify-between">
              <span>Phí xử lý giao dịch:</span>
              <span className="font-bold text-emerald-600">0 VNĐ (Miễn phí)</span>
            </div>
            <div className="flex justify-between">
              <span>Thời gian nhận tiền:</span>
              <span className="font-semibold text-slate-700">Tức thì qua Napas 24/7 (Mô phỏng)</span>
            </div>
          </div>

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
              disabled={
                submitting ||
                !hasBankInfo ||
                amountNum < 50000 ||
                amountNum > 10000000 ||
                amountNum > availableBalance ||
                (hasPin && pin.length !== 6)
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 h-9 text-xs font-bold"
            >
              {submitting ? "Đang xử lý..." : "Xác nhận rút tiền"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
