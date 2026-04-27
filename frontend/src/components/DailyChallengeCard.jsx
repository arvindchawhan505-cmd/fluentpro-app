import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { celebrate } from "@/lib/celebrate";
import { useAuth } from "@/context/AuthContext";
import { Trophy, Lightning, Clock, CheckCircle, Sparkle } from "@phosphor-icons/react";

function fmtTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

export default function DailyChallengeCard() {
  const { refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/challenge/today");
      setData(data);
      setSecondsLeft(data.seconds_until_reset);
    } catch { /* noop */ }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (secondsLeft == null) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, (s ?? 1) - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  // Auto-refresh every 30s while card is unclaimed (so progress reflects other tab actions)
  useEffect(() => {
    if (!data || data.claimed) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [data]);

  const claim = async () => {
    setClaiming(true);
    try {
      const { data } = await api.post("/challenge/claim");
      celebrate({ intensity: "big" });
      await refreshUser();
      await load();
      return data;
    } finally { setClaiming(false); }
  };

  if (!data) return null;
  const ch = data.challenge;
  const pct = Math.min(100, Math.round(100 * data.progress / Math.max(1, data.target)));
  const ready = data.completed && !data.claimed;
  const done = data.claimed;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      data-testid="daily-challenge-card"
      className="relative overflow-hidden rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 md:p-6"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-300/40 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-6 h-28 w-28 rounded-full bg-rose-300/30 blur-2xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${done ? "from-emerald-400 to-emerald-600" : ready ? "from-amber-400 to-orange-500" : "from-amber-300 to-orange-400"} text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]`}>
              <Trophy weight="fill" size={28} />
            </div>
            {ready && (
              <span className="absolute -right-1 -top-1 inline-flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
              </span>
            )}
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-amber-700 shadow-sm">
              <Sparkle weight="fill" size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Today's challenge</span>
            </div>
            <h3 className="mt-2 text-xl font-extrabold leading-tight text-slate-900 md:text-2xl" style={{ fontFamily: "Nunito, sans-serif" }}>
              {ch.title}
            </h3>
            <p className="mt-1 max-w-md text-sm font-medium text-slate-600">{ch.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-1 rounded-full bg-amber-200/70 px-3 py-1 text-amber-800">
            <Lightning weight="fill" size={14} />
            <span className="text-sm font-bold">+{ch.reward_xp} XP</span>
          </div>
          <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
            <Clock weight="duotone" size={14} />
            <span data-testid="challenge-timer">{secondsLeft != null ? fmtTime(secondsLeft) : "—"}</span>
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
          <span>{data.progress} / {data.target}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-white/70 ring-1 ring-amber-200">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 16 }}
            className={`h-full rounded-full ${done ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500"}`}
          />
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        {!data.completed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
            Resets at midnight UTC
          </span>
        )}
        {ready && (
          <button
            onClick={claim}
            disabled={claiming}
            data-testid="challenge-claim-button"
            className="relative rounded-xl border-b-4 border-emerald-700 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-5 py-2.5 font-bold text-white transition hover:opacity-95 active:translate-y-1 active:border-b-0 disabled:opacity-50"
          >
            {claiming ? "Claiming…" : `🎁 Claim +${ch.reward_xp} XP`}
          </button>
        )}
        {done && (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-700">
            <CheckCircle weight="fill" /> Reward claimed · come back tomorrow
          </span>
        )}
      </div>
    </motion.section>
  );
}
