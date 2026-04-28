import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, X, Sparkle } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { celebrate } from "@/lib/celebrate";
import { useAuth } from "@/context/AuthContext";
import { track, EVT } from "@/lib/analytics";

/**
 * Streak Milestone celebration — opens automatically the first time the learner
 * hits a milestone threshold (3, 7, 14, 30, 60, 100 days). Awards bonus XP +
 * a badge. Firing is one-shot per (user, days) at the server.
 */
export default function StreakMilestoneModal() {
  const { user, refreshUser } = useAuth();
  const [pending, setPending] = useState(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!user || !user.has_completed_day1) return;
    (async () => {
      try {
        const { data } = await api.get("/streak/milestone");
        if (data?.pending) setPending(data.pending);
      } catch { /* silent */ }
    })();
  }, [user]);

  const claim = async () => {
    if (!pending || claiming) return;
    setClaiming(true);
    try {
      await api.post("/streak/milestone/claim", { days: pending.days });
      track(EVT.MILESTONE_CLAIMED, { days: pending.days, badge: pending.badge, reward_xp: pending.reward_xp });
      celebrate({ intensity: "big" });
      await refreshUser();
    } catch { /* noop */ }
    setPending(null);
    setClaiming(false);
  };

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
          data-testid="streak-milestone-modal"
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-amber-300 bg-white shadow-2xl"
          >
            <div className="relative bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-8 text-center text-white">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
              <button
                onClick={() => setPending(null)}
                data-testid="streak-milestone-close"
                aria-label="Close"
                className="absolute right-3 top-3 rounded-lg p-1 text-white/80 hover:bg-white/15"
              >
                <X />
              </button>
              <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-6xl shadow-lg">
                <span>{pending.emoji}</span>
              </div>
              <h2 className="relative mt-4 text-3xl font-extrabold leading-tight" style={{ fontFamily: "Nunito, sans-serif" }}>
                {pending.label}!
              </h2>
              <p className="relative mt-1 text-sm font-medium opacity-95">
                You've practiced English {pending.days} days in a row. Momentum unlocked. 🚀
              </p>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between rounded-2xl border-2 border-amber-100 bg-amber-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
                    <Sparkle weight="fill" size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Reward</div>
                    <div className="text-base font-extrabold text-slate-900">+{pending.reward_xp} XP · "{pending.badge}" badge</div>
                  </div>
                </div>
                <Trophy weight="duotone" size={28} className="text-amber-500" />
              </div>
              <motion.button
                onClick={claim}
                disabled={claiming}
                data-testid="streak-milestone-claim"
                animate={{ boxShadow: ["0 0 0 0 rgba(251,191,36,0.5)", "0 0 0 14px rgba(251,191,36,0)", "0 0 0 0 rgba(251,191,36,0)"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                className="mt-5 w-full rounded-xl border-b-4 border-amber-700 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-5 py-3.5 font-extrabold text-white disabled:opacity-60"
              >
                {claiming ? "Claiming…" : `Claim +${pending.reward_xp} XP 🎉`}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
