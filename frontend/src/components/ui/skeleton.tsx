import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/60", className)}
      {...props}
    />
  )
}

export function TableSkeleton({ headers, rows = 5 }: { headers?: React.ReactNode[] | number; rows?: number }) {
  const colCount = typeof headers === 'number' ? headers : headers?.length || 4;
  return (
    <div className="flex-1 overflow-auto rounded-panel border border-line bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
          <tr>
            {Array.isArray(headers) ? headers.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-4 font-bold bg-slate-50">{h}</th>
            )) : Array.from({ length: colCount }).map((_, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-4 font-bold bg-slate-50">
                <Skeleton className="h-4 w-[100px]" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-line last:border-b-0">
              {Array.from({ length: colCount }).map((_, cellIndex) => (
                <td key={cellIndex} className="px-3 py-3 align-middle">
                  <Skeleton className={cn("h-4", cellIndex === 0 ? "w-3/4" : cellIndex === colCount - 1 ? "w-1/2" : "w-full max-w-[150px]")} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { Skeleton }
