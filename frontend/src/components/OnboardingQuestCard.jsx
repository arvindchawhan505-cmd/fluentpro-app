import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { celebrate } from "@/lib/celebrate";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle, Circle, Trophy, Sparkle, Lightning } from "@phosphor-icons/react";

export default function OnboardingQuestCard() {
  const { refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/onboarding/quest");
      setData(data);
    } catch { /* noop */ }
  };
  useEffect(() => { load(); }, []);

  if (!data) return null;
  // Hide quest card if claimed or user has dismissed it post-claim
  if (data.claimed && (dismissed || sessionStorage.getItem("quest_dismissed") === "1")) return null;

  const claim = async () => {
    setClaiming(true);
    try {
      await api.post("/onboarding/quest/claim");
      celebrate({ intensity: "big" });
      await refreshUser();
      await load();
    } finally { setClaiming(false); }
  };

  const days = [1, 2, 3];
  const grouped = days.map((d) => ({
    day: d,
    tasks: data.tasks.filter((t) => t.day === d),
  }));
  const currentDay = grouped.find((g) => g.tasks.some((t) => !t.done))?.day ?? 3;

  return (
    <motion.section
      data-testid="onboarding-quest-card"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border-2 border-violet-200 bg-gradient-to-br from-blue-50 via-violet-50 to-rose-50 p-5 md:p-6"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-violet-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-blue-300/30 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]">
            <Sparkle weight="fill" size={28} />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-indigo-700 shadow-sm">
              <Trophy weight="fill" size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">3-day onboarding quest</span>
            </div>
            <h3 className="mt-2 text-xl font-extrabold text-slate-900 md:text-2xl" style={{ fontFamily: "Nunito, sans-serif" }}>
              {data.completed ? (data.claimed ? "Quest claimed — well done! 🎉" : "Quest complete · claim your reward") : `Day ${currentDay} of 3`}
            </h3>
            <p className="mt-1 max-w-md text-sm font-medium text-slate-600">
              {data.completed
                ? `+${data.reward_xp} XP & "${data.badge}" badge unlocked.`
                : `Finish ${data.tasks_total - data.tasks_done} more tasks to earn +${data.reward_xp} XP and the "${data.badge}" badge.`}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="inline-flex items-center gap-1 rounded-full bg-amber-200/70 px-3 py-1 text-amber-800">
            <Lightning weight="fill" size={14} />
            <span className="text-sm font-bold">+{data.reward_xp} XP</span>
          </div>
          <div className="text-xs font-bold text-slate-500">{data.tasks_done}/{data.tasks_total} done</div>
        </div>
      </div>

      <div className="relative mt-4 grid gap-3 md:grid-cols-3">
        {grouped.map((g) => {
          const allDone = g.tasks.every((t) => t.done);
          const someDone = g.tasks.some((t) => t.done);
          const isCurrent = g.day === currentDay && !allDone;
          return (
            <div
              key={g.day}
              data-testid={`quest-day-${g.day}`}
              className={`rounded-2xl border-2 p-3 transition ${allDone ? "border-emerald-200 bg-emerald-50" : isCurrent ? "border-indigo-300 bg-white ring-4 ring-indigo-100" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-center justify-between">
                <div className={`text-xs font-bold uppercase tracking-wider ${allDone ? "text-emerald-700" : "text-slate-500"}`}>Day {g.day}</div>
                {allDone && <CheckCircle weight="fill" className="text-emerald-500" size={16} />}
              </div>
              <ul className="mt-2 space-y-1.5">
                {g.tasks.map((t) => (
                  <li key={t.key} data-testid={`quest-task-${t.key}`} className="flex items-center gap-2 text-sm">
                    {t.done ? (
                      <CheckCircle weight="fill" className="text-emerald-500" size={16} />
                    ) : (
                      <Circle weight="duotone" className="text-slate-300" size={16} />
                    )}
                    <span className={`font-medium ${t.done ? "text-slate-500 line-through" : "text-slate-800"}`}>{t.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        {data.completed && !data.claimed && (
          <button
            onClick={claim}
            disabled={claiming}
            data-testid="quest-claim-button"
            className="relative rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-5 py-2.5 font-bold text-white transition hover:opacity-95 active:translate-y-1 active:border-b-0 disabled:opacity-50"
          >
            {claiming ? "Claiming…" : `🎁 Claim +${data.reward_xp} XP & "${data.badge}" badge`}
          </button>
        )}
        {data.claimed && (
          <>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-700">
              <CheckCircle weight="fill" /> "{data.badge}" badge earned
            </span>
            <button
              onClick={() => { sessionStorage.setItem("quest_dismissed", "1"); setDismissed(true); }}
              data-testid="quest-dismiss-button"
              className="rounded-xl px-3 py-1.5 text-sm font-bold text-slate-500 hover:bg-white"
            >
              Hide
            </button>
          </>
        )}
      </div>
    </motion.section>
  );
}
