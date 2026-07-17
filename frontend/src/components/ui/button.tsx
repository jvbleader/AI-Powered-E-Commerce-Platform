"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "amber";

export function Button({
  variant = "primary",
  className,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-panel border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "border-primary bg-primary text-white hover:bg-[#085a42]",
        variant === "secondary" && "border-line bg-white text-ink hover:border-primary/40 hover:text-primary",
        variant === "ghost" && "border-transparent bg-transparent text-muted hover:bg-white hover:text-ink",
        variant === "danger" && "border-coral bg-coral text-white hover:bg-[#cf453c]",
        variant === "amber" && "border-amber bg-amber text-ink hover:bg-[#e4961d]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  className,
  children,
  type = "button",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-panel border border-line bg-white text-ink transition hover:border-primary/50 hover:text-primary disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
