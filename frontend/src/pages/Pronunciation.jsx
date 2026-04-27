import React, { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Microphone, Stop, SpeakerHigh, ArrowClockwise } from "@phosphor-icons/react";

export default function Pronunciation() {
  const [sentence, setSentence] = useState("");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const loadSentence = async () => {
    setResult(null); setError("");
    const { data } = await api.post("/pronunciation/sentence");
    setSentence(data.sentence);
  };

  React.useEffect(() => { loadSentence(); }, []);

  const speakTarget = async () => {
    if (!sentence) return;
    try {
      const r = await api.post("/tts", { text: sentence, voice: "nova" }, { responseType: "blob" });
      new Audio(URL.createObjectURL(r.data)).play();
    } catch { /* noop */ }
  };

  const start = async () => {
    setError(""); setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        form.append("target", sentence);
        setProcessing(true);
        try {
          const { data } = await api.post("/pronunciation/check", form, { headers: { "Content-Type": "multipart/form-data" } });
          setResult(data);
        } catch {
          setError("Could not grade pronunciation. Please try again.");
        } finally { setProcessing(false); }
      };
      mr.start();
      setRecording(true);
    } catch {
      setError("Microphone permission is required.");
    }
  };

  const stop = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="space-y-5 pb-24 md:pb-8" data-testid="pronunciation-page">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <Microphone weight="duotone" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>Pronunciation</h1>
          <p className="font-medium text-slate-600">Read the sentence aloud. Get instant scoring.</p>
        </div>
      </header>

      <div className="rounded-3xl border-2 border-slate-100 bg-white p-6">
        <div className="text-xs font-bold uppercase tracking-wider text-rose-600">Read aloud</div>
        <div className="mt-1 text-2xl font-extrabold leading-snug text-slate-900" data-testid="pronunciation-target" style={{ fontFamily: "Nunito, sans-serif" }}>
          {sentence || "Loading…"}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={speakTarget} data-testid="pronunciation-listen-button" className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:border-sky-200">
            <SpeakerHigh weight="duotone" /> Listen
          </button>
          <button onClick={loadSentence} data-testid="pronunciation-new-sentence" className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:border-sky-200">
            <ArrowClockwise weight="duotone" /> New sentence
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-slate-100 bg-white p-6">
        {!recording ? (
          <button onClick={start} disabled={processing} data-testid="start-recording-button"
            className="relative flex h-24 w-24 items-center justify-center rounded-full border-b-4 border-rose-600 bg-rose-400 text-white transition hover:bg-rose-500 active:translate-y-1 active:border-b-0 disabled:opacity-50">
            <Microphone weight="fill" size={40} />
          </button>
        ) : (
          <button onClick={stop} data-testid="stop-recording-button"
            className="relative flex h-24 w-24 animate-pulse items-center justify-center rounded-full border-b-4 border-rose-700 bg-rose-500 text-white">
            <Stop weight="fill" size={40} />
          </button>
        )}
        <div className="text-sm font-bold text-slate-500">
          {processing ? "Grading your pronunciation…" : recording ? "Listening…" : "Tap to record"}
        </div>
        {error && <div className="rounded-xl bg-rose-50 p-2 text-rose-600">{error}</div>}
      </div>

      {result && (
        <div className="space-y-3" data-testid="pronunciation-result">
          <div className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-slate-100 bg-white p-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-100">
              <div className="text-2xl font-extrabold text-rose-600">{result.score}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Accuracy</div>
              <div className="font-extrabold text-slate-900">{result.accuracy}</div>
              <div className="mt-1 text-sm font-medium text-slate-600">You said: "{result.transcription}"</div>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-slate-100 bg-white p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Coach tip</div>
            <div className="mt-1 font-medium text-slate-700">{result.tip}</div>
            {result.missed_words?.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-bold text-slate-500">Missed:</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {result.missed_words.map((w, i) => <span key={i} className="rounded-full bg-rose-50 px-2 py-0.5 text-sm font-bold text-rose-600">{w}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
