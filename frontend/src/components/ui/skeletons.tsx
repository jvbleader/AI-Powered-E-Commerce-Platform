import { Skeleton } from "./feedback";

export function ProductCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div className="space-y-2 p-2.5">
        <div className="space-y-1.5 min-h-10">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-3 w-2/5" />
        </div>
        <div className="flex items-baseline gap-1 py-0.5">
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="border-t border-slate-100 p-3 bg-slate-50/50">
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </article>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center space-x-4 py-3 border-b border-line">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  );
}

export function CyberProductCardSkeleton() {
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4">
      <div>
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100">
          <Skeleton className="h-full w-full rounded-none" />
        </div>
        <div className="mt-3">
          <Skeleton className="h-[16px] w-20 mb-1" />
          <Skeleton className="h-[20px] w-full" />
          <div className="mt-1.5 flex items-center justify-between gap-1">
            <Skeleton className="h-[20px] w-24" />
            <Skeleton className="h-[16px] w-16" />
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <Skeleton className="h-[16px] w-16 mb-1" />
        <Skeleton className="h-[28px] w-2/3" />
      </div>
    </div>
  );
}

export function CyberProductGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <CyberProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HeroSpotlightSkeleton() {
  return (
    <div className="my-4 space-y-4">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div>
        <Skeleton className="h-3.5 w-32 mb-1.5" />
        <Skeleton className="h-7 w-[85%]" />
        <div className="mt-2 flex flex-col gap-1.5">
          <Skeleton className="h-8 w-[140px]" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-[110px]" />
            <Skeleton className="h-3.5 w-[80px]" />
          </div>
        </div>
      </div>
      <Skeleton className="h-[40px] w-full rounded-xl" />
    </div>
  );
}
export function ShopCardSkeleton() {
  return (
    <div className="bento-card rounded-2xl p-5 flex items-center justify-between bg-white/90 border-slate-200/80">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-[28px] w-[70px] rounded-xl" />
    </div>
  );
}
