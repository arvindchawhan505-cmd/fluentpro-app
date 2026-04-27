import React from "react";

export default function Logo({ size = 36, withText = true, textClassName = "" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src="/logo.png"
        alt="FluentPro"
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
      {withText && (
        <span
          className={`font-extrabold tracking-tight ${textClassName}`}
          style={{ fontFamily: "Nunito, sans-serif" }}
        >
          <span className="text-slate-900">Fluent</span>
          <span className="bg-gradient-to-r from-blue-500 to-violet-600 bg-clip-text text-transparent">Pro</span>
        </span>
      )}
    </span>
  );
}
