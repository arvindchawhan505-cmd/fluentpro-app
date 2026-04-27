import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { User, Star, Trophy, Briefcase, Airplane, GraduationCap, ChatsCircle, Sparkle, Crown, CheckCircle, Lock } from "@phosphor-icons/react";
import StreakFlame from "@/components/StreakFlame";
import LevelBadge from "@/components/LevelBadge";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

const GOAL_META = {
  job_interview: { icon: Briefcase, label: "Ace job interviews", gradient: "from-blue-500 to-indigo-500" },
  travel: { icon: Airplane, label: "Travel with confidence", gradient: "from-cyan-500 to-blue-500" },
  ielts: { icon: GraduationCap, label: "Prepare for IELTS", gradient: "from-violet-500 to-fuchsia-500" },
  casual: { icon: ChatsCircle, label: "Casual speaking", gradient: "from-emerald-500 to-teal-500" },
};

export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const [progress, setProgress] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => { const { data } = await api.get("/progress"); setProgress(data); })(); }, [user]);

  const changeLevel = async (lvl) => {
    setSaving(true);
    try { await api.post("/profile/level", { level: lvl }); await refreshUser(); }
    finally { setSaving(false); }
  };

  const changeGoal = async (key) => {
    setSaving(true);
    try { await api.post("/profile/goal", { goal: key }); await refreshUser(); }
    finally { setSaving(false); }
  };

  const goalMeta = user?.goal ? GOAL_META[user.goal] : null;

  return (
    <div className="space-y-5 pb-24 md:pb-8" data-testid="profile-page">
      {/* gradient hero */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-slate-100 bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 p-6 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <img src="/logo.png" alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-4 -right-4 hidden h-28 w-28 opacity-20 md:block" />
        <div className="relative flex flex-wrap items-center gap-4">
          {user?.picture ? (
            <img src={user.picture} alt="avatar" className="h-20 w-20 rounded-full border-4 border-white/40 object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/40 bg-white/20"><User weight="duotone" size={36} /></div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-extrabold" style={{ fontFamily: "Nunito, sans-serif" }}>{user?.name}</div>
              {user?.is_premium && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                  <Crown weight="fill" size={10} /> Premium
                </span>
              )}
            </div>
            <div className="text-sm font-medium text-white/80">{user?.email}</div>
            {goalMeta && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                <Sparkle weight="fill" size={12} /> Goal: {goalMeta.label}
              </div>
            )}
          </div>
          <button onClick={logout} data-testid="profile-logout-button" className="rounded-xl border-2 border-white/40 bg-white/15 px-4 py-2 font-bold text-white hover:bg-white/25">
            Sign out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StreakStat streak={progress?.streak ?? 0} />
        <Stat icon={Star} label="XP" value={progress?.xp ?? 0} color="bg-amber-50 text-amber-600" />
        <Stat icon={Trophy} label="Level" value={user?.level} color="bg-violet-50 text-violet-600" />
      </div>

      {/* Level progression */}
      {progress?.level_info && (
        <div className="rounded-3xl border-2 border-slate-100 bg-white p-6" data-testid="level-progression-card">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Your level</div>
          <div className="mt-3">
            <LevelBadge levelInfo={progress.level_info} size="lg" />
          </div>
          <div className="mt-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Perks</div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {progress.level_info.perks.map((p) => (
                <div key={p.label} className={`flex items-center gap-2 rounded-2xl border-2 p-3 ${p.unlocked ? "border-emerald-100 bg-emerald-50" : "border-slate-100 bg-slate-50"}`}>
                  {p.unlocked ? <CheckCircle weight="fill" className="text-emerald-500" /> : <Lock weight="duotone" className="text-slate-400" />}
                  <span className={`text-sm font-bold ${p.unlocked ? "text-emerald-800" : "text-slate-500"}`}>Lvl {p.level} · {p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Level */}
      <div className="rounded-3xl border-2 border-slate-100 bg-white p-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Your learning level</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l} data-testid={`profile-level-${l}`} disabled={saving} onClick={() => changeLevel(l)}
              className={`rounded-xl border-2 px-4 py-2 font-bold transition ${user?.level === l ? "border-indigo-500 bg-gradient-to-r from-blue-500 to-violet-500 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="mt-2 text-sm font-medium text-slate-500">Adjusts vocabulary & pronunciation difficulty.</div>
      </div>

      {/* Goal */}
      <div className="rounded-3xl border-2 border-slate-100 bg-white p-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Your goal</div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(GOAL_META).map(([key, m]) => {
            const Icon = m.icon;
            const active = user?.goal === key;
            return (
              <button key={key} disabled={saving} onClick={() => changeGoal(key)}
                data-testid={`profile-goal-${key}`}
                className={`group flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${active ? "border-indigo-500 ring-4 ring-indigo-200" : "border-slate-200 hover:border-indigo-300"}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${m.gradient} text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]`}>
                  <Icon weight="duotone" size={20} />
                </div>
                <div className="font-bold text-slate-800">{m.label}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-sm font-medium text-slate-500">Tailors lesson order and Coach Ada's coaching style.</div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-white p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon weight="duotone" size={20} /></div>
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-lg font-extrabold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function StreakStat({ streak }) {
  const hot = streak >= 7;
  return (
    <div className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border-2 p-4 ${hot ? "border-orange-200 bg-gradient-to-br from-amber-50 via-white to-rose-50" : "border-slate-100 bg-white"}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
        <StreakFlame streak={streak} size={22} />
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Streak {hot && "· On fire"}</div>
        <div className="text-lg font-extrabold text-slate-900">{streak}</div>
      </div>
    </div>
  );
}
