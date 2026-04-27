import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { User, Flame, Star, Trophy } from "@phosphor-icons/react";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

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

  return (
    <div className="space-y-5 pb-24 md:pb-8" data-testid="profile-page">
      <div className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-slate-100 bg-white p-6">
        {user?.picture ? (
          <img src={user.picture} alt="avatar" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-slate-500"><User weight="duotone" size={28} /></div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>{user?.name}</div>
          <div className="text-sm font-medium text-slate-500">{user?.email}</div>
        </div>
        <button onClick={logout} data-testid="profile-logout-button" className="rounded-xl border-2 border-rose-200 bg-white px-4 py-2 font-bold text-rose-600 hover:bg-rose-50">
          Sign out
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={Flame} label="Streak" value={progress?.streak ?? 0} color="bg-orange-50 text-orange-600" />
        <Stat icon={Star} label="XP" value={progress?.xp ?? 0} color="bg-amber-50 text-amber-600" />
        <Stat icon={Trophy} label="Level" value={user?.level} color="bg-violet-50 text-violet-600" />
      </div>

      <div className="rounded-3xl border-2 border-slate-100 bg-white p-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Your learning level</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l} data-testid={`profile-level-${l}`} disabled={saving} onClick={() => changeLevel(l)}
              className={`rounded-xl border-2 px-4 py-2 font-bold transition ${user?.level === l ? "border-sky-500 bg-sky-400 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-sky-200"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="mt-2 text-sm font-medium text-slate-500">This adjusts vocabulary and pronunciation difficulty.</div>
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
