import React from "react";
import { Crown } from "@phosphor-icons/react";

export default function LevelBadge({ levelInfo, size = "md" }) {
  if (!levelInfo) return null;
  const { level_number, level_name, level_emoji, next_threshold, next_name, progress_pct } = levelInfo;
  const sizes = {
    sm: { badge: "h-9 w-9 text-base", text: "text-xs" },
    md: { badge: "h-12 w-12 text-xl", text: "text-sm" },
    lg: { badge: "h-16 w-16 text-2xl", text: "text-base" },
  }[size] || { badge: "h-12 w-12 text-xl", text: "text-sm" };

  return (
    <div className="flex items-center gap-3" data-testid="level-badge">
      <div className={`relative flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 ${sizes.badge} font-extrabold text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]`}>
        <span aria-hidden>{level_emoji}</span>
        <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-[10px] font-extrabold text-white">
          {level_number}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={`font-extrabold text-slate-900 ${sizes.text}`}>
          Lvl {level_number} · {level_name}
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${progress_pct}%` }} />
        </div>
        {next_name && (
          <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {progress_pct}% to {next_name} {levelInfo.next_emoji}
          </div>
        )}
      </div>
    </div>
  );
}
