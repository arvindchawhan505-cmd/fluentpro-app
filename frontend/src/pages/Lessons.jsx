import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Notebook, CheckCircle, ArrowRight, Crown, Sparkle } from "@phosphor-icons/react";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const GOAL_LABELS = {
  job_interview: "Ace job interviews",
  travel: "Travel with confidence",
  ielts: "Prepare for IELTS",
  casual: "Casual speaking",
};

export default function Lessons() {
  const [lessons, setLessons] = useState([]);
  const [goal, setGoal] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/lessons");
      setLessons(data.lessons);
      setGoal(data.goal);
    })();
  }, []);

  const filtered = filter === "all" ? lessons : lessons.filter((l) => l.level === filter);

  return (
    <div className="space-y-5 pb-24 md:pb-8" data-testid="lessons-page">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]">
          <Notebook weight="duotone" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>Lessons</h1>
          <p className="font-medium text-slate-600">
            Structured learning Beginner → Advanced{goal && GOAL_LABELS[goal] ? ` · personalized for ${GOAL_LABELS[goal]}` : ""}.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {["all", ...LEVELS].map((lvl) => (
          <button key={lvl} data-testid={`filter-${lvl}`} onClick={() => setFilter(lvl)}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold capitalize ${filter === lvl ? "border-violet-500 bg-violet-400 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"}`}>
            {lvl}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {(filter === "all" ? LEVELS : [filter]).map((lvl) => {
          const group = lessons.filter((l) => l.level === lvl);
          if (!group.length) return null;
          return (
            <div key={lvl}>
              <h2 className="mb-3 text-lg font-bold text-slate-700" style={{ fontFamily: "Nunito, sans-serif" }}>{lvl}</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {group.map((l) => (
                  <Link key={l.id} to={l.locked ? "/premium" : `/lessons/${l.id}`} data-testid={`lessons-list-${l.id}`}
                    className={`group relative flex items-start gap-4 overflow-hidden rounded-3xl border-2 p-5 transition hover:-translate-y-1 hover:shadow-md ${l.locked ? "border-slate-100 bg-slate-50 hover:border-amber-200" : l.recommended ? "border-indigo-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 hover:border-indigo-300" : "border-slate-100 bg-white hover:border-violet-200"}`}>
                    {l.recommended && !l.locked && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        <Sparkle weight="fill" size={10} /> For your goal
                      </span>
                    )}
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${l.completed ? "bg-green-100 text-green-600" : l.locked ? "bg-amber-100 text-amber-500" : l.recommended ? "bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]" : "bg-violet-100 text-violet-600"}`}>
                      {l.completed ? <CheckCircle weight="duotone" size={22} /> : l.locked ? <Crown weight="fill" size={20} /> : <Notebook weight="duotone" size={22} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-extrabold text-slate-900">{l.title}</div>
                        {l.locked && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Premium</span>}
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-500">{l.description}</div>
                    </div>
                    <ArrowRight weight="bold" className={`mt-2 ${l.locked ? "text-amber-400" : "text-slate-400 group-hover:text-violet-500"}`} />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="rounded-3xl border-2 border-slate-100 bg-white p-10 text-center font-bold text-slate-500">Loading…</div>}
      </div>
    </div>
  );
}
