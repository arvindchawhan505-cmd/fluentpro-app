import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Crown, Lightning, Sparkle, X, CheckCircle } from "@phosphor-icons/react";

const DISMISS_KEY = "upgrade_nudge_dismissed_date";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function UpgradeNudgeModal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.is_premium) return;
    if (localStorage.getItem(DISMISS_KEY) === todayStr()) return;
    (async () => {
      try {
        const { data } = await api.get("/onboarding/quest");
        const eligible = (data.days_since_signup ?? 0) >= 3 || data.claimed === true;
        if (eligible) {
          setTimeout(() => setOpen(true), 1200);
        }
      } catch { /* noop */ }
    })();
  }, [user]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, todayStr());
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          data-testid="upgrade-nudge-modal"
          onClick={dismiss}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ scale: 0.97, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-3xl border-2 border-amber-200 bg-white shadow-2xl"
          >
            <div className="relative bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-6 text-white">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
              <button onClick={dismiss} aria-label="Close" data-testid="upgrade-nudge-close" className="absolute right-3 top-3 rounded-lg p-1 text-white/80 hover:bg-white/15"><X /></button>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20"><Crown weight="fill" size={26} /></div>
              <h3 className="mt-3 text-2xl font-extrabold leading-tight" style={{ fontFamily: "Nunito, sans-serif" }}>
                You're improving fast 🚀
              </h3>
              <p className="mt-1 text-sm font-medium opacity-95">Unlock full access and keep the momentum going.</p>
            </div>
            <div className="p-6">
              <ul className="space-y-2">
                {[
                  "Unlimited Coach Ada chat & writing feedback",
                  "All Intermediate + Advanced lessons",
                  "Faster, priority AI replies",
                  "7-day free trial · cancel anytime",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <CheckCircle weight="fill" className="text-emerald-500" /> {t}
                  </li>
                ))}
              </ul>
              <motion.button
                onClick={() => { dismiss(); navigate("/premium"); }}
                data-testid="upgrade-nudge-cta"
                animate={{ boxShadow: ["0 0 0 0 rgba(251,191,36,0.5)", "0 0 0 12px rgba(251,191,36,0)", "0 0 0 0 rgba(251,191,36,0)"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                className="mt-5 w-full rounded-xl border-b-4 border-amber-700 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-5 py-3 font-extrabold text-white"
              >
                Start 7-day free trial · ₹99/mo after
              </motion.button>
              <button onClick={dismiss} className="mt-2 w-full rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
