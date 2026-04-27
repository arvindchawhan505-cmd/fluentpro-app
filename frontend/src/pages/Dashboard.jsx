import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Flame, Star, Trophy, ChatsCircle, Microphone, PencilSimpleLine,
  BookBookmark, Notebook, ArrowRight, ShareNetwork, Crown,
} from "@phosphor-icons/react";
import ShareStreakModal from "@/components/ShareStreakModal";

const quickActions = [
  { to: "/conversation", title: "Chat with Coach", subtitle: "Practice real conversations", icon: ChatsCircle, color: "from-sky-400 to-sky-500", testId: "quick-conversation" },
  { to: "/pronunciation", title: "Pronunciation", subtitle: "Record and get scored", icon: Microphone, color: "from-rose-400 to-rose-500", testId: "quick-pronunciation" },
  { to: "/vocabulary", title: "Vocabulary", subtitle: "5 new words today", icon: BookBookmark, color: "from-amber-400 to-amber-500", testId: "quick-vocabulary" },
  { to: "/writing", title: "Writing feedback", subtitle: "Get essay scores", icon: PencilSimpleLine, color: "from-green-400 to-green-500", testId: "quick-writing" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, l] = await Promise.all([api.get("/progress"), api.get("/lessons")]);
      setProgress(p.data);
      setLessons(l.data.lessons);
    })();
  }, []);

  const nextLesson = lessons.find((l) => !l.completed && !l.locked) || lessons.find((l) => !l.completed);

  return (
    <div className="space-y-8 pb-24 md:pb-8" data-testid="dashboard-page">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 gap-4 md:grid-cols-12"
      >
        <div className="md:col-span-8 rounded-3xl border-2 border-slate-100 bg-gradient-to-br from-sky-50 via-white to-amber-50 p-6 md:p-8">
          <div className="text-sm font-bold uppercase tracking-wider text-sky-600">Welcome back</div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl" style={{ fontFamily: "Nunito, sans-serif" }}>
            Hi, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="mt-2 max-w-xl font-medium text-slate-600">
            Ready for today's practice? Keep your streak alive — small daily reps build real fluency.
          </p>
          {nextLesson && (
            <Link
              to={`/lessons/${nextLesson.id}`}
              data-testid="continue-next-lesson-button"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border-b-4 border-sky-600 bg-sky-400 px-5 py-3 font-bold text-white transition hover:bg-sky-500 active:translate-y-1 active:border-b-0"
            >
              Continue: {nextLesson.title}
              <ArrowRight weight="bold" />
            </Link>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setShareOpen(true)}
              data-testid="share-streak-button"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-orange-200 bg-white px-4 py-2 font-bold text-orange-700 hover:border-orange-300"
            >
              <ShareNetwork weight="duotone" /> Share my streak
            </button>
            {!user?.is_premium && (
              <Link
                to="/premium"
                data-testid="dashboard-go-premium-link"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-2 font-bold text-amber-700 hover:border-amber-300"
              >
                <Crown weight="fill" /> Go Premium · ₹99/mo
              </Link>
            )}
          </div>
        </div>

        <div className="md:col-span-4 grid grid-cols-3 gap-3 md:grid-cols-1">
          <Stat icon={Flame} label="Streak" value={progress?.streak ?? 0} suffix="days" color="text-orange-600 bg-orange-50" testId="stat-streak" />
          <Stat icon={Star} label="XP" value={progress?.xp ?? 0} color="text-amber-600 bg-amber-50" testId="stat-xp" />
          <Stat icon={Trophy} label="Level" value={progress?.level ?? "—"} color="text-violet-600 bg-violet-50" testId="stat-level" />
        </div>
      </motion.section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-slate-800" style={{ fontFamily: "Nunito, sans-serif" }}>
          Jump in
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {quickActions.map(({ to, title, subtitle, icon: Icon, color, testId }) => (
            <Link
              key={to}
              to={to}
              data-testid={testId}
              className="group relative overflow-hidden rounded-3xl border-2 border-slate-100 bg-white p-5 transition hover:-translate-y-1 hover:border-sky-200 hover:shadow-md"
            >
              <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)]`}>
                <Icon weight="duotone" size={22} />
              </div>
              <div className="font-extrabold text-slate-900">{title}</div>
              <div className="text-sm font-medium text-slate-500">{subtitle}</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: "Nunito, sans-serif" }}>
            Your learning path
          </h2>
          <Link to="/lessons" className="text-sm font-bold text-sky-600 hover:underline" data-testid="see-all-lessons-link">
            See all →
          </Link>
        </div>
        {progress && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-600">
              <span>{progress.completed}/{progress.total_lessons} lessons</span>
              <span>{progress.progress_pct}%</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="relative h-full rounded-full bg-sky-400 transition-all after:absolute after:left-1 after:right-1 after:top-1 after:h-1.5 after:rounded-full after:bg-white/30"
                style={{ width: `${progress.progress_pct}%` }}
              />
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {lessons.slice(0, 4).map((l) => (
            <Link
              key={l.id}
              to={`/lessons/${l.id}`}
              data-testid={`lesson-card-${l.id}`}
              className="group flex items-center justify-between rounded-2xl border-2 border-slate-100 bg-white p-4 transition hover:border-sky-200"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${l.completed ? "bg-green-100 text-green-600" : l.locked ? "bg-slate-100 text-slate-400" : "bg-sky-100 text-sky-600"}`}>
                  <Notebook weight="duotone" size={22} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {l.level} {l.locked && "· Premium"}
                  </div>
                  <div className="font-extrabold text-slate-900">{l.title}</div>
                </div>
              </div>
              {l.locked ? <Crown weight="fill" className="text-amber-500" /> : <ArrowRight weight="bold" className="text-slate-400 transition group-hover:text-sky-500" />}
            </Link>
          ))}
        </div>
      </section>
      <ShareStreakModal open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, suffix, color, testId }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-white p-4 ${color.includes("bg-") ? "" : ""}`} data-testid={testId}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon weight="duotone" size={20} />
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-lg font-extrabold text-slate-900">
          {value}{suffix ? <span className="ml-1 text-sm font-bold text-slate-500">{suffix}</span> : null}
        </div>
      </div>
    </div>
  );
}
