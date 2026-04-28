import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { celebrate } from "@/lib/celebrate";
import { useAuth } from "@/context/AuthContext";
import {
  ChatsCircle, BookBookmark, Notebook, ArrowRight, CheckCircle, PaperPlaneRight,
  Sparkle, Lightning, Rocket, Microphone, Stop,
} from "@phosphor-icons/react";

const TOTAL = 3;

const VOCAB_WORD = {
  word: "reliable",
  pronunciation: "/rɪˈlaɪ.ə.bəl/",
  part_of_speech: "adjective",
  definition: "Consistently good in quality or performance — able to be trusted.",
  example: "She's the most reliable person on the team — she never misses a deadline.",
};

const GRAMMAR_SENTENCE = "Me and my friend goes to the cinema yesterday.";

export default function StartPractice() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState(null);
  const [chatOptions, setChatOptions] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [grammarResult, setGrammarResult] = useState(null);
  const [grammarLoading, setGrammarLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input isn't supported in this browser. Try Chrome or Edge on desktop.");
      return;
    }
    if (listening) {
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim() || "";
      if (text) {
        setChatInput(text);
        sendChat(text);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const sendChat = async (textOverride) => {
    const text = (textOverride ?? chatInput).trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatLoading(true);
    const nextTurnCount = userTurnCount + 1;
    setUserTurnCount(nextTurnCount);
    try {
      const { data } = await api.post("/conversation", {
        session_id: "day1_practice",
        message: text,
        scenario: "general",
      });
      setChatReply(data.reply);
      const opts = Array.isArray(data.options) ? data.options : [];
      setChatOptions(opts);
      // Advance only after the learner has had a real conversational exchange
      // (i.e. at least 2 user turns — first = greeting/topic-pick, second = real answer)
      // AND Coach Ada isn't still presenting the topic menu.
      if (opts.length === 0 && nextTurnCount >= 2) {
        setTimeout(() => setStep(2), 800);
      }
    } catch {
      setChatReply("Sorry, something went wrong. Let's continue 😊");
      setChatOptions([]);
      setTimeout(() => setStep(2), 800);
    } finally {
      setChatLoading(false);
    }
  };

  const checkGrammar = async () => {
    setGrammarLoading(true);
    try {
      const { data } = await api.post("/grammar/check", { text: GRAMMAR_SENTENCE });
      setGrammarResult(data);
    } catch {
      setGrammarResult({
        corrected: "My friend and I went to the cinema yesterday.",
        issues: [{ original: "Me and my friend goes", correction: "My friend and I went", rule: "Subject + tense", explanation: "Use 'I' as subject and past tense 'went'." }],
        score: 75,
      });
    } finally { setGrammarLoading(false); }
  };

  const finish = async () => {
    try { await api.post("/onboarding/day1/complete"); } catch { /* noop */ }
    await refreshUser();
    celebrate({ intensity: "big" });
    setShowSuccess(true);
  };

  const close = () => {
    setShowSuccess(false);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col bg-slate-50 px-4 py-6 md:px-8 md:py-10">
      {/* Top bar */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          data-testid="practice-skip-button"
          className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-white"
        >
          Skip for now
        </button>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <span data-testid="practice-step-counter">Step {step} of {TOTAL}</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="mb-8 h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(step / TOTAL) * 100}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500"
          data-testid="practice-progress-bar"
        />
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.section
            key="s1"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            data-testid="practice-step-1"
            className="rounded-3xl border-2 border-slate-100 bg-white p-6 md:p-8"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-700">
              <ChatsCircle weight="duotone" size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Step 1 · Chat</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>
              Say hello to Coach Ada 👋
            </h1>
            <p className="mt-2 max-w-md font-medium text-slate-600">
              Type any message — even just "hi". Coach Ada will reply.
            </p>

            {chatReply && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 max-w-[88%] rounded-2xl rounded-tl-md border-2 border-slate-100 bg-slate-50 p-3 text-slate-800">
                {chatReply}
              </motion.div>
            )}

            {chatOptions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" data-testid="practice-chat-options">
                {chatOptions.map((opt, oi) => (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => sendChat(opt)}
                    disabled={chatLoading}
                    data-testid={`practice-chat-option-${oi}`}
                    className="rounded-full border-2 border-indigo-200 bg-white px-4 py-2 text-sm font-bold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="mt-5 flex gap-2">
              <input
                data-testid="practice-chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={listening ? "Listening…" : "Hi Coach!"}
                className="w-full rounded-xl border-2 border-slate-200 bg-white p-3.5 font-medium text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-200"
                autoFocus
              />
              {voiceSupported && (
                <button
                  type="button"
                  onClick={startRecording}
                  data-testid="practice-chat-mic"
                  aria-label={listening ? "Stop recording" : "Speak your message"}
                  className={`relative rounded-xl border-b-4 px-5 py-3.5 font-bold text-white transition active:translate-y-1 active:border-b-0 ${
                    listening
                      ? "border-rose-700 bg-gradient-to-r from-rose-500 to-rose-600 animate-pulse"
                      : "border-emerald-700 bg-gradient-to-r from-emerald-500 to-teal-500"
                  }`}
                >
                  {listening ? <Stop weight="fill" size={18} /> : <Microphone weight="fill" size={18} />}
                </button>
              )}
              <button
                type="submit"
                data-testid="practice-chat-send"
                disabled={chatLoading || !chatInput.trim()}
                className="relative rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3.5 font-bold text-white transition active:translate-y-1 active:border-b-0 disabled:opacity-50"
              >
                {chatLoading ? "…" : <PaperPlaneRight weight="fill" size={18} />}
              </button>
            </form>
          </motion.section>
        )}

        {step === 2 && (
          <motion.section
            key="s2"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            data-testid="practice-step-2"
            className="rounded-3xl border-2 border-slate-100 bg-white p-6 md:p-8"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-700">
              <BookBookmark weight="duotone" size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Step 2 · Vocabulary</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>
              Learn one word
            </h1>
            <div className="mt-5 rounded-3xl border-2 border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6">
              <div className="flex items-baseline gap-3">
                <h2 className="text-4xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>{VOCAB_WORD.word}</h2>
                <span className="font-mono text-sm text-slate-500">{VOCAB_WORD.pronunciation}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 shadow-sm">{VOCAB_WORD.part_of_speech}</span>
              </div>
              <div className="mt-3 font-medium text-slate-700">{VOCAB_WORD.definition}</div>
              <div className="mt-4 rounded-2xl bg-white/70 p-3 font-medium italic text-slate-700">"{VOCAB_WORD.example}"</div>
            </div>
            <button
              onClick={() => setStep(3)}
              data-testid="practice-vocab-understand"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border-b-4 border-amber-700 bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 font-bold text-white transition active:translate-y-1 active:border-b-0"
            >
              <CheckCircle weight="fill" size={18} /> I Understand
            </button>
          </motion.section>
        )}

        {step === 3 && (
          <motion.section
            key="s3"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            data-testid="practice-step-3"
            className="rounded-3xl border-2 border-slate-100 bg-white p-6 md:p-8"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
              <Notebook weight="duotone" size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Step 3 · Grammar</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>
              Spot the mistake
            </h1>
            <p className="mt-2 font-medium text-slate-600">Tap below to see the correction.</p>

            <div className="mt-5 rounded-3xl border-2 border-rose-100 bg-rose-50 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-rose-700">Original</div>
              <div className="mt-1 text-lg font-extrabold text-slate-900">{GRAMMAR_SENTENCE}</div>
            </div>

            {grammarResult && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-3xl border-2 border-emerald-100 bg-emerald-50 p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Corrected</div>
                <div className="mt-1 text-lg font-extrabold text-slate-900">{grammarResult.corrected}</div>
                {grammarResult.issues?.[0] && (
                  <div className="mt-3 text-sm font-medium text-emerald-900">
                    <b>{grammarResult.issues[0].rule}:</b> {grammarResult.issues[0].explanation}
                  </div>
                )}
              </motion.div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!grammarResult ? (
                <button
                  onClick={checkGrammar}
                  disabled={grammarLoading}
                  data-testid="practice-grammar-check"
                  className="inline-flex items-center gap-2 rounded-xl border-b-4 border-emerald-700 bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 font-bold text-white transition active:translate-y-1 active:border-b-0 disabled:opacity-50"
                >
                  {grammarLoading ? "Checking…" : "Check Grammar"}
                </button>
              ) : (
                <button
                  onClick={finish}
                  data-testid="practice-finish"
                  className="inline-flex items-center gap-2 rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3.5 font-extrabold text-white transition active:translate-y-1 active:border-b-0"
                >
                  Finish practice <ArrowRight weight="bold" />
                </button>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Success modal */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            data-testid="practice-success-modal"
            onClick={close}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 250, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-white p-8 text-center shadow-2xl"
            >
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-lg">
                <Rocket weight="fill" size={36} />
              </div>
              <h2 className="mt-4 text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>
                Great job! 🔥 +10 XP
              </h2>
              <p className="mt-1 font-medium text-slate-600">You're improving already.</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
                <Lightning weight="fill" size={14} />
                <span className="text-sm font-bold">Streak +1 day · Day-1 unlocked</span>
              </div>
              <button
                onClick={close}
                data-testid="practice-success-continue"
                className="mt-6 w-full rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 font-extrabold text-white"
              >
                Explore your dashboard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
