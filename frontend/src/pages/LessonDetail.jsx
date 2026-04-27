import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle, XCircle, CaretLeft, SpeakerHigh, Trophy } from "@phosphor-icons/react";
import { celebrate } from "@/lib/celebrate";

export default function LessonDetail() {
  const { id } = useParams();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/lessons/${id}`);
        setData(data);
      } finally { setLoading(false); }
    })();
  }, [id]);

  const speak = async (text) => {
    try {
      const r = await api.post("/tts", { text, voice: "nova" }, { responseType: "blob" });
      new Audio(URL.createObjectURL(r.data)).play();
    } catch { /* noop */ }
  };

  const complete = async () => {
    const total = data.content.practice_questions.length;
    const correct = data.content.practice_questions.reduce((a, q, i) => a + (answers[i] === q.correct_index ? 1 : 0), 0);
    const score = Math.round(100 * correct / total);
    try {
      await api.post("/lessons/complete", { lesson_id: id, score });
      await refreshUser();
    } finally { setSubmitted(true); }
    // Celebrate proportional to score
    setTimeout(() => celebrate({ intensity: score >= 80 ? "big" : score >= 50 ? "medium" : "small" }), 200);
    return { correct, total, score };
  };

  if (loading || !data) {
    return <div className="flex h-64 items-center justify-center text-slate-500 font-bold">Loading lesson…</div>;
  }
  const { lesson, content } = data;

  const correctCount = submitted
    ? content.practice_questions.reduce((a, q, i) => a + (answers[i] === q.correct_index ? 1 : 0), 0)
    : 0;

  return (
    <div className="space-y-6 pb-24 md:pb-8" data-testid="lesson-detail-page">
      <Link to="/lessons" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-sky-600" data-testid="back-to-lessons">
        <CaretLeft /> Back to lessons
      </Link>
      <header>
        <div className="text-xs font-bold uppercase tracking-wider text-sky-600">{lesson.level}</div>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900 md:text-4xl" style={{ fontFamily: "Nunito, sans-serif" }}>{lesson.title}</h1>
        <p className="mt-2 max-w-2xl font-medium text-slate-600">{lesson.description}</p>
      </header>

      <div className="rounded-3xl border-2 border-slate-100 bg-white p-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Intro</div>
        <div className="mt-2 whitespace-pre-wrap font-medium text-slate-700">{content.intro}</div>
      </div>

      <div className="rounded-3xl border-2 border-slate-100 bg-white p-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Key points</div>
        <ul className="mt-3 space-y-2 font-medium text-slate-800">
          {content.key_points.map((k, i) => (
            <li key={i} className="flex gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-sky-400" />{k}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border-2 border-slate-100 bg-white p-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Examples</div>
        <div className="mt-3 space-y-3">
          {content.examples.map((ex, i) => (
            <div key={i} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-4">
              <div>
                <div className="font-extrabold text-slate-900">{ex.english}</div>
                <div className="mt-1 text-sm font-medium text-slate-600">{ex.note}</div>
              </div>
              <button onClick={() => speak(ex.english)} data-testid={`example-speak-${i}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 hover:bg-sky-200">
                <SpeakerHigh weight="duotone" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border-2 border-slate-100 bg-white p-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Practice</div>
        <div className="mt-3 space-y-4">
          {content.practice_questions.map((q, i) => (
            <div key={i}>
              <div className="font-extrabold text-slate-900">Q{i + 1}. {q.question}</div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {q.options.map((opt, oi) => {
                  const picked = answers[i] === oi;
                  const correct = submitted && oi === q.correct_index;
                  const wrong = submitted && picked && oi !== q.correct_index;
                  return (
                    <button key={oi}
                      data-testid={`lesson-q${i}-opt${oi}`}
                      disabled={submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                      className={`flex items-center justify-between rounded-xl border-2 p-3 text-left font-bold transition ${
                        correct ? "border-green-500 bg-green-50 text-green-700"
                        : wrong ? "border-rose-500 bg-rose-50 text-rose-700"
                        : picked ? "border-sky-500 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-sky-200"
                      }`}>
                      <span>{opt}</span>
                      {correct && <CheckCircle weight="duotone" />}
                      {wrong && <XCircle weight="duotone" />}
                    </button>
                  );
                })}
              </div>
              {submitted && <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700">{q.explanation}</div>}
            </div>
          ))}
        </div>
        <div className="mt-5">
          {!submitted ? (
            <button onClick={complete} data-testid="lesson-complete-button"
              className="relative rounded-xl border-b-4 border-sky-600 bg-sky-400 px-6 py-3 font-bold text-white hover:bg-sky-500 active:translate-y-1 active:border-b-0">
              Finish lesson
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-4 text-emerald-800" data-testid="lesson-complete-banner">
              <Trophy weight="fill" size={28} className="text-amber-500" />
              <div className="font-extrabold">You scored {correctCount} / {content.practice_questions.length} — +25 XP</div>
              <button onClick={() => navigate("/lessons")} className="ml-auto rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2 font-bold text-white hover:from-blue-600 hover:to-violet-600 active:translate-y-1 active:border-b-0">Continue</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
