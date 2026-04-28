import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Briefcase, Airplane, GraduationCap, ChatsCircle, Sparkle, X } from "@phosphor-icons/react";
import { track, EVT } from "@/lib/analytics";

const GOAL_META = {
  job_interview: { icon: Briefcase, gradient: "from-blue-500 to-indigo-500", desc: "Behavioural questions, professional vocab, confident answers." },
  travel: { icon: Airplane, gradient: "from-cyan-500 to-blue-500", desc: "Airports, hotels, directions, polite phrases." },
  ielts: { icon: GraduationCap, gradient: "from-violet-500 to-fuchsia-500", desc: "Band-level coaching, academic vocab, complex grammar." },
  casual: { icon: ChatsCircle, gradient: "from-emerald-500 to-teal-500", desc: "Small talk, hobbies, daily life, native-like flow." },
};

export default function GoalOnboardingModal() {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [goals, setGoals] = useState([]);
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.goal) return;
    if (dismissed) return;
    if (sessionStorage.getItem("goal_onboarding_dismissed") === "1") return;
    (async () => {
      try {
        const { data } = await api.get("/profile/goals");
        setGoals(data.goals);
        setOpen(true);
      } catch { /* noop */ }
    })();
  }, [user, dismissed]);

  const close = () => {
    sessionStorage.setItem("goal_onboarding_dismissed", "1");
    setDismissed(true);
    setOpen(false);
  };

  const save = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      await api.post("/profile/goal", { goal: picked });
      track(EVT.GOAL_SELECTED, { goal: picked });
      await refreshUser();
      setOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          data-testid="goal-onboarding-modal"
        >
          <motion.div
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}
            className="w-full max-w-2xl rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-2xl md:p-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-100 to-violet-100 px-3 py-1 text-indigo-700">
                  <Sparkle weight="duotone" size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Personalize your coach</span>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 md:text-3xl" style={{ fontFamily: "Nunito, sans-serif" }}>
                  What's your English goal?
                </h2>
                <p className="mt-1 max-w-md font-medium text-slate-600">
                  We'll tailor lessons and Coach Ada's responses to fit your goal. You can change this anytime in Profile.
                </p>
              </div>
              <button onClick={close} aria-label="Close" data-testid="goal-onboarding-close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X /></button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {goals.map((g) => {
                const meta = GOAL_META[g.key] || { icon: Sparkle, gradient: "from-slate-400 to-slate-500", desc: "" };
                const Icon = meta.icon;
                const active = picked === g.key;
                return (
                  <button
                    key={g.key}
                    data-testid={`goal-option-${g.key}`}
                    onClick={() => setPicked(g.key)}
                    className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition ${active ? "border-indigo-500 ring-4 ring-indigo-200" : "border-slate-200 hover:border-indigo-300"}`}
                  >
                    <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradient} text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]`}>
                      <Icon weight="duotone" size={22} />
                    </div>
                    <div className="font-extrabold text-slate-900">{g.label}</div>
                    <div className="mt-1 text-sm font-medium text-slate-500">{meta.desc}</div>
                    {active && <div className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-indigo-500" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button onClick={close} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100" data-testid="goal-onboarding-skip">
                Skip for now
              </button>
              <button
                data-testid="goal-onboarding-save"
                disabled={!picked || saving}
                onClick={save}
                className="relative rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 font-bold text-white transition hover:from-blue-600 hover:to-violet-600 active:translate-y-1 active:border-b-0 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Set my goal"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
