import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BookBookmark, SpeakerHigh, CaretLeft, CaretRight, CheckCircle, XCircle } from "@phosphor-icons/react";

export default function Vocabulary() {
  const [level, setLevel] = useState("Intermediate");
  const [words, setWords] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("learn"); // learn | quiz
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState(false);

  const loadDaily = async (lvl) => {
    setLoading(true);
    try {
      const { data } = await api.post("/vocabulary/daily", { level: lvl, count: 5 });
      setWords(data.words || []);
      setIdx(0);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadDaily(level); /* eslint-disable-next-line */ }, [level]);

  const speak = async (text) => {
    try {
      const r = await api.post("/tts", { text, voice: "nova" }, { responseType: "blob" });
      new Audio(URL.createObjectURL(r.data)).play();
    } catch { /* noop */ }
  };

  const startQuiz = async () => {
    setMode("quiz"); setQuiz(null); setAnswers({}); setRevealed(false); setLoading(true);
    try {
      const { data } = await api.post("/vocabulary/quiz", { level, count: 5 });
      setQuiz(data);
    } finally { setLoading(false); }
  };

  const correctCount = quiz && revealed ? quiz.questions.reduce((a, q, i) => a + (answers[i] === q.correct_index ? 1 : 0), 0) : 0;

  return (
    <div className="space-y-5 pb-24 md:pb-8" data-testid="vocabulary-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <BookBookmark weight="duotone" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>Vocabulary</h1>
            <p className="font-medium text-slate-600">Daily words for your level, plus a quick quiz.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Beginner", "Intermediate", "Advanced"].map((l) => (
            <button key={l} data-testid={`vocab-level-${l}`} onClick={() => setLevel(l)}
              className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${level === l ? "border-amber-500 bg-amber-400 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-amber-200"}`}>
              {l}
            </button>
          ))}
        </div>
      </header>

      <div className="flex gap-2">
        <button data-testid="vocab-learn-tab" onClick={() => setMode("learn")}
          className={`rounded-xl px-4 py-2 font-bold ${mode === "learn" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>Learn</button>
        <button data-testid="vocab-quiz-tab" onClick={startQuiz}
          className={`rounded-xl px-4 py-2 font-bold ${mode === "quiz" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>Take quiz</button>
      </div>

      {mode === "learn" && (
        <div>
          {loading && <div className="rounded-3xl border-2 border-slate-100 bg-white p-10 text-center font-bold text-slate-500">Loading…</div>}
          {!loading && words.length > 0 && (
            <div className="rounded-3xl border-2 border-slate-100 bg-white p-6 md:p-8" data-testid="vocab-card">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600">Word {idx + 1} / {words.length}</div>
              <div className="mt-2 flex items-end gap-3">
                <h2 className="text-4xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>{words[idx]?.word}</h2>
                <button onClick={() => speak(words[idx].word)} data-testid="vocab-speak-button" className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-600 hover:bg-sky-200">
                  <SpeakerHigh weight="duotone" />
                </button>
              </div>
              <div className="mt-1 text-sm font-mono text-slate-500">{words[idx]?.pronunciation} · {words[idx]?.part_of_speech}</div>
              <div className="mt-4 font-medium text-slate-700">{words[idx]?.definition}</div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 font-medium italic text-slate-700">"{words[idx]?.example}"</div>
              {words[idx]?.synonyms?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {words[idx].synonyms.map((s, i) => (
                    <span key={i} className="rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-700">{s}</span>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <button data-testid="vocab-prev" onClick={() => setIdx((i) => Math.max(0, i - 1))} className="flex items-center gap-1 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:border-slate-300">
                  <CaretLeft /> Prev
                </button>
                <button data-testid="vocab-next" onClick={() => setIdx((i) => Math.min(words.length - 1, i + 1))} className="flex items-center gap-1 rounded-xl border-b-4 border-sky-600 bg-sky-400 px-5 py-2 font-bold text-white hover:bg-sky-500">
                  Next <CaretRight />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "quiz" && (
        <div>
          {loading && <div className="rounded-3xl border-2 border-slate-100 bg-white p-10 text-center font-bold text-slate-500">Building quiz…</div>}
          {!loading && quiz && (
            <div className="space-y-4" data-testid="vocab-quiz">
              {quiz.questions.map((q, i) => (
                <div key={i} className="rounded-2xl border-2 border-slate-100 bg-white p-5">
                  <div className="font-extrabold text-slate-900">Q{i + 1}. {q.question}</div>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {q.options.map((opt, oi) => {
                      const picked = answers[i] === oi;
                      const correct = revealed && oi === q.correct_index;
                      const wrong = revealed && picked && oi !== q.correct_index;
                      return (
                        <button key={oi}
                          data-testid={`quiz-q${i}-opt${oi}`}
                          disabled={revealed}
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
                  {revealed && <div className="mt-3 rounded-xl bg-slate-50 p-3 font-medium text-slate-700">{q.explanation}</div>}
                </div>
              ))}
              {!revealed ? (
                <button data-testid="quiz-submit" onClick={() => setRevealed(true)} className="rounded-xl border-b-4 border-amber-600 bg-amber-400 px-5 py-3 font-bold text-white hover:bg-amber-500">
                  Reveal answers
                </button>
              ) : (
                <div className="rounded-2xl border-2 border-slate-100 bg-white p-5 text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Score</div>
                  <div className="text-3xl font-extrabold text-slate-900">{correctCount} / {quiz.questions.length}</div>
                  <button data-testid="quiz-retry" onClick={startQuiz} className="mt-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:border-sky-200">
                    New quiz
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
