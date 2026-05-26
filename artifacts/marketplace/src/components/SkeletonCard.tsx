export function SkeletonCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-white/5">
      <div className="relative aspect-square w-full bg-white/5 animate-pulse" />
      <div className={`${compact ? "p-3" : "p-4"} space-y-2`}>
        <div className={`bg-white/5 rounded animate-pulse ${compact ? "h-3.5" : "h-4"}`} />
        <div className="flex items-center justify-between">
          <div className="bg-white/5 rounded animate-pulse w-12 h-2.5" />
          <div className="bg-white/5 rounded animate-pulse w-10 h-3" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shrink-0 w-[72px] h-[72px] rounded-2xl bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}
