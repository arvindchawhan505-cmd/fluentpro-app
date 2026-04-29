import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Trophy, Star, Crown, ArrowRight } from "@phosphor-icons/react";
import StreakFlame from "@/components/StreakFlame";
import LevelBadge from "@/components/LevelBadge";
import MissionCard from "@/components/MissionCard";

/**
 * Daily Mission home. Strips the dashboard down to ONE focal hero card
 * (Today's Mission) plus a compact XP / streak / level strip. Everything
 * else (challenges, check-ins, referrals, lessons grid) has moved to the
 * "Practice" section in the sidebar to keep the home screen distraction-free.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.get("/progress");
        setProgress(p.data);
      } catch { /* tolerate */ }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return (
      <div className="space-y-6 pb-24 md:pb-8" data-testid="dashboard-skeleton">
        <div className="h-32 w-full animate-pulse rounded-3xl border-2 border-slate-100 bg-slate-50" />
        <div className="h-64 w-full animate-pulse rounded-3xl border-2 border-slate-100 bg-slate-50" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-8" data-testid="dashboard-page">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl" style={{ fontFamily: "Nunito, sans-serif" }}>
            Hi, {user?.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="mt-1 text-base font-medium text-slate-600">
            Let's improve your English today.
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          {progress && <LevelBadge level={progress.level || user?.level || "Beginner"} />}
        </div>
      </header>

      {/* Compact stats strip */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="grid grid-cols-3 gap-3"
      >
        <Stat label="Streak" value={`${progress?.streak ?? user?.streak ?? 0} days`} icon={<StreakFlame size={22} />} bg="bg-rose-50" />
        <Stat label="XP" value={progress?.xp ?? user?.xp ?? 0} icon={<Star weight="fill" size={20} className="text-amber-500" />} bg="bg-amber-50" />
        <Stat label="Lessons" value={`${progress?.completed_lessons ?? 0}/${progress?.total_lessons ?? 0}`} icon={<Trophy weight="fill" size={20} className="text-violet-500" />} bg="bg-violet-50" />
      </motion.div>

      {/* THE main card — everything else has moved to /practice */}
      <MissionCard />

      {/* Subtle pointer to Practice tab so power users know other modes exist */}
      <Link
        to="/practice"
        data-testid="practice-tab-link"
        className="group flex items-center justify-between rounded-2xl border-2 border-slate-100 bg-white p-4 text-sm font-bold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
      >
        <span>Want more practice? Explore conversation, lessons, vocabulary…</span>
        <ArrowRight weight="bold" size={16} className="transition group-hover:translate-x-1" />
      </Link>

      {/* Premium teaser — only after Day-1 done */}
      {user?.has_completed_day1 && !user?.is_premium && (
        <Link
          to="/premium"
          data-testid="premium-teaser"
          className="flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-sm font-bold text-amber-900 hover:border-amber-300"
        >
          <span className="flex items-center gap-2">
            <Crown weight="fill" size={18} className="text-amber-500" />
            Upgrade for unlimited practice
          </span>
          <ArrowRight weight="bold" size={14} />
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value, icon, bg }) {
  return (
    <div className={`rounded-2xl border border-slate-100 ${bg} p-3`}>
      <div className="flex items-center gap-2">
        {icon}
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      </div>
      <div className="mt-0.5 text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}
