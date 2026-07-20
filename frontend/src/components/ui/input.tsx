"use client";

import type { ComponentProps, ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-panel border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70 transition focus:border-primary",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-y rounded-panel border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 transition focus:border-primary",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-panel border border-line bg-white px-3 text-sm text-ink transition focus:border-primary",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: ComponentProps<"input"> & { label?: ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm text-ink", className)}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-line accent-primary"
        {...props}
      />
      {label}
    </label>
  );
}

export function Radio({
  label,
  className,
  ...props
}: ComponentProps<"input"> & { label?: ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm text-ink", className)}>
      <input
        type="radio"
        className="h-4 w-4 border-line accent-primary"
        {...props}
      />
      {label}
    </label>
  );
}

export function Label({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <label className={cn("mb-1.5 block text-sm font-semibold text-ink", className)}>{children}</label>;
}

export function Field({
  label,
  children,
  hint
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  onFocus,
  onBlur,
  inputRef,
  placeholder = "Tìm kiếm sản phẩm, shop, thương hiệu...",
  className
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative group w-full", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-450 group-focus-within:text-emerald-600 transition-colors" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400/80 transition-all duration-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 shadow-2xs"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Xóa tìm kiếm"
        >
          <span className="sr-only">Xóa</span>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

