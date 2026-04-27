import React from "react";

export default function Logo({ size = 36, withText = true, textClassName = "" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 55%, #A855F7 100%)",
        }}
        aria-hidden="true"
      >
        <img src="/logo.svg" alt="" className="h-full w-full object-contain" />
      </span>
      {withText && (
        <span
          className={`bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text font-extrabold tracking-tight text-transparent ${textClassName}`}
          style={{ fontFamily: "Nunito, sans-serif" }}
        >
          FluentPro
        </span>
      )}
    </span>
  );
}
