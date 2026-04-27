import React, { useState } from "react";
import { api } from "@/lib/api";
import { PencilSimpleLine, Sparkle } from "@phosphor-icons/react";

const PROMPTS = [
  "Describe a memorable trip you took.",
  "Write a polite email requesting a meeting reschedule.",
  "What are the pros and cons of remote work?",
  "Tell a story about a time you learned something the hard way.",
];

export default function Writing() {
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const { data } = await api.post("/writing/feedback", { text, prompt });
      setResult(data);
    } catch {
      setError("Could not generate feedback. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5 pb-24 md:pb-8" data-testid="writing-page">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100 text-green-600">
          <PencilSimpleLine weight="duotone" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>Writing feedback</h1>
          <p className="font-medium text-slate-600">Submit an essay or email. Get scores and an improved rewrite.</p>
        </div>
      </header>

      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Prompt</label>
        <div className="flex flex-wrap gap-2">
          {PROMPTS.map((p) => (
            <button key={p} data-testid={`writing-prompt-${p.slice(0,6)}`} onClick={() => setPrompt(p)}
              className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${prompt === p ? "border-green-500 bg-green-400 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <textarea data-testid="writing-input" value={text} onChange={(e) => setText(e.target.value)} rows={10}
        className="w-full rounded-2xl border-2 border-slate-200 bg-white p-4 font-medium text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-400/20"
        placeholder="Write your response here…" />

      <button onClick={submit} disabled={loading} data-testid="writing-submit-button"
        className="relative inline-flex items-center gap-2 rounded-xl border-b-4 border-green-600 bg-green-400 px-6 py-3 font-bold text-white hover:bg-green-500 disabled:opacity-50 active:translate-y-1 active:border-b-0">
        <Sparkle weight="duotone" /> {loading ? "Analyzing…" : "Get feedback"}
      </button>

      {error && <div className="rounded-xl bg-rose-50 p-3 text-rose-600">{error}</div>}

      {result && (
        <div className="space-y-4" data-testid="writing-result">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(result.scores || {}).map(([k, v]) => (
              <div key={k} className="rounded-2xl border-2 border-slate-100 bg-white p-4 text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{k}</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-900">{v}</div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border-2 border-slate-100 bg-white p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Summary</div>
            <div className="mt-1 font-medium text-slate-700">{result.summary}</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-green-100 bg-green-50 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-green-700">Strengths</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 font-medium text-green-900">
                {result.strengths?.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-amber-100 bg-amber-50 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Improvements</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 font-medium text-amber-900">
                {result.improvements?.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </div>
          <div className="rounded-3xl border-2 border-sky-100 bg-sky-50 p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-700">Suggested rewrite</div>
            <div className="mt-1 whitespace-pre-wrap font-medium text-sky-950">{result.rewrite}</div>
          </div>
        </div>
      )}
    </div>
  );
}
