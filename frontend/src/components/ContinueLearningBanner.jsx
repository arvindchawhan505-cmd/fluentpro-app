import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X, Sparkle } from "@phosphor-icons/react";
import { api } from "@/lib/api";

const ICON_FALLBACK = Sparkle;

/**
 * Compact sticky "Next up" nudge shown after the user completes activity on any
 * practice page. Pulls the next incomplete task from the Daily Path so the user
 * flows from one activity to the next without bouncing back to the dashboard.
 *
 * Props:
 *   - currentPath: string, e.g. "/conversation" — used to avoid linking to self.
 *   - trigger: any — changing value re-fetches state (e.g. an action counter).
 *   - variant: "floating" (default) | "inline"
 */
export default function ContinueLearningBanner({ currentPath, trigger = 0, variant = "floating" }) {
  const [state, setState] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/daily-path");
        if (!cancelled) setState(data);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [trigger]);

  if (dismissed || !state) return null;

  // Find next incomplete task that isn't the current page
  const next = state.tasks.find((t) => !t.done && t.to !== currentPath);
  const allDone = state.completed;

  if (!next && !allDone) return null;

  const content = allDone ? (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Daily path complete</div>
        <div className="truncate text-sm font-extrabold text-slate-900">Tap to claim +{state.reward_xp} XP 🎉</div>
      </div>
      <Link
        to="/dashboard"
        data-testid="continue-banner-claim-link"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-b-4 border-emerald-700 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white active:translate-y-0.5 active:border-b-0"
      >
        Claim <ArrowRight weight="bold" size={14} />
      </Link>
    </div>
  ) : (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Next up · {state.tasks_done}/{state.tasks_total}</div>
        <div className="truncate text-sm font-extrabold text-slate-900">{next.title}</div>
      </div>
      <Link
        to={next.to}
        data-testid={`continue-banner-next-${next.key}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-b-4 border-emerald-700 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white active:translate-y-0.5 active:border-b-0"
      >
        Continue <ArrowRight weight="bold" size={14} />
      </Link>
    </div>
  );

  if (variant === "inline") {
    return (
      <div data-testid="continue-banner-inline" className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-3">
        {content}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key="cl-banner"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        data-testid="continue-learning-banner"
        className="fixed bottom-[72px] left-1/2 z-30 w-[min(520px,calc(100vw-24px))] -translate-x-1/2 md:bottom-6"
      >
        <div className="flex items-center gap-2 rounded-2xl border-2 border-emerald-200 bg-white/95 p-3 shadow-xl backdrop-blur">
          {content}
          <button
            onClick={() => setDismissed(true)}
            data-testid="continue-banner-dismiss"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X weight="bold" size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
