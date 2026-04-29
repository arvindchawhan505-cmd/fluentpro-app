import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChatsCircle, BookBookmark, Microphone, PencilSimpleLine, Stop,
  ArrowRight, CheckCircle, X, PaperPlaneRight, Trophy, Fire, Rocket, Sparkle,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { celebrate } from "@/lib/celebrate";
import { useAuth } from "@/context/AuthContext";
import { track, EVT } from "@/lib/analytics";
import CorrectionCard from "@/components/CorrectionCard";

const STEPS = ["chat", "vocab", "speak", "write"];
const STEP_LABEL = { chat: "Chat", vocab: "Vocabulary", speak: "Speaking", write: "Writing" };

export default function Mission() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [mission, setMission] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [final, setFinal] = useState(null); // mission summary after /complete
  const [xpFlash, setXpFlash] = useState(null);

  // Load mission, jump to next incomplete step on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/mission/today");
        setMission(data);
        if (data.completed) {
          // Already done today — show completion screen straight away
          setFinal(data);
          return;
        }
        const nextIdx = STEPS.findIndex((s) => !data.tasks.find((t) => t.key === s)?.done);
        setStepIdx(nextIdx === -1 ? STEPS.length - 1 : nextIdx);
      } catch { /* noop */ }
    })();
  }, []);

  // After every task completion, the child component calls onTaskComplete → we
  // refresh mission state, flash XP, then auto-advance (or trigger /complete).
  const onTaskComplete = async (taskKey, xpAwarded) => {
    if (xpAwarded > 0) {
      setXpFlash({ xp: xpAwarded, key: taskKey });
      setTimeout(() => setXpFlash(null), 1400);
    }
    try {
      const { data } = await api.get("/mission/today");
      setMission(data);
      const nextIdx = STEPS.findIndex((s) => !data.tasks.find((t) => t.key === s)?.done);
      if (nextIdx === -1) {
        await finalize();
      } else {
        // Slight pause so the user can read the feedback, then advance.
        setTimeout(() => setStepIdx(nextIdx), 1100);
      }
    } catch { /* noop */ }
  };

  const finalize = async () => {
    setCompleting(true);
    try {
      const { data } = await api.post("/mission/complete");
      setFinal(data);
      track(EVT.DAILY_PATH_CLAIMED, { source: "mission", xp: data.xp_earned });
      track(EVT.DAY1_COMPLETED, { source: "mission" });
      celebrate({ intensity: "big" });
      await refreshUser();
    } catch { /* noop */ }
    setCompleting(false);
  };

  // ------- Completion screen -------
  if (final) {
    return <CompletionScreen mission={final} onDone={() => navigate("/dashboard", { replace: true })} />;
  }

  if (!mission) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 h-64 w-full animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  const currentKey = STEPS[stepIdx];
  const currentTask = mission.tasks.find((t) => t.key === currentKey);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-slate-50 px-4 py-6 md:px-8 md:py-10">
      {/* Top bar */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          data-testid="mission-exit"
          aria-label="Exit mission"
          className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-500 hover:text-slate-900"
        >
          <X weight="bold" size={18} />
        </button>
        <div className="flex-1">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500"
              initial={{ width: 0 }}
              animate={{ width: `${(mission.tasks_done / mission.tasks_total) * 100}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 18 }}
              data-testid="mission-progress-bar"
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>Step {stepIdx + 1} of {STEPS.length}</span>
            <span className="text-violet-700">{STEP_LABEL[currentKey]}</span>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {currentKey === "chat" && <ChatStep key="chat" task={currentTask} onTaskComplete={onTaskComplete} />}
        {currentKey === "vocab" && <VocabStep key="vocab" task={currentTask} onTaskComplete={onTaskComplete} />}
        {currentKey === "speak" && <SpeakStep key="speak" task={currentTask} onTaskComplete={onTaskComplete} />}
        {currentKey === "write" && <WriteStep key="write" task={currentTask} onTaskComplete={onTaskComplete} />}
      </AnimatePresence>

      {/* XP flash */}
      <AnimatePresence>
        {xpFlash && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            data-testid="mission-xp-flash"
            className="pointer-events-none fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-full border-b-4 border-emerald-700 bg-gradient-to-r from-emerald-400 to-teal-500 px-5 py-2 font-extrabold text-white shadow-xl"
          >
            +{xpFlash.xp} XP 🎉
          </motion.div>
        )}
      </AnimatePresence>

      {completing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50">
          <div className="rounded-2xl bg-white px-6 py-4 font-bold text-slate-800">Saving your progress…</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Step 1 — Chat (2 messages with Coach Ada)
// ============================================================================
function ChatStep({ task, onTaskComplete }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(task.progress);
  const sessionId = useRef(`mission_${Date.now()}`).current;

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const { data } = await api.post("/conversation", { session_id: sessionId, message: text, scenario: "general" });
      setMessages((m) => [...m, {
        role: "assistant", content: data.reply, correction: data.correction || null,
      }]);
      const { data: m } = await api.post("/mission/progress", { task: "chat" });
      setProgress(m.tasks.find((t) => t.key === "chat").progress);
      if (m.task_just_completed) onTaskComplete("chat", m.xp_awarded_this_call);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 402) {
        setMessages((m) => [...m, { role: "assistant", content: "You're doing great! 🎉 Free limit reached. Please try again later or upgrade.", limitReached: true }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: "Sorry, something went wrong. Let's continue 😊" }]);
      }
    } finally { setSending(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      data-testid="mission-step-chat"
      className="flex flex-1 flex-col"
    >
      <StepHeader icon={ChatsCircle} color="blue" title="Chat with Coach Ada" subtitle={`Send ${task.target} messages · ${progress}/${task.target}`} />
      <div className="mt-5 min-h-[260px] flex-1 space-y-3 rounded-3xl border-2 border-blue-100 bg-white p-4">
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm font-medium text-slate-500">Say "hi" or share something about your day 😊</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] space-y-2 ${m.role === "user" ? "text-right" : "text-left"}`}>
              <div className={`inline-block rounded-2xl px-3 py-2 text-sm font-medium ${
                m.role === "user" ? "bg-gradient-to-br from-blue-500 to-violet-500 text-white" : m.limitReached ? "border-2 border-amber-200 bg-amber-50 text-amber-900" : "border-2 border-slate-100 bg-slate-50 text-slate-800"
              }`}>{m.content}</div>
              {m.correction && <CorrectionCard correction={m.correction} testId={`mission-chat-correction-${i}`} />}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2">
        <input
          data-testid="mission-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          autoFocus
          className="w-full rounded-xl border-2 border-slate-200 bg-white p-3.5 font-medium text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-200"
        />
        <button type="submit" disabled={sending || !input.trim()} data-testid="mission-chat-send"
          className="rounded-xl border-b-4 border-violet-700 bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3.5 font-bold text-white active:translate-y-1 active:border-b-0 disabled:opacity-50">
          <PaperPlaneRight weight="fill" size={18} />
        </button>
      </form>
    </motion.div>
  );
}

