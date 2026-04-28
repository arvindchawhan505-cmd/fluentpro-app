import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { PaperPlaneRight, SpeakerHigh, ChatsCircle, Sparkle, Microphone, Stop } from "@phosphor-icons/react";

const SCENARIOS = [
  { key: "general", label: "Free chat" },
  { key: "restaurant", label: "At a cafe" },
  { key: "job_interview", label: "Job interview" },
  { key: "travel", label: "Travel booking" },
  { key: "small_talk", label: "Small talk" },
];

export default function Conversation() {
  const [scenario, setScenario] = useState("general");
  const [sessionId] = useState(() => `sess_${Date.now()}`);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const { data } = await api.post("/conversation", { session_id: sessionId, message: text, scenario });
      setMessages((m) => [...m, { role: "assistant", content: data.reply, corrections: data.corrections || [], suggestion: data.suggestion || "", options: data.options || [] }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, something went wrong. Let's continue 😊" }]);
    } finally {
      setLoading(false);
    }
  };

  const speak = async (text) => {
    try {
      const resp = await api.post("/tts", { text, voice: "nova" }, { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const audio = new Audio(url);
      audio.play();
    } catch { /* noop */ }
  };

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
        setInput(text);
        // Auto-send the recognized phrase
        send(text);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="flex flex-col gap-4" data-testid="conversation-page">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
          <ChatsCircle weight="duotone" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>
            Conversation practice
          </h1>
          <p className="font-medium text-slate-600">Chat naturally. Coach Ada gently corrects inline.</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2" data-testid="scenario-picker">
        {SCENARIOS.map((s) => (
          <button
            key={s.key}
            data-testid={`scenario-${s.key}`}
            onClick={() => setScenario(s.key)}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition ${
              scenario === s.key ? "border-indigo-500 bg-gradient-to-r from-blue-500 to-violet-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="h-[60vh] overflow-y-auto rounded-3xl border-2 border-slate-100 bg-white p-4 md:p-6"
        data-testid="conversation-messages"
      >
        <div className="space-y-3">
          {messages.length === 0 && !loading && (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center text-center" data-testid="conversation-empty-state">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-md">
                <ChatsCircle weight="duotone" size={28} />
              </div>
              <p className="mt-4 max-w-xs font-medium text-slate-500">
                Say "hi" to start — or tap the mic to speak.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[88%] flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`relative rounded-2xl p-3 ${
                    m.role === "user" ? "rounded-tr-md bg-gradient-to-br from-blue-500 to-violet-500 text-white" : "rounded-tl-md border-2 border-slate-100 bg-slate-50 text-slate-800"
                  }`}
                >
                  <div className="whitespace-pre-wrap font-medium">{m.content}</div>
                  {m.role === "assistant" && (
                    <button
                      onClick={() => speak(m.content)}
                      data-testid={`speak-message-${i}`}
                      className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500 shadow-sm hover:text-indigo-600"
                    >
                      <SpeakerHigh weight="duotone" size={14} /> Listen
                    </button>
                  )}
                </div>

                {m.role === "assistant" && m.corrections?.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-2.5 text-sm" data-testid={`corrections-${i}`}>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">Quick fix</div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.corrections.map((c, ci) => (
                        <span key={ci} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold shadow-sm">
                          <span className="text-rose-600 line-through">{c.original}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-emerald-700">{c.correction}</span>
                        </span>
                      ))}
                    </div>
                    {m.corrections[0]?.note && <div className="mt-2 text-xs font-medium text-amber-800">{m.corrections[0].note}</div>}
                  </div>
                )}

                {m.role === "assistant" && m.suggestion && (
                  <div className="inline-flex items-start gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-2.5 text-sm" data-testid={`suggestion-${i}`}>
                    <Sparkle weight="fill" size={14} className="mt-0.5 shrink-0 text-indigo-500" />
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Better way to say it</div>
                      <div className="mt-0.5 font-medium text-indigo-900">{m.suggestion}</div>
                    </div>
                  </div>
                )}

                {m.role === "assistant" && m.options?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1" data-testid={`conversation-options-${i}`}>
                    {m.options.map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => send(opt)}
                        disabled={loading}
                        data-testid={`conversation-option-${i}-${oi}`}
                        className="rounded-full border-2 border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[60%] rounded-2xl rounded-tl-md border-2 border-slate-100 bg-slate-50 p-3 text-slate-500">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400"></span>
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.1s" }}></span>
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.2s" }}></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2"
      >
        <input
          data-testid="conversation-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Listening…" : "Type your message…"}
          className="w-full rounded-xl border-2 border-slate-200 bg-white p-4 font-medium text-slate-900 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-200"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={startRecording}
            data-testid="conversation-mic-button"
            aria-label={listening ? "Stop recording" : "Start voice input"}
            title={listening ? "Stop recording" : "Speak your message"}
            className={`relative rounded-xl border-b-4 px-5 py-4 font-bold text-white transition active:translate-y-1 active:border-b-0 ${
              listening
                ? "border-rose-700 bg-gradient-to-r from-rose-500 to-rose-600 animate-pulse"
                : "border-emerald-700 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            }`}
          >
            {listening ? <Stop weight="fill" size={20} /> : <Microphone weight="fill" size={20} />}
          </button>
        )}
        <button
          type="submit"
          data-testid="conversation-send-button"
          disabled={loading || !input.trim()}
          className="relative rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-4 font-bold text-white transition hover:from-blue-600 hover:to-violet-600 active:translate-y-1 active:border-b-0 disabled:opacity-50"
        >
          <PaperPlaneRight weight="fill" size={20} />
        </button>
      </form>
    </div>
  );
}
