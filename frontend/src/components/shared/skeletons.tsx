"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const navPulse = "animate-pulse rounded bg-white/50";
const navPulseSoft = "animate-pulse rounded bg-white/40";
const topPulse = "animate-pulse rounded bg-slate-400/35";

/** Mirrors MarketplaceHeader DOM/classes so height matches 1:1 */
export function MarketplaceHeaderSkeleton() {
  const headerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const syncHeaderOffset = () => {
      document.documentElement.style.setProperty(
        "--marketplace-header-offset",
        `${header.offsetHeight}px`
      );
    };

    syncHeaderOffset();
    const observer = new ResizeObserver(syncHeaderOffset);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-50 w-full pointer-events-none isolate"
      aria-hidden="true"
    >
      <div className="w-full nav-glass-header pointer-events-auto">
      <div className="w-full shrink-0 px-4 py-1.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            <div className="flex shrink-0 items-center gap-1">
              <div className={cn("h-3.5 w-3.5", topPulse)} />
              <div className={cn("h-2.5 w-24", topPulse)} />
            </div>
            <div className={cn("h-2.5 w-28", topPulse)} />
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className={cn("h-3.5 w-3.5", topPulse)} />
              <div className={cn("h-2.5 w-32", topPulse)} />
            </div>
            <div className="hidden items-center gap-1.5 md:flex">
              <div className={cn("h-3 w-3", topPulse)} />
              <div className={cn("h-2.5 w-28", topPulse)} />
            </div>
            <div className="hidden items-center gap-1 md:flex">
              <div className={cn("h-3 w-3", topPulse)} />
              <div className={cn("h-2.5 w-12", topPulse)} />
            </div>
          </div>
        </div>
      </div>

        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-2.5">
          <div className="flex items-center justify-between gap-2.5 sm:gap-4 md:gap-6">
            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              <div className={cn("h-10 w-10 shrink-0 rounded-2xl", navPulse)} />
              <div className="hidden flex-col items-center justify-center sm:flex">
                <div className={cn("h-[26px] w-[88px] sm:w-[96px]", navPulse)} />
                <div className="mt-0.5 max-h-4 overflow-hidden">
                  <div className={cn("h-[10px] w-[72px]", navPulseSoft)} />
                </div>
              </div>
            </div>

            <div className="relative flex min-w-0 flex-1 items-center justify-center px-1 sm:px-2">
              <div className={cn("h-10 w-full max-w-xl rounded-2xl lg:max-w-2xl", navPulse)} />
            </div>

            <div className="hidden shrink-0 items-center gap-1 lg:flex">
              <div className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2">
                <div className={cn("h-4 w-4", navPulse)} />
                <div className={cn("h-3 w-16", navPulseSoft)} />
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2">
                <div className={cn("h-4 w-4", navPulse)} />
                <div className={cn("h-3 w-14", navPulseSoft)} />
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/30 px-2.5 py-1.5">
                <div className={cn("h-6 w-6 shrink-0 rounded-lg", navPulse)} />
                <div className={cn("h-3 w-12", navPulseSoft)} />
                <div className={cn("h-3.5 w-3.5", navPulseSoft)} />
              </div>
            </div>
          </div>

          <div className="hidden items-center justify-center gap-1.5 px-3 py-[10px] lg:flex">
            <span className="inline-flex shrink-0 items-center px-2 py-0.5">
              <span className={cn("block h-[11px] w-24", navPulseSoft)} />
            </span>
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="inline-flex shrink-0 items-center px-2 py-0.5">
                <span className={cn("block h-[11px] w-14", navPulseSoft)} />
              </span>
            ))}
            <span className="inline-flex shrink-0 items-center gap-0.5 px-2 py-0.5">
              <span className={cn("block h-[11px] w-14", navPulseSoft)} />
              <span className={cn("block h-3 w-3", navPulseSoft)} />
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm",
        className
      )}
    >
      <div className="block">
        {/* Image Skeleton */}
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          <div className="h-full w-full bg-slate-200 animate-pulse" />
        </div>
        
        {/* Content Skeleton */}
        <div className="space-y-3 p-3">
          {/* Title */}
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-slate-200 animate-pulse" />
            <div className="h-4 w-4/5 rounded bg-slate-200 animate-pulse" />
          </div>

          {/* Shop name */}
          <div className="flex items-center gap-1.5 pt-1">
            <div className="h-3 w-3 rounded-full bg-slate-200 animate-pulse" />
            <div className="h-3 w-2/5 rounded bg-slate-200 animate-pulse" />
          </div>

          {/* Price */}
          <div className="pt-1">
            <div className="h-5 w-2/3 rounded bg-slate-200 animate-pulse" />
          </div>

          {/* Rating & Sold count */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-2">
            <div className="h-3 w-20 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-16 rounded bg-slate-200 animate-pulse" />
          </div>
        </div>
      </div>
      
      {/* Button Skeleton */}
      <div className="border-t border-slate-100 p-3 bg-slate-50/50">
        <div className="h-9 w-full rounded-md bg-slate-200 animate-pulse" />
      </div>
    </article>
  );
}

export function ProductGridSkeleton({ count = 30 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
