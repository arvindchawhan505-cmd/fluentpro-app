import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChatsCircle, Microphone, BookBookmark, PencilSimpleLine,
  Notebook, GraduationCap, ArrowRight,
} from "@phosphor-icons/react";

const MODES = [
  { to: "/conversation", title: "Speak with AI", subtitle: "Free-form chat with Coach Ada", icon: ChatsCircle, color: "from-blue-500 to-violet-500", testId: "practice-conversation" },
  { to: "/pronunciation", title: "Pronunciation", subtitle: "Record sentences and get scored", icon: Microphone, color: "from-rose-400 to-rose-500", testId: "practice-pronunciation" },
  { to: "/vocabulary", title: "Learn Words", subtitle: "Daily vocabulary + quiz", icon: BookBookmark, color: "from-amber-400 to-amber-500", testId: "practice-vocabulary" },
  { to: "/writing", title: "Improve Writing", subtitle: "Get essay feedback", icon: PencilSimpleLine, color: "from-emerald-400 to-emerald-500", testId: "practice-writing" },
  { to: "/grammar", title: "Fix My English", subtitle: "Grammar checks + tips", icon: Notebook, color: "from-indigo-400 to-indigo-500", testId: "practice-grammar" },
  { to: "/lessons", title: "Lessons", subtitle: "Beginner → Advanced curriculum", icon: GraduationCap, color: "from-fuchsia-400 to-fuchsia-500", testId: "practice-lessons" },
];

/**
 * Practice tab — gallery of all the discrete practice modes. The home
 * (/dashboard) only shows the focal Today's Mission card; this page is the
 * "explore more" surface for users who want to dive into a specific skill.
 */
export default function Practice() {
  return (
    <div className="space-y-6 pb-24 md:pb-8" data-testid="practice-page">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl" style={{ fontFamily: "Nunito, sans-serif" }}>
          Practice modes
        </h1>
        <p className="mt-1 text-base font-medium text-slate-600">
          Pick a skill and dive in. Done with today's mission already? Free practice keeps your streak warm.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODES.map((m, i) => (
          <motion.div
            key={m.to}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={m.to}
              data-testid={m.testId}
              className="group flex items-center gap-4 rounded-3xl border-2 border-slate-100 bg-white p-5 transition hover:border-violet-300 hover:shadow-md"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${m.color} text-white shadow-sm`}>
                <m.icon weight="fill" size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-slate-900">{m.title}</div>
                <div className="text-sm font-medium text-slate-500">{m.subtitle}</div>
              </div>
              <ArrowRight weight="bold" size={16} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-violet-500" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
