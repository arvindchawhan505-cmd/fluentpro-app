import React, { useState } from "react";
import { Sparkle, Copy, Check, NotePencil } from "@phosphor-icons/react";

/**
 * Coaching correction card shown beneath Coach Ada's reply whenever the
 * learner's last message had a grammar / punctuation mistake.
 *
 * Props: correction = { original, corrected, explanation, better }
 */
export default function CorrectionCard({ correction, testId }) {
  const [copied, setCopied] = useState(false);

  if (!correction) return null;
  const { original, corrected, explanation, better } = correction;

  const copyBetter = async () => {
    if (!better) return;
    try {
      await navigator.clipboard.writeText(better);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  };

  return (
    <div className="w-full max-w-[90%] space-y-2" data-testid={testId}>
      {/* Correction panel */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
          <NotePencil weight="fill" size={12} /> Small fix
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="rounded-md bg-white px-1.5 py-0.5 text-rose-600 line-through shadow-sm">{original}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="rounded-md bg-white px-1.5 py-0.5 font-bold text-emerald-700 shadow-sm">{corrected}</span>
          </div>
        </div>
        {explanation && (
          <div className="mt-2 text-xs font-medium text-amber-900">
            💡 {explanation}
          </div>
        )}
      </div>

      {/* Better way panel */}
      {better && better !== corrected && (
        <div className="flex items-start gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm">
          <Sparkle weight="fill" size={16} className="mt-0.5 shrink-0 text-indigo-500" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Better way to say it</div>
              <button
                onClick={copyBetter}
                data-testid={`${testId}-copy`}
                aria-label={copied ? "Copied" : "Copy better sentence"}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 shadow-sm hover:text-indigo-800"
              >
                {copied ? <><Check weight="bold" size={11} /> Copied</> : <><Copy weight="bold" size={11} /> Copy</>}
              </button>
            </div>
            <div className="mt-1 font-bold text-indigo-900">{better}</div>
          </div>
        </div>
      )}
    </div>
  );
}
