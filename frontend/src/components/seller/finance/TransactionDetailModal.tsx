"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { formatVnd, formatDate } from "@/lib/helpers";
import { ReceiptText, ArrowUpRight, ArrowDownLeft, Percent, ChevronRight, X, Building2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { SellerWalletTransactionData } from "@/store/slices/types";

interface TransactionDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: SellerWalletTransactionData | null;
  bankInfo?: {
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_account_name?: string | null;
  } | null;
}

export function TransactionDetailModal({
  open,
  onOpenChange,
  transaction,
  bankInfo,
}: TransactionDetailModalProps) {
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open || !transaction || typeof document === "undefined") return null;

  const isCredit = transaction.amount > 0;
  const isOrderSettlement = transaction.transaction_type === "ORDER_SETTLEMENT";
  const isWithdrawal = transaction.transaction_type === "WITHDRAWAL";

  const getCleanBankDisplay = () => {
    let clean = transaction.description
      .replace(/^Rút tiền (từ ví )?về\s*/i, "")
      .replace(/\s*-\s*Mã lệnh:.*$/i, "")
      .trim();

    if (bankInfo?.bank_account_name) {
      const name = bankInfo.bank_account_name.trim().toUpperCase();
      if (clean && !clean.toUpperCase().includes(name)) {
        return `${clean} • ${name}`;
      }
    }
    return clean || "Tài khoản ngân hàng liên kết";
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-line p-6 relative space-y-4">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 text-slate-400 hover:text-ink transition-colors p-1"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <ReceiptText className="h-4 w-4" />
          </div>
          <h3 className="text-base font-bold text-ink">Chi tiết biến động số dư</h3>
        </div>

        {/* Big Amount Summary Box */}
        <div className={`p-4 rounded-xl border text-center ${
          isCredit
            ? "bg-emerald-50/60 border-emerald-200"
            : "bg-rose-50/60 border-rose-200"
        }`}>
          <div className="flex items-center justify-center gap-1 text-xs font-semibold mb-1">
            {isCredit ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <ArrowDownLeft className="h-4 w-4" /> Nhận tiền vào ví
              </span>
            ) : (
              <span className="text-rose-700 flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4" /> Rút tiền
              </span>
            )}
          </div>
          <p className={`text-2xl font-black ${isCredit ? "text-emerald-700" : "text-rose-700"}`}>
            {isCredit ? "+" : ""}{formatVnd(transaction.amount)}
          </p>
          <p className="text-xs text-muted mt-1">{formatDate(transaction.created_at)}</p>
        </div>

        {/* Transaction Meta Details */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-line/70 space-y-2.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted">Loại giao dịch:</span>
            <span className="font-semibold text-ink">
              {isOrderSettlement ? "Quyết toán đơn hàng" : isWithdrawal ? "Rút tiền về ngân hàng" : transaction.transaction_type}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted">Mã giao dịch:</span>
            <span className="font-mono font-semibold text-slate-700">#TXN-{transaction.id}</span>
          </div>

          {transaction.order_code && (
            <div className="flex justify-between items-center">
              <span className="text-muted">Mã đơn hàng liên quan:</span>
              <Link
                href={`/seller/orders/${transaction.order_code}`}
                className="font-mono font-bold text-primary hover:underline flex items-center gap-0.5 group"
                title="Bấm để xem chi tiết đơn hàng"
              >
                <span>{transaction.order_code}</span>
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}

          {transaction.payout_code && (
            <div className="flex justify-between items-center">
              <span className="text-muted">Mã lệnh rút tiền:</span>
              <span className="font-mono font-bold text-slate-800">{transaction.payout_code}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-line/60">
            <span className="text-muted">Số dư trước GD:</span>
            <span className="font-semibold text-slate-600">{formatVnd(transaction.balance_before)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted font-medium">Số dư sau GD:</span>
            <span className="font-bold text-ink">{formatVnd(transaction.balance_after)}</span>
          </div>
        </div>

        {/* Withdrawal Target Bank Information (if WITHDRAWAL) */}
        {isWithdrawal && (
          <div className="border border-line rounded-xl p-3.5 bg-white space-y-2 text-xs">
            <p className="font-bold text-ink flex items-center gap-1.5 pb-2 border-b border-line/60">
              <Building2 className="h-3.5 w-3.5 text-sky" />
              Thông tin nhận tiền
            </p>

            <div className="space-y-1.5 text-slate-700">
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted shrink-0">Tài khoản thụ hưởng:</span>
                <span className="font-semibold text-slate-800 text-right truncate">
                  {getCleanBankDisplay()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Phương thức:</span>
                <span className="font-medium text-slate-700">Chuyển khoản nhanh Napas 24/7</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Phí xử lý:</span>
                <span className="font-semibold text-emerald-600">0 VNĐ (Miễn phí)</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-line/50">
                <span className="text-muted">Trạng thái chuyển khoản:</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Thành công
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Order Breakdown Calculation Table (if ORDER_SETTLEMENT) */}
        {isOrderSettlement && transaction.gross_amount && (
          <div className="border border-line rounded-xl p-3.5 bg-white space-y-2 text-xs">
            <p className="font-bold text-ink flex items-center gap-1.5 pb-2 border-b border-line/60">
              <Percent className="h-3.5 w-3.5 text-emerald-600" />
              Doanh thu & các khoản phí
            </p>

            <div className="flex justify-between text-slate-700">
              <span>Tổng tiền hàng sản phẩm:</span>
              <span className="font-semibold">{formatVnd(transaction.gross_amount)}</span>
            </div>

            <div className="flex justify-between text-rose-600">
              <span className="flex items-center gap-1">
                <span>Phí thanh toán (2.0%):</span>
              </span>
              <span className="font-semibold">-{formatVnd(transaction.payment_fee || 0)}</span>
            </div>

            <div className="flex justify-between text-rose-600">
              <span className="flex items-center gap-1">
                <span>Phí hoa hồng sàn (3.0%):</span>
              </span>
              <span className="font-semibold">-{formatVnd(transaction.commission_fee || 0)}</span>
            </div>

            <div className="flex justify-between pt-2 border-t border-line/60 font-bold text-emerald-700">
              <span>Thực nhận vào ví (95%):</span>
              <span className="text-sm">+{formatVnd(transaction.amount)}</span>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-line/60 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-9 text-xs"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
