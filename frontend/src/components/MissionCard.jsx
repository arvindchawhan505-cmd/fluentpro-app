import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChatsCircle, BookBookmark, Microphone, PencilSimpleLine,
  CheckCircle, ArrowRight, Rocket, Lightning, Trophy,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";

const ICONS = {
  chat: ChatsCircle,
  vocab: BookBookmark,
  speak: Microphone,
  write: PencilSimpleLine,
};

/**
 * Hero card for the new unified Daily Mission flow. Replaces the previous
 * "Start Today's Practice" / DailyPath hero on the dashboard. Shows progress
 * 0/4 with 4 task tiles and a single Start/Continue CTA that drops the user
 * into the auto-flowing /mission route.
 */
export default function MissionCard({ data, onChange }) {
  const navigate = useNavigate();
  const [state, setState] = useState(data || null);

  useEffect(() => {
    if (data) { setState(data); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data: m } = await api.get("/mission/today");
        if (!cancelled) { setState(m); onChange?.(m); }
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [data, onChange]);

  if (!state) return null;
  const { tasks, tasks_done, tasks_total, completed, xp_earned, completion_bonus } = state;
  const pct = Math.round((tasks_done / Math.max(1, tasks_total)) * 100);
  const ringC = 2 * Math.PI * 32;
  const ringO = ringC * (1 - pct / 100);

  const ctaLabel = completed
    ? "Mission complete 🎉"
    : tasks_done === 0
    ? "Start Mission"
    : "Continue Mission";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="mission-card"
      className="relative overflow-hidden rounded-3xl border-2 border-violet-200 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6 md:p-8"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-blue-300/30 blur-3xl" />

      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
              <circle cx="36" cy="36" r="32" stroke="#e0e7ff" strokeWidth="7" fill="none" />
              <motion.circle
                cx="36" cy="36" r="32" stroke="url(#m-grad)" strokeWidth="7" fill="none"
                strokeLinecap="round"
                strokeDasharray={ringC}
                initial={{ strokeDashoffset: ringC }}
                animate={{ strokeDashoffset: ringO }}
                transition={{ type: "spring", stiffness: 80, damping: 18 }}
              />
              <defs>
                <linearGradient id="m-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-violet-700">
              {tasks_done}/{tasks_total}
            </div>
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-violet-800">
              <Rocket weight="fill" size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Today's Mission</span>
            </div>
            <h2 className="mt-1 text-3xl font-extrabold text-slate-900 md:text-4xl" style={{ fontFamily: "Nunito, sans-serif" }}>
              {completed ? "Done for today!" : "Today's Mission 🚀"}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              {completed
                ? `+${xp_earned} XP earned · streak +1 🔥`
                : `4 quick tasks · 3-5 minutes · finish for +${completion_bonus} bonus XP`}
            </p>
          </div>
        </div>

        <button
          data-testid="mission-cta"
          onClick={() => navigate("/mission")}
          className={`inline-flex items-center gap-2 rounded-2xl border-b-4 px-6 py-3.5 font-extrabold text-white transition active:translate-y-1 active:border-b-0 ${
            completed
              ? "border-emerald-700 bg-gradient-to-r from-emerald-500 to-teal-500"
              : "border-violet-700 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500"
          }`}
        >
          {completed ? <Trophy weight="fill" size={18} /> : <Lightning weight="fill" size={18} />}
          {ctaLabel}
          {!completed && <ArrowRight weight="bold" size={16} />}
        </button>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tasks.map((t, i) => {
          const Icon = ICONS[t.icon] || ChatsCircle;
          return (
            <motion.div
              key={t.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              data-testid={`mission-task-${t.key}`}
              className={`rounded-2xl border-2 p-3 ${t.done ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-white"}`}
            >
              <div className="flex items-center gap-2">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {t.done ? <CheckCircle weight="fill" size={18} /> : <Icon weight="duotone" size={18} />}
                </div>
                <div className="min-w-0">
                  <div className={`truncate text-xs font-extrabold ${t.done ? "text-emerald-700" : "text-slate-900"}`}>
                    {t.title}
                  </div>
                  <div className="truncate text-[10px] font-bold text-slate-400">+{t.xp} XP</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
