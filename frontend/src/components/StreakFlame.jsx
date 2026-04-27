import React from "react";
import { Flame } from "@phosphor-icons/react";

export default function StreakFlame({ streak = 0, size = 18, className = "" }) {
  const hot = streak >= 7;
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} aria-label={`${streak}-day streak`}>
      {hot && (
        <>
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-orange-400/40" />
          <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-amber-300 to-rose-400 blur-sm opacity-70" />
        </>
      )}
      <Flame
        weight={hot ? "fill" : "duotone"}
        size={size}
        className={hot ? "text-orange-500 drop-shadow-[0_0_4px_rgba(251,146,60,0.7)]" : "text-orange-500"}
      />
    </span>
  );
}
