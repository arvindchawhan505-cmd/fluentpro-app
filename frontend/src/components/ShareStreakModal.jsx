import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Flame, Star, Trophy, Download, ShareNetwork, X, WhatsappLogo, InstagramLogo } from "@phosphor-icons/react";

export default function ShareStreakModal({ open, onClose }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [theme, setTheme] = useState("sunrise");
  const cardRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await api.get("/share/streak");
      setData(data);
    })();
  }, [open]);

  if (!open) return null;

  const themes = {
    sunrise: { bg: "linear-gradient(135deg, #fb923c 0%, #f43f5e 60%, #8b5cf6 100%)", accent: "#fff7ed" },
    ocean: { bg: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)", accent: "#e0f2fe" },
    mint: { bg: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)", accent: "#ecfdf5" },
  };

  const renderCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    canvas.width = 1080; canvas.height = 1080;

    // background gradient
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    if (theme === "sunrise") { grad.addColorStop(0, "#fb923c"); grad.addColorStop(0.6, "#f43f5e"); grad.addColorStop(1, "#8b5cf6"); }
    else if (theme === "ocean") { grad.addColorStop(0, "#0ea5e9"); grad.addColorStop(1, "#6366f1"); }
    else { grad.addColorStop(0, "#10b981"); grad.addColorStop(1, "#06b6d4"); }
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1080);

    // soft circles
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath(); ctx.arc(900, 200, 220, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(160, 880, 180, 0, Math.PI * 2); ctx.fill();

    // brand pill
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, 80, 80, 360, 80, 40); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 36px Nunito, sans-serif";
    ctx.fillText("FluentPro", 110, 132);

    // big streak number
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 320px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${data.streak}`, 540, 580);
    ctx.font = "800 60px Nunito, sans-serif";
    ctx.fillText(`day streak 🔥`, 540, 660);

    // name
    ctx.font = "700 44px Manrope, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`${data.name?.split(" ")[0] || "Learner"}'s English journey`, 540, 240);

    // stats row
    ctx.textAlign = "left";
    drawStat(ctx, 140, 780, "XP", `${data.xp}`);
    drawStat(ctx, 460, 780, "Level", data.level);
    drawStat(ctx, 780, 780, "Lessons", `${data.completed_lessons}`);

    // tag
    ctx.textAlign = "center";
    ctx.font = "700 32px Manrope, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText("Practicing English daily with Coach Ada", 540, 980);

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  };

  const download = async () => {
    const blob = await renderCanvas();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `english-coach-streak-${data.streak}.png`;
    a.click(); URL.revokeObjectURL(url);
  };

  const nativeShare = async () => {
    const blob = await renderCanvas();
    if (!blob) return;
    const file = new File([blob], `streak-${data.streak}.png`, { type: "image/png" });
    const shareData = {
      title: "My FluentPro streak",
      text: data.share_text,
      files: [file],
    };
    if (navigator.canShare?.(shareData)) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else if (navigator.share) {
      try { await navigator.share({ title: shareData.title, text: shareData.text, url: window.location.origin }); } catch { /* noop */ }
    } else {
      await download();
      alert("Image downloaded. Open WhatsApp/Instagram and attach the saved image.");
    }
  };

  const whatsapp = () => {
    const text = encodeURIComponent(`${data.share_text}\n${window.location.origin}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const instagram = async () => {
    await download();
    alert("Image saved! Open Instagram → New Post / Story → pick the saved image.");
  };

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
        <div className="rounded-2xl bg-white p-6 font-bold text-slate-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" data-testid="share-streak-modal" onClick={onClose}>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>Share your streak</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close" data-testid="share-close-button"><X /></button>
        </div>

        <div ref={cardRef} className="mt-4 aspect-square w-full overflow-hidden rounded-2xl text-white" style={{ background: themes[theme].bg }}>
          <div className="flex h-full flex-col p-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              FluentPro
            </div>
            <div className="mt-2 text-sm font-bold text-white/80">{data.name?.split(" ")[0] || "Learner"}'s English journey</div>
            <div className="mt-auto text-center">
              <div className="text-[120px] font-extrabold leading-none" style={{ fontFamily: "Nunito, sans-serif" }}>{data.streak}</div>
              <div className="mt-1 text-2xl font-extrabold">day streak 🔥</div>
            </div>
            <div className="mt-auto grid grid-cols-3 gap-2 pt-4 text-center">
              <Stat label="XP" value={data.xp} />
              <Stat label="Level" value={data.level} />
              <Stat label="Lessons" value={data.completed_lessons} />
            </div>
            <div className="mt-3 text-center text-xs font-bold text-white/80">Practicing English daily with Coach Ada</div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Theme:</span>
          {Object.keys(themes).map((k) => (
            <button key={k} onClick={() => setTheme(k)} data-testid={`share-theme-${k}`}
              className={`h-7 w-7 rounded-full border-2 transition ${theme === k ? "border-slate-900 scale-110" : "border-slate-200"}`}
              style={{ background: themes[k].bg }} aria-label={k} />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button onClick={nativeShare} data-testid="share-native-button" className="flex items-center justify-center gap-2 rounded-xl border-b-4 border-sky-600 bg-sky-400 px-3 py-2.5 font-bold text-white hover:bg-sky-500">
            <ShareNetwork weight="duotone" /> Share
          </button>
          <button onClick={whatsapp} data-testid="share-whatsapp-button" className="flex items-center justify-center gap-2 rounded-xl border-b-4 border-green-600 bg-green-500 px-3 py-2.5 font-bold text-white hover:bg-green-600">
            <WhatsappLogo weight="fill" /> WhatsApp
          </button>
          <button onClick={instagram} data-testid="share-instagram-button" className="flex items-center justify-center gap-2 rounded-xl border-b-4 border-pink-600 bg-gradient-to-br from-amber-400 via-rose-500 to-violet-500 px-3 py-2.5 font-bold text-white">
            <InstagramLogo weight="fill" /> Instagram
          </button>
          <button onClick={download} data-testid="share-download-button" className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 font-bold text-slate-700 hover:border-slate-300">
            <Download weight="duotone" /> Download
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/15 p-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">{label}</div>
      <div className="text-base font-extrabold">{value}</div>
    </div>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStat(ctx, x, y, label, value) {
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  roundRect(ctx, x, y, 200, 130, 24); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "700 24px Manrope, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 22, y + 44);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 56px Nunito, sans-serif";
  ctx.fillText(String(value), x + 22, y + 100);
}
