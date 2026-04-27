import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { PaperPlaneRight, SpeakerHigh, ChatsCircle } from "@phosphor-icons/react";

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
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm Coach Ada. What would you like to talk about today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const { data } = await api.post("/conversation", { session_id: sessionId, message: text, scenario });
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ Sorry, I couldn't respond. Please try again." }]);
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
              scenario === s.key ? "border-sky-500 bg-sky-400 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-sky-200"
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
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`relative max-w-[85%] rounded-2xl p-3 ${
                  m.role === "user" ? "rounded-tr-md bg-sky-400 text-white" : "rounded-tl-md border-2 border-slate-100 bg-slate-50 text-slate-800"
                }`}
              >
                <div className="whitespace-pre-wrap font-medium">{m.content}</div>
                {m.role === "assistant" && (
                  <button
                    onClick={() => speak(m.content)}
                    data-testid={`speak-message-${i}`}
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500 shadow-sm hover:text-sky-600"
                  >
                    <SpeakerHigh weight="duotone" size={14} /> Listen
                  </button>
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
          placeholder="Type your message…"
          className="w-full rounded-xl border-2 border-slate-200 bg-white p-4 font-medium text-slate-900 transition focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-400/20"
        />
        <button
          type="submit"
          data-testid="conversation-send-button"
          disabled={loading || !input.trim()}
          className="relative rounded-xl border-b-4 border-sky-600 bg-sky-400 px-5 py-4 font-bold text-white transition hover:bg-sky-500 active:translate-y-1 active:border-b-0 disabled:opacity-50"
        >
          <PaperPlaneRight weight="fill" size={20} />
        </button>
      </form>
    </div>
  );
}