// ============================================================================
// Step 2 — Vocabulary (2 MCQ questions)
// ============================================================================
function VocabStep({ task, onTaskComplete }) {
  const [questions, setQuestions] = useState(null);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [progress, setProgress] = useState(task.progress);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.post("/vocabulary/quiz", { count: 2, level: "Beginner" });
        const qs = (data?.questions || []).slice(0, 2);
        setQuestions(qs.length === 2 ? qs : FALLBACK_QUIZ);
      } catch { setQuestions(FALLBACK_QUIZ); }
    })();
  }, []);

  const choose = async (i) => {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === questions[qi].correct_index;
    setTimeout(async () => {
      try {
        const { data: m } = await api.post("/mission/progress", { task: "vocab" });
        setProgress(m.tasks.find((t) => t.key === "vocab").progress);
        if (m.task_just_completed) {
          onTaskComplete("vocab", m.xp_awarded_this_call);
          return;
        }
      } catch { /* noop */ }
      setPicked(null);
      setQi((n) => n + 1);
      // ignore `correct` for progress logic — even wrong answer counts as practice
      void correct;
    }, 1200);
  };

  if (!questions) return <StepLoading icon={BookBookmark} color="amber" />;
  const q = questions[Math.min(qi, questions.length - 1)];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      data-testid="mission-step-vocab"
      className="flex-1"
    >
      <StepHeader icon={BookBookmark} color="amber" title="Quick vocabulary" subtitle={`${progress}/${task.target} · Tap the correct meaning`} />
      <div className="mt-5 rounded-3xl border-2 border-amber-100 bg-white p-5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Question {qi + 1}</div>
        <h3 className="mt-1 text-xl font-extrabold text-slate-900">{q.question}</h3>
        <div className="mt-4 space-y-2">
          {q.options.map((opt, i) => {
            const isPicked = picked === i;
            const isCorrect = i === q.correct_index;
            const isWrong = isPicked && !isCorrect;
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={picked !== null}
                data-testid={`mission-vocab-option-${i}`}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border-2 p-3 text-left font-bold transition ${
                  picked === null
                    ? "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50"
                    : isCorrect
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                    : isWrong
                    ? "border-rose-400 bg-rose-50 text-rose-900"
                    : "border-slate-200 bg-white opacity-70"
                }`}
              >
                <span>{opt}</span>
                {picked !== null && isCorrect && <CheckCircle weight="fill" size={18} className="text-emerald-600" />}
                {isWrong && <X weight="bold" size={18} className="text-rose-500" />}
              </button>
            );
          })}
        </div>
        {picked !== null && q.explanation && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            💡 {q.explanation}
          </div>
        )}
      </div>
    </motion.div>
  );
}

const FALLBACK_QUIZ = [
  { question: "What does 'reliable' mean?", options: ["Untrustworthy", "Always available and trustworthy", "Loud", "Slow"], correct_index: 1, explanation: "Reliable = you can depend on it." },
  { question: "Choose the synonym of 'happy'.", options: ["Sad", "Joyful", "Tired", "Angry"], correct_index: 1, explanation: "Happy and joyful both mean feeling pleased." },
];

// ============================================================================
// Step 3 — Speaking (1 sentence pronunciation)
// ============================================================================
function SpeakStep({ task, onTaskComplete }) {
  const [sentence, setSentence] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [score, setScore] = useState(null);
  const [supported, setSupported] = useState(false);
  const recogRef = useRef(null);

  useEffect(() => {
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    (async () => {
      try { const { data } = await api.get("/pronunciation/sentence"); setSentence(data.sentence); }
      catch { setSentence("The weather is nice today."); }
    })();
  }, []);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { skip(); return; }
    if (recording) { try { recogRef.current?.stop(); } catch { /* noop */ } return; }
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1;
    r.onstart = () => setRecording(true);
    r.onerror = () => setRecording(false);
    r.onend = () => setRecording(false);
    r.onresult = async (ev) => {
      const text = ev.results?.[0]?.[0]?.transcript?.trim() || "";
      setTranscript(text);
      // Compute simple word-overlap score against target sentence
      const tgt = (sentence || "").toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
      const got = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
      const matched = got.filter((w) => tgt.includes(w)).length;
      const calc = tgt.length === 0 ? 70 : Math.round((matched / tgt.length) * 100);
      setScore(Math.max(40, Math.min(100, calc)));
      try {
        const { data: m } = await api.post("/mission/progress", { task: "speak" });
        if (m.task_just_completed) onTaskComplete("speak", m.xp_awarded_this_call);
      } catch { /* noop */ }
    };
    recogRef.current = r;
    r.start();
  };

  // Fallback: browsers without SpeechRecognition can mark this complete by tapping "I said it".
  const skip = async () => {
    setScore(80);
    setTranscript("(Voice not supported on this browser — marked as practiced.)");
    try {
      const { data: m } = await api.post("/mission/progress", { task: "speak" });
      if (m.task_just_completed) onTaskComplete("speak", m.xp_awarded_this_call);
    } catch { /* noop */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      data-testid="mission-step-speak"
      className="flex-1"
    >
      <StepHeader icon={Microphone} color="emerald" title="Speak this sentence" subtitle="Tap the mic and say it out loud" />
      <div className="mt-5 rounded-3xl border-2 border-emerald-100 bg-white p-6 text-center">
        <div className="text-2xl font-extrabold text-slate-900 md:text-3xl">"{sentence || "…"}"</div>
        <button
          onClick={supported ? start : skip}
          disabled={score !== null}
          data-testid="mission-speak-mic"
          className={`mt-6 inline-flex items-center gap-2 rounded-2xl border-b-4 px-6 py-3.5 font-extrabold text-white transition active:translate-y-1 active:border-b-0 disabled:opacity-60 ${
            recording
              ? "border-rose-700 bg-gradient-to-r from-rose-500 to-rose-600 animate-pulse"
              : "border-emerald-700 bg-gradient-to-r from-emerald-500 to-teal-500"
          }`}
        >
          {recording ? <Stop weight="fill" size={18} /> : <Microphone weight="fill" size={18} />}
          {recording ? "Listening…" : score !== null ? "Saved" : supported ? "Tap to speak" : "I said it"}
        </button>

        {score !== null && (
          <div className="mt-5 space-y-2">
            <div className="text-sm font-medium text-slate-500">You said:</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-800">{transcript || "—"}</div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-extrabold text-emerald-800">
              Score: {score}/100
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Step 4 — Writing (1 sentence, grammar feedback)
// ============================================================================
function WriteStep({ task, onTaskComplete }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/grammar/check", { text });
      setResult(data);
      const { data: m } = await api.post("/mission/progress", { task: "write" });
      if (m.task_just_completed) onTaskComplete("write", m.xp_awarded_this_call);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 402) {
        setResult({ corrected: text, score: 0, issues: [], _limit: true });
      } else {
        setResult({ corrected: text, score: 100, issues: [] });
        try {
          const { data: m } = await api.post("/mission/progress", { task: "write" });
          if (m.task_just_completed) onTaskComplete("write", m.xp_awarded_this_call);
        } catch { /* noop */ }
      }
    } finally { setSubmitting(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      data-testid="mission-step-write"
      className="flex-1"
    >
      <StepHeader icon={PencilSimpleLine} color="indigo" title="Write a sentence in English" subtitle="Anything — your day, a goal, a fun fact" />
      <div className="mt-5 rounded-3xl border-2 border-indigo-100 bg-white p-5">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your sentence here…"
          autoFocus
          disabled={!!result}
          data-testid="mission-write-input"
          className="w-full resize-none rounded-xl border-2 border-slate-200 bg-white p-4 font-medium text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-70"
        />
        {!result && (
          <button
            onClick={submit}
            disabled={!text.trim() || submitting}
            data-testid="mission-write-submit"
            className="mt-3 w-full rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3.5 font-extrabold text-white active:translate-y-1 active:border-b-0 disabled:opacity-50"
          >
            {submitting ? "Checking…" : "Check my writing"}
          </button>
        )}
        {result && (
          <div className="mt-4 space-y-3" data-testid="mission-write-result">
            {result._limit ? (
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                You're doing great! 🎉 Free limit reached — your sentence still counts toward today's mission.
              </div>
            ) : (
              <>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Corrected</div>
                  <div className="mt-1 rounded-xl bg-emerald-50 p-3 font-bold text-emerald-900">{result.corrected}</div>
                </div>
                {result.issues?.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Tips</div>
                    {result.issues.slice(0, 2).map((it, i) => (
                      <div key={i} className="mt-1 font-medium text-amber-900">💡 {it.explanation || it.note}</div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Helpers + Completion screen
// ============================================================================
function StepHeader({ icon: Icon, color, title, subtitle }) {
  const colorMap = {
    blue: "from-blue-500 to-violet-500",
    amber: "from-amber-400 to-orange-500",
    emerald: "from-emerald-500 to-teal-500",
    indigo: "from-blue-500 to-violet-500",
  };
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${colorMap[color]} text-white shadow-md`}>
        <Icon weight="fill" size={22} />
      </div>
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>{title}</h2>
        <p className="text-sm font-medium text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function StepLoading({ icon: Icon, color }) {
  return (
    <div className="flex-1">
      <StepHeader icon={Icon} color={color} title="Loading…" subtitle="One moment" />
      <div className="mt-5 h-48 animate-pulse rounded-3xl bg-slate-100" />
    </div>
  );
}

function CompletionScreen({ mission, onDone }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        data-testid="mission-completion"
        className="w-full overflow-hidden rounded-3xl border-2 border-emerald-200 bg-white shadow-2xl"
      >
        <div className="relative bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-500 p-8 text-center text-white">
          <div className="pointer-events-none absolute -top-10 right-0 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
          <Trophy weight="fill" size={60} className="mx-auto" />
          <h1 className="mt-2 text-4xl font-extrabold" style={{ fontFamily: "Nunito, sans-serif" }}>Mission Complete 🎉</h1>
          <p className="mt-1 text-sm font-medium opacity-95">Awesome job — see you tomorrow!</p>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="XP earned" value={`+${mission.xp_earned}`} icon={Sparkle} color="text-amber-600" bg="bg-amber-50" />
            <Stat label="Streak" value="+1 day 🔥" icon={Fire} color="text-rose-600" bg="bg-rose-50" />
          </div>
          <ul className="space-y-2 text-sm font-medium">
            {mission.tasks.map((t) => (
              <li key={t.key} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <span className="flex items-center gap-2 text-slate-700">
                  <CheckCircle weight="fill" size={16} className="text-emerald-500" />
                  {t.title}
                </span>
                <span className="text-xs font-bold text-emerald-700">+{t.xp}</span>
              </li>
            ))}
            <li className="flex items-center justify-between rounded-xl border border-violet-100 bg-violet-50 p-2.5">
              <span className="flex items-center gap-2 font-bold text-violet-800">
                <Rocket weight="fill" size={16} className="text-violet-600" />
                Mission bonus
              </span>
              <span className="text-xs font-extrabold text-violet-700">+{mission.completion_bonus}</span>
            </li>
          </ul>
          <button
            onClick={onDone}
            data-testid="mission-completion-done"
            className="w-full rounded-xl border-b-4 border-emerald-700 bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3.5 font-extrabold text-white active:translate-y-1 active:border-b-0"
          >
            Back to home
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, color, bg }) {
  return (
    <div className={`rounded-2xl border border-slate-100 ${bg} p-3 text-center`}>
      <Icon weight="fill" size={22} className={`mx-auto ${color}`} />
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}
