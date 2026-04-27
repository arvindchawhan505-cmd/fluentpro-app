import React, { useState } from "react";
import { api } from "@/lib/api";
import { CheckCircle, Warning, Notebook } from "@phosphor-icons/react";

export default function Grammar() {
  const [text, setText] = useState("Me and my friend goes to the cinema yesterday because we wants to watch movie.");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const check = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const { data } = await api.post("/grammar/check", { text });
      setResult(data);
    } catch {
      setError("Could not analyze text. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-24 md:pb-8" data-testid="grammar-page">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100 text-green-600">
          <Notebook weight="duotone" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>Grammar check</h1>
          <p className="font-medium text-slate-600">Paste any English text. Get corrections with rule explanations.</p>
        </div>
      </header>

      <textarea
        data-testid="grammar-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="w-full rounded-2xl border-2 border-slate-200 bg-white p-4 font-medium text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-400/20"
        placeholder="Write or paste text here…"
      />
      <button
        onClick={check}
        disabled={loading}
        data-testid="grammar-check-button"
        className="relative rounded-xl border-b-4 border-green-600 bg-green-400 px-6 py-3 font-bold text-white transition hover:bg-green-500 active:translate-y-1 active:border-b-0 disabled:opacity-50"
      >
        {loading ? "Analyzing…" : "Check grammar"}
      </button>

      {error && <div className="rounded-xl bg-rose-50 p-3 text-rose-600">{error}</div>}

      {result && (
        <div className="space-y-4" data-testid="grammar-result">
          <div className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-slate-100 bg-white p-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-100">
              <div className="text-2xl font-extrabold text-sky-600">{result.score}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Overall</div>
              <div className="font-medium text-slate-700">{result.overall_feedback}</div>
            </div>
          </div>

          <div className="rounded-3xl border-2 border-slate-100 bg-white p-6">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Corrected version</div>
            <div className="whitespace-pre-wrap font-medium text-slate-900">{result.corrected}</div>
          </div>

          <div className="space-y-3">
            {(result.issues || []).map((iss, i) => (
              <div key={i} className="rounded-2xl border-2 border-slate-100 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Warning weight="duotone" className="text-amber-500" />
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-sm font-bold text-rose-600 line-through">{iss.original}</span>
                  <span className="text-slate-500">→</span>
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-sm font-bold text-green-700">{iss.correction}</span>
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-500">{iss.rule}</span>
                </div>
                <div className="mt-2 font-medium text-slate-600">{iss.explanation}</div>
              </div>
            ))}
            {(!result.issues || result.issues.length === 0) && (
              <div className="flex items-center gap-2 rounded-2xl border-2 border-green-100 bg-green-50 p-4 text-green-700">
                <CheckCircle weight="duotone" /> No issues found. Great job!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
