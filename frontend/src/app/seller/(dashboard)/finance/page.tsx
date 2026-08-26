"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  Building2,
  CreditCard,
  User,
  RefreshCcw,
  DollarSign,
  Download,
  Filter,
  ReceiptText,
  ChevronRight,
  ChevronDown,
  Check,
  AlertCircle,
  HelpCircle,
  X,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { formatVnd, formatDate } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";
import type {
  SellerWalletData,
  SellerWalletTransactionData,
  SellerPayoutData,
  BankAccountPayload
} from "@/store/slices/types";
import { WithdrawalModal } from "@/components/seller/finance/WithdrawalModal";
import { BankAccountModal } from "@/components/seller/finance/BankAccountModal";
import { TransactionDetailModal } from "@/components/seller/finance/TransactionDetailModal";
import { cn } from "@/lib/utils";

type DatePreset = "ALL" | "7DAYS" | "30DAYS" | "YEAR";

export default function SellerFinancePage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const { showToast } = store;

  // Local states
  const [wallet, setWallet] = useState<SellerWalletData | null>(null);
  const [transactions, setTransactions] = useState<SellerWalletTransactionData[]>([]);
  const [txTotal, setTxTotal] = useState<number>(0);
  const [payouts, setPayouts] = useState<SellerPayoutData[]>([]);
  const [payoutsTotal, setPayoutsTotal] = useState<number>(0);

  const [loadingWallet, setLoadingWallet] = useState<boolean>(true);
  const [loadingTx, setLoadingTx] = useState<boolean>(false);
  const [loadingPayouts, setLoadingPayouts] = useState<boolean>(false);

  // Tab & Filters
  const [activeTab, setActiveTab] = useState<"TRANSACTIONS" | "PAYOUTS">("TRANSACTIONS");
  const [txTypeFilter, setTxTypeFilter] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("30DAYS");
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [yearDropdownOpen, setYearDropdownOpen] = useState<boolean>(false);
  const availableYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  const [page, setPage] = useState<number>(1);
  const limit = 15;

  // Modals
  const [withdrawModalOpen, setWithdrawModalOpen] = useState<boolean>(false);
  const [bankModalOpen, setBankModalOpen] = useState<boolean>(false);
  const [returnToWithdraw, setReturnToWithdraw] = useState<boolean>(false);
  const [selectedTx, setSelectedTx] = useState<SellerWalletTransactionData | null>(null);
  const [pendingInfoOpen, setPendingInfoOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch Wallet Summary
  const loadWallet = async () => {
    setLoadingWallet(true);
    try {
      const res = await store.fetchSellerWallet();
      if (res.ok && res.wallet) {
        setWallet(res.wallet);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi khi tải thông tin ví", "danger");
    } finally {
      setLoadingWallet(false);
    }
  };

  // Compute date filter boundary
  const dateParams = useMemo(() => {
    if (datePreset === "ALL") return { start_date: undefined, end_date: undefined };
    const now = new Date();
    const start = new Date();

    if (datePreset === "7DAYS") {
      start.setDate(now.getDate() - 7);
      return {
        start_date: start.toISOString(),
        end_date: now.toISOString(),
      };
    } else if (datePreset === "30DAYS") {
      start.setDate(now.getDate() - 30);
      return {
        start_date: start.toISOString(),
        end_date: now.toISOString(),
      };
    } else if (datePreset === "YEAR") {
      const startYear = new Date(Date.UTC(selectedYear, 0, 1, 0, 0, 0));
      const endYear = new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999));
      return {
        start_date: startYear.toISOString(),
        end_date: endYear.toISOString(),
      };
    }

    return { start_date: undefined, end_date: undefined };
  }, [datePreset, selectedYear]);

  // Fetch Transactions
  const loadTransactions = async () => {
    setLoadingTx(true);
    try {
      const res = await store.fetchSellerWalletTransactions({
        tx_type: txTypeFilter === "ALL" ? undefined : txTypeFilter,
        start_date: dateParams.start_date,
        end_date: dateParams.end_date,
        page,
        limit,
      });
      if (res.ok && res.items) {
        setTransactions(res.items);
        setTxTotal(res.total || 0);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi khi tải lịch sử giao dịch", "danger");
    } finally {
      setLoadingTx(false);
    }
  };

  // Fetch Payouts
  const loadPayouts = async () => {
    setLoadingPayouts(true);
    try {
      const res = await store.fetchSellerPayouts({ page, limit });
      if (res.ok && res.items) {
        setPayouts(res.items);
        setPayoutsTotal(res.total || 0);
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi khi tải danh sách rút tiền", "danger");
    } finally {
      setLoadingPayouts(false);
    }
  };

  useEffect(() => {
    if (shop?.status === "APPROVED") {
      loadWallet();
      // Pre-fetch actual totals so badges and cards display accurate DB count on initial load
      store.fetchSellerPayouts({ page: 1, limit: 1 }).then((res) => {
        if (res.ok && typeof res.total === "number") {
          setPayoutsTotal(res.total);
        }
      });
      store.fetchSellerWalletTransactions().then((res) => {
        if (res.ok && typeof res.total === "number") {
          setTxTotal(res.total);
        }
      });
    }
  }, [shop?.status]);

  useEffect(() => {
    if (shop?.status === "APPROVED") {
      if (activeTab === "TRANSACTIONS") {
        loadTransactions();
      } else {
        loadPayouts();
      }
    }
  }, [shop?.status, activeTab, txTypeFilter, dateParams, page]);

  // Handlers
  const handleWithdrawSubmit = async (amount: number) => {
    try {
      const res = await store.requestSellerWithdrawal({ amount });
      if (res.ok) {
        showToast(`Rút tiền thành công! Số tiền ${formatVnd(amount)} đã được gửi tới tài khoản ngân hàng.`, "success");
        loadWallet();
        loadTransactions();
        loadPayouts();
        return true;
      } else {
        showToast(res.message || "Yêu cầu rút tiền không thành công.", "danger");
        return false;
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi khi thực hiện rút tiền", "danger");
      return false;
    }
  };

  const handleBankSubmit = async (payload: BankAccountPayload) => {
    try {
      const res = await store.updateSellerBankAccount(payload);
      if (res.ok) {
        showToast("Đã cập nhật thông tin tài khoản ngân hàng thành công!", "success");
        await loadWallet();
        setBankModalOpen(false);
        if (returnToWithdraw) {
          setWithdrawModalOpen(true);
          setReturnToWithdraw(false);
        }
        return true;
      } else {
        showToast(res.message || "Cập nhật ngân hàng thất bại.", "danger");
        return false;
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi khi cập nhật thông tin ngân hàng", "danger");
      return false;
    }
  };

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi truy cập phân hệ Tài chính." />;
  }

  if (!shop) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm font-semibold text-muted">Đang tải thông tin shop...</p>
      </main>
    );
  }

  const bankInfo = wallet?.bank_info;
  const hasBankInfo = Boolean(bankInfo?.bank_name && bankInfo?.bank_account_number && bankInfo?.bank_account_name);

  return (
    <Section title="Quản lý Tài chính & Ví Người Bán" className="space-y-6 pb-12">
      {/* Header Info & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-panel border border-line shadow-xs">
        <div>
          <h2 className="text-base font-bold text-ink flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600" />
            Số dư Ví & Dòng tiền Người bán
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => {
              loadWallet();
              if (activeTab === "TRANSACTIONS") loadTransactions();
              else loadPayouts();
            }}
            className="flex items-center gap-1.5 text-xs h-9 px-3"
            title="Làm mới dữ liệu"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loadingWallet || loadingTx ? "animate-spin" : ""}`} />
            Làm mới
          </Button>

          <Button
            onClick={() => setWithdrawModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 flex items-center gap-1.5 shadow-xs"
          >
            <ArrowUpRight className="h-4 w-4" />
            Rút tiền về ngân hàng
          </Button>
        </div>
      </div>

      {/* 4 KPI Financial Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Available Balance */}
        <Panel className="p-4 relative overflow-hidden bg-white border-emerald-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Số dư khả dụng</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-600">
              {formatVnd(wallet?.available_balance || 0)}
            </p>
          </div>
          <div className="mt-auto pt-2 flex items-center justify-between text-xs text-emerald-900/70 border-t border-emerald-100 font-medium">
            <span>Có thể rút ngay</span>
            <button
              type="button"
              onClick={() => setWithdrawModalOpen(true)}
              className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-0.5"
            >
              Rút tiền <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </Panel>

        {/* Pending Balance */}
        <Panel className="p-4 relative overflow-hidden bg-white border-blue-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Tiền chờ đối soát</p>
                <button
                  type="button"
                  onClick={() => setPendingInfoOpen(true)}
                  className="text-blue-600 hover:text-blue-800 p-0.5 rounded-full hover:bg-blue-100 transition-colors cursor-pointer"
                  title="Bấm để xem chi tiết cách hoạt động của Tiền chờ đối soát"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-blue-600">
              {formatVnd(wallet?.pending_balance || 0)}
            </p>
          </div>
          <div className="mt-auto pt-2 flex items-center text-xs text-blue-900/70 border-t border-blue-100 font-medium">
            <span>Đơn đang xử lý & giao hàng</span>
          </div>
        </Panel>

        {/* Total Withdrawn */}
        <Panel className="p-4 relative overflow-hidden bg-white border-purple-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-purple-800 uppercase tracking-wider">Tổng tiền đã rút</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-purple-700">
              {formatVnd(wallet?.total_withdrawn || 0)}
            </p>
          </div>
          <div className="mt-auto pt-2 flex items-center justify-between text-xs text-purple-900/70 border-t border-purple-100 font-medium">
            <span>Đã chuyển về ngân hàng</span>
            <span className="font-bold text-purple-700">{payoutsTotal} lần rút</span>
          </div>
        </Panel>

        {/* Linked Bank Account Card */}
        <Panel className="p-4 relative overflow-hidden bg-white border-amber-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Tài khoản nhận tiền</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Building2 className="h-4 w-4" />
              </div>
            </div>

            {hasBankInfo ? (
              <div className="mt-2 space-y-0.5">
                <p className="text-sm font-bold text-ink truncate">{bankInfo?.bank_name}</p>
                <p className="text-xs font-mono font-bold text-slate-700">{bankInfo?.bank_account_number}</p>
                <p className="text-[11px] text-muted uppercase font-medium truncate">{bankInfo?.bank_account_name}</p>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-xs font-medium text-amber-700">Chưa liên kết ngân hàng</p>
                <p className="text-[11px] text-muted mt-0.5">Vui lòng thêm tài khoản để rút tiền.</p>
              </div>
            )}
          </div>

          <div className="mt-auto pt-2 border-t border-amber-100 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setReturnToWithdraw(false);
                setBankModalOpen(true);
              }}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
            >
              {hasBankInfo ? "Thay đổi tài khoản" : "+ Thêm ngân hàng"} <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </Panel>
      </div>

      {/* Tabs & Table Panel */}
      <Panel className="p-5 shadow-xs space-y-4">
        {/* Navigation Tabs Header */}
        <div className="flex items-center gap-2 border-b border-line pb-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab("TRANSACTIONS");
              setPage(1);
            }}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
              activeTab === "TRANSACTIONS"
                ? "bg-primary text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-line/60"
            )}
          >
            <ReceiptText className="h-3.5 w-3.5" />
            Lịch sử giao dịch ({txTotal})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("PAYOUTS");
              setPage(1);
            }}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
              activeTab === "PAYOUTS"
                ? "bg-primary text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-line/60"
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            Lịch sử rút tiền ({payoutsTotal})
          </button>
        </div>

        {/* Transaction Filters Toolbar */}
        {activeTab === "TRANSACTIONS" && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-line/60">
            {/* Preset Range */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-muted mr-1">Thời gian:</span>
              
              {/* 7 Days */}
              <button
                type="button"
                onClick={() => {
                  setDatePreset("7DAYS");
                  setPage(1);
                }}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                  datePreset === "7DAYS"
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-line/70"
                )}
              >
                7 ngày qua
              </button>

              {/* 30 Days */}
              <button
                type="button"
                onClick={() => {
                  setDatePreset("30DAYS");
                  setPage(1);
                }}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                  datePreset === "30DAYS"
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-line/70"
                )}
              >
                30 ngày qua
              </button>

              {/* Year Dropdown Filter */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setYearDropdownOpen((prev) => !prev)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                    datePreset === "YEAR"
                      ? "bg-slate-800 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-line/70"
                  )}
                >
                  <span>Năm {selectedYear}</span>
                  <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", yearDropdownOpen && "rotate-180")} />
                </button>

                {yearDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setYearDropdownOpen(false)}
                    />
                    <div className="absolute left-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-line py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                      {availableYears.map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            setSelectedYear(yr);
                            setDatePreset("YEAR");
                            setPage(1);
                            setYearDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center justify-between",
                            selectedYear === yr && datePreset === "YEAR"
                              ? "text-primary font-bold bg-emerald-50/60"
                              : "text-slate-700"
                          )}
                        >
                          <span>Năm {yr}</span>
                          {selectedYear === yr && datePreset === "YEAR" && (
                            <Check className="h-3 w-3 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* All */}
              <button
                type="button"
                onClick={() => {
                  setDatePreset("ALL");
                  setPage(1);
                }}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                  datePreset === "ALL"
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-line/70"
                )}
              >
                Tất cả
              </button>
            </div>

            {/* Transaction Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted whitespace-nowrap">Loại biến động:</span>
              <Select
                value={txTypeFilter}
                onChange={(e) => {
                  setTxTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs w-44"
              >
                <option value="ALL">Tất cả giao dịch</option>
                <option value="ORDER_SETTLEMENT">Cộng tiền đơn hàng</option>
                <option value="WITHDRAWAL">Rút tiền về ngân hàng</option>
              </Select>
            </div>
          </div>
        )}

        {/* TAB 1: LEDGER TRANSACTIONS TABLE */}
        {activeTab === "TRANSACTIONS" && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-line">
                  <tr>
                    <th className="py-3 px-4">Mã GD / Thời gian</th>
                    <th className="py-3 px-4">Loại giao dịch</th>
                    <th className="py-3 px-4">Chi tiết diễn giải</th>
                    <th className="py-3 px-4 text-right">Biến động (VNĐ)</th>
                    <th className="py-3 px-4 text-right">Số dư sau GD</th>
                    <th className="py-3 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70 bg-white">
                  {loadingTx ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted">
                        Đang tải lịch sử giao dịch...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted">
                        Chưa có biến động giao dịch nào trong khoảng thời gian đã chọn.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const isCredit = tx.amount > 0;
                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                          onClick={() => setSelectedTx(tx)}
                        >
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-700">#TXN-{tx.id}</span>
                            <p className="text-[11px] text-muted mt-0.5">{formatDate(tx.created_at)}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            {tx.transaction_type === "ORDER_SETTLEMENT" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <ArrowDownLeft className="h-3 w-3" /> Quyết toán đơn
                              </span>
                            ) : tx.transaction_type === "WITHDRAWAL" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                <ArrowUpRight className="h-3 w-3" /> Rút tiền
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                                {tx.transaction_type}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="font-medium text-ink truncate">{tx.description}</p>
                            {tx.order_code && (
                              <p className="text-[11px] text-primary font-mono mt-0.5 font-bold">
                                {tx.order_code}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`font-bold ${
                                isCredit ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {isCredit ? "+" : ""}{formatVnd(tx.amount)}
                            </span>
                            {tx.gross_amount && (
                              <p className="text-[10px] text-muted mt-0.5">
                                Gốc: {formatVnd(tx.gross_amount)} (-5%)
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                            {formatVnd(tx.balance_after)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTx(tx);
                              }}
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {txTotal > limit && (
              <div className="flex items-center justify-between text-xs text-muted pt-2">
                <span>
                  Hiển thị {(page - 1) * limit + 1} - {Math.min(page * limit, txTotal)} trong tổng số {txTotal} giao dịch
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="h-8 text-xs"
                  >
                    Trang trước
                  </Button>
                  <span className="font-semibold text-ink px-2">Trang {page}</span>
                  <Button
                    variant="secondary"
                    disabled={page * limit >= txTotal}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 text-xs"
                  >
                    Trang sau
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WITHDRAWAL PAYOUTS HISTORY */}
        {activeTab === "PAYOUTS" && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-line">
                  <tr>
                    <th className="py-3 px-4">Mã lệnh rút / Ngày giờ</th>
                    <th className="py-3 px-4 text-right">Số tiền rút</th>
                    <th className="py-3 px-4">Ngân hàng thụ hưởng</th>
                    <th className="py-3 px-4">Ghi chú</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70 bg-white">
                  {loadingPayouts ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted">
                        Đang tải danh sách lệnh rút tiền...
                      </td>
                    </tr>
                  ) : payouts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted">
                        Chưa có lệnh rút tiền nào được tạo.
                      </td>
                    </tr>
                  ) : (
                    payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-800">{p.payout_code || `#WD-${p.id}`}</span>
                          <p className="text-[11px] text-muted mt-0.5">{formatDate(p.created_at)}</p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-rose-600">
                          -{formatVnd(p.amount)}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-ink">{p.bank_name}</p>
                          <p className="text-[11px] font-mono text-slate-600">{p.bank_account_number} • {p.bank_account_name}</p>
                        </td>
                        <td className="py-3.5 px-4 text-muted max-w-xs truncate">
                          {p.note || "Rút tiền về tài khoản ngân hàng"}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> Thành công
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {payoutsTotal > limit && (
              <div className="flex items-center justify-between text-xs text-muted pt-2">
                <span>
                  Hiển thị {(page - 1) * limit + 1} - {Math.min(page * limit, payoutsTotal)} trong {payoutsTotal} lệnh rút
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="h-8 text-xs"
                  >
                    Trang trước
                  </Button>
                  <span className="font-semibold text-ink px-2">Trang {page}</span>
                  <Button
                    variant="secondary"
                    disabled={page * limit >= payoutsTotal}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 text-xs"
                  >
                    Trang sau
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Modals */}
      <WithdrawalModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        wallet={wallet}
        onSubmitWithdraw={handleWithdrawSubmit}
        onOpenBankSettings={() => {
          setReturnToWithdraw(true);
          setWithdrawModalOpen(false);
          setBankModalOpen(true);
        }}
      />

      <BankAccountModal
        open={bankModalOpen}
        onOpenChange={(open) => {
          setBankModalOpen(open);
          if (!open && returnToWithdraw) {
            setWithdrawModalOpen(true);
            setReturnToWithdraw(false);
          }
        }}
        initialBankInfo={wallet?.bank_info}
        onSubmit={handleBankSubmit}
      />

      <TransactionDetailModal
        open={Boolean(selectedTx)}
        onOpenChange={(open) => !open && setSelectedTx(null)}
        transaction={selectedTx}
        bankInfo={wallet?.bank_info}
      />

      {/* Pending Info Explanation Modal */}
      {mounted && pendingInfoOpen && typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setPendingInfoOpen(false);
            }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          >
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-line p-5 relative space-y-4">
              <button
                type="button"
                onClick={() => setPendingInfoOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-ink transition-colors p-1"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <h3 className="text-base font-bold text-ink">Tiền chờ đối soát</h3>
                <p className="text-xs text-muted mt-0.5">Khoản tiền thanh toán từ các đơn hàng chưa hoàn tất</p>
              </div>

              <div className="text-xs text-slate-600 space-y-3">
                <p className="leading-relaxed">
                  Là doanh thu tạm tính từ các đơn hàng đang được xử lý, đang giao hoặc đang trong thời gian chờ người mua kiểm tra hàng. Khoản tiền này được hệ thống tạm giữ để đảm bảo an toàn giao dịch.
                </p>

                <div className="bg-slate-50 rounded-lg p-3 border border-line space-y-2 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-slate-800">Doanh thu ghi nhận:</span>
                    <span className="text-slate-600">
                      Bằng <strong>95% giá trị tiền hàng</strong> (đã trừ 2% phí thanh toán và 3% phí hoa hồng sàn). Không bao gồm phí vận chuyển.
                    </span>
                  </div>

                  <div className="border-t border-line/60 pt-2 flex flex-col gap-0.5">
                    <span className="font-semibold text-slate-800">Thời gian tiền vào ví:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                      <li>Ngay khi người mua bấm <strong>Đã nhận hàng</strong>.</li>
                      <li>Hoặc tự động sau <strong>7 ngày</strong> kể từ khi giao hàng thành công (nếu không có khiếu nại trả hàng).</li>
                    </ul>
                  </div>
                </div>

                <p className="text-[11px] text-muted">
                  Khi đơn hàng hoàn tất, tiền sẽ được cộng ngay vào <strong>Số dư khả dụng</strong> để bạn có thể rút về tài khoản ngân hàng.
                </p>
              </div>

              <div className="pt-2 border-t border-line flex justify-end">
                <Button
                  type="button"
                  onClick={() => setPendingInfoOpen(false)}
                  className="bg-primary hover:bg-primary-dark text-white h-8 text-xs px-5 font-semibold rounded-lg"
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </Section>
  );
}
