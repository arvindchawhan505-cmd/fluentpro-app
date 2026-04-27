import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { Sparkle, CheckCircle, Lightning, PaperPlaneRight, Star } from "@phosphor-icons/react";

export default function DailyCheckinCard() {
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/checkin/today");
      setData(data);
      if (data.completed) setFeedback({ feedback: data.feedback, response: data.response });
    } catch { /* noop */ }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/checkin/respond", { response: text });
      setFeedback({ feedback: data.feedback, response: data.response });
      setData((d) => ({ ...d, completed: true }));
      setText("");
    } finally { setSubmitting(false); }
  };

  if (!data) return null;

  const completed = data.completed;

  return (
    <section data-testid="daily-checkin-card" className="relative overflow-hidden rounded-3xl border-2 border-indigo-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-5 md:p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-200/50 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-blue-200/40 blur-2xl" />

      <div className="relative">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-indigo-700 shadow-sm">
          <Sparkle weight="duotone" size={14} />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Daily check-in {data.goal_label ? `· ${data.goal_label}` : ""}
          </span>
          <span className="text-[10px] font-bold text-slate-400">· 60 sec</span>
        </div>
        <h3 className="text-lg font-extrabold leading-snug text-slate-900 md:text-xl" style={{ fontFamily: "Nunito, sans-serif" }}>
          {data.prompt}
        </h3>

        <AnimatePresence mode="wait">
          {!completed ? (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onSubmit={(e) => { e.preventDefault(); submit(); }}
              className="mt-3"
            >
              <textarea
                data-testid="checkin-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Type 2–3 sentences in English…"
                className="w-full resize-none rounded-2xl border-2 border-slate-200 bg-white p-3 font-medium text-slate-900 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-200"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-500">
                  +15 XP on completion · {text.trim().split(/\s+/).filter(Boolean).length} words
                </div>
                <button
                  type="submit"
                  data-testid="checkin-submit"
                  disabled={!text.trim() || submitting}
                  className="inline-flex items-center gap-2 rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2 font-bold text-white transition hover:from-blue-600 hover:to-violet-600 active:translate-y-1 active:border-b-0 disabled:opacity-50"
                >
                  {submitting ? "Coach Ada is reading…" : (<><PaperPlaneRight weight="fill" size={16} /> Submit</>)}
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              data-testid="checkin-result"
              className="mt-3 space-y-3"
            >
              {feedback?.response && (
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-gradient-to-br from-blue-500 to-violet-500 p-3 text-sm text-white">
                  {feedback.response}
                </div>
              )}
              {feedback?.feedback?.reply && (
                <div className="max-w-[92%] rounded-2xl rounded-tl-md border-2 border-slate-100 bg-white p-3 text-sm text-slate-800">
                  <div className="font-medium">{feedback.feedback.reply}</div>
                  {feedback.feedback.highlight && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      <Star weight="fill" size={11} /> {feedback.feedback.highlight}
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-3">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle weight="fill" /> <span className="font-bold">Check-in complete!</span>
                  {feedback?.feedback?.score != null && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-emerald-700">
                      Score {feedback.feedback.score}
                    </span>
                  )}
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                  <Lightning weight="fill" size={12} /> +15 XP earned
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
