import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChatsCircle, BookBookmark, Microphone, PencilSimpleLine,
  Notebook, CheckCircle, ArrowRight, Trophy, Fire, MapTrifold,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { celebrate } from "@/lib/celebrate";
import { useAuth } from "@/context/AuthContext";

const ICONS = {
  chat: ChatsCircle,
  vocab: BookBookmark,
  pron: Microphone,
  writing: PencilSimpleLine,
  grammar: Notebook,
  checkin: Fire,
};

export default function DailyPathCard() {
  const { refreshUser } = useAuth();
  const [state, setState] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/daily-path");
      setState(data);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh state when tab regains focus (user returning from an activity)
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const claim = async () => {
    if (claiming || !state?.completed || state?.claimed) return;
    setClaiming(true);
    try {
      const { data } = await api.post("/daily-path/claim");
      if (data?.xp_awarded > 0) celebrate({ intensity: "big" });
      await refreshUser();
      await load();
    } finally {
      setClaiming(false);
    }
  };

  if (!state) return null;

  const pct = Math.round((state.tasks_done / Math.max(1, state.tasks_total)) * 100);
  const ringCircumference = 2 * Math.PI * 26;
  const ringOffset = ringCircumference * (1 - pct / 100);
  const allDone = state.completed;
  const claimed = state.claimed;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="daily-path-card"
      className="relative overflow-hidden rounded-3xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 md:p-8"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
              <circle cx="30" cy="30" r="26" stroke="#d1fae5" strokeWidth="6" fill="none" />
              <motion.circle
                cx="30" cy="30" r="26" stroke="url(#dp-grad)" strokeWidth="6" fill="none"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                initial={{ strokeDashoffset: ringCircumference }}
                animate={{ strokeDashoffset: ringOffset }}
                transition={{ type: "spring", stiffness: 80, damping: 18 }}
              />
              <defs>
                <linearGradient id="dp-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-emerald-700">
              {state.tasks_done}/{state.tasks_total}
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-800">
              <MapTrifold weight="duotone" size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Today's Path</span>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900 md:text-3xl" style={{ fontFamily: "Nunito, sans-serif" }}>
              {claimed ? "Daily goal complete! 🎉" : allDone ? "You're ready to claim!" : "Keep going today"}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              {claimed
                ? "Come back tomorrow to keep your streak alive."
                : allDone
                ? `Tap claim for +${state.reward_xp} XP and a streak-safe day.`
                : `3 small wins = +${state.reward_xp} XP bonus`}
            </p>
          </div>
        </div>

        {allDone && !claimed && (
          <button
            data-testid="daily-path-claim"
            onClick={claim}
            disabled={claiming}
            className="inline-flex items-center gap-2 rounded-xl border-b-4 border-emerald-700 bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 font-extrabold text-white transition active:translate-y-1 active:border-b-0 disabled:opacity-60"
          >
            <Trophy weight="fill" size={18} /> Claim +{state.reward_xp} XP
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AnimatePresence>
          {state.tasks.map((t, i) => {
            const Icon = ICONS[t.icon] || CheckCircle;
            const pctT = Math.round((t.progress / Math.max(1, t.target)) * 100);
            return (
              <motion.div
                key={t.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                data-testid={`daily-path-task-${t.key}`}
                className={`rounded-2xl border-2 p-4 ${t.done ? "border-emerald-200 bg-white" : "border-slate-100 bg-white"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {t.done ? <CheckCircle weight="fill" size={20} /> : <Icon weight="duotone" size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-bold ${t.done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                      {t.title}
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        className={`h-full rounded-full ${t.done ? "bg-emerald-500" : "bg-gradient-to-r from-emerald-400 to-teal-400"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pctT}%` }}
                        transition={{ type: "spring", stiffness: 80, damping: 18 }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>{t.progress}/{t.target}</span>
                      {!t.done && (
                        <Link
                          to={t.to}
                          data-testid={`daily-path-task-${t.key}-link`}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800"
                        >
                          Start <ArrowRight weight="bold" size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
