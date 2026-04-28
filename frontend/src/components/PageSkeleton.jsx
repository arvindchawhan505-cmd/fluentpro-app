import React from "react";

/**
 * Lightweight skeleton shown while a lazy-loaded route chunk is downloading.
 * Matches the AppShell layout so there's no jarring reflow when the page paints.
 */
export default function PageSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="page-skeleton">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
      <div className="h-4 w-72 max-w-full animate-pulse rounded-lg bg-slate-100" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl border-2 border-slate-100 bg-slate-50" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-3xl border-2 border-slate-100 bg-slate-50" />
    </div>
  );
}
