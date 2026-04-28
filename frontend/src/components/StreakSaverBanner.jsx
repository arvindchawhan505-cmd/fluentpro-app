import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Fire, X, Lightning, ArrowRight } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { track, EVT } from "@/lib/analytics";

const DISMISS_KEY = "streak_saver_dismissed_date";

function todayStr() { return new Date().toISOString().slice(0, 10); }

/**
 * Smart Streak Saver — floating bottom banner that appears after 9pm local time
 * if the learner has a streak >= 2 AND zero progress on today's Daily Path.
 * Offers a 1-tap "rescue" to keep the streak alive.
 */
export default function StreakSaverBanner() {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const check = useCallback(async () => {
    if (!user || !user.has_completed_day1) return;
    // Client-side gate: only after 9pm local
    const hour = new Date().getHours();
    if (hour < 21) return;
    if (localStorage.getItem(DISMISS_KEY) === todayStr()) return;
    try {
      const { data } = await api.get("/streak/saver");
      if (data?.eligible) setState(data);
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => { check(); }, [check]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, todayStr());
    setDismissed(true);
  };

  const rescue = async () => {
    if (claiming) return;
    setClaiming(true);
    try { await api.post("/streak/saver/claim"); track(EVT.STREAK_SAVED, { streak: state?.streak }); } catch { /* noop */ }
    dismiss();
  };

  if (dismissed || !state || !state.eligible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="saver"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        data-testid="streak-saver-banner"
        className="fixed bottom-[84px] left-1/2 z-40 w-[min(560px,calc(100vw-24px))] -translate-x-1/2 md:bottom-6"
      >
        <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 via-white to-rose-50 p-3 shadow-xl">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white">
            <Fire weight="fill" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              <Lightning weight="fill" size={10} /> Don't break your {state.streak}-day streak
            </div>
            <div className="truncate text-sm font-extrabold text-slate-900">
              60 seconds keeps it alive 🔥
            </div>
          </div>
          <Link
            to="/conversation"
            onClick={rescue}
            data-testid="streak-saver-rescue"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-b-4 border-rose-700 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-4 py-2 text-sm font-extrabold text-white active:translate-y-0.5 active:border-b-0"
          >
            Rescue now <ArrowRight weight="bold" size={14} />
          </Link>
          <button
            onClick={dismiss}
            data-testid="streak-saver-dismiss"
            aria-label="Dismiss"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X weight="bold" size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
