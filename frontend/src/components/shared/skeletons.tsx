"use client";

import { cn } from "@/lib/utils";

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

export function ProductGridSkeleton({ count = 20 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
