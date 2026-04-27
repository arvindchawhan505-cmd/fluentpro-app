import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, X } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

export default function PremiumPrompt() {
  const [msg, setMsg] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const handler = (e) => {
      // Don't surface premium upsell until the user has finished Day-1 onboarding.
      if (user && !user.has_completed_day1) return;
      setMsg(e.detail?.message || "Upgrade to Premium to continue.");
    };
    window.addEventListener("premium-required", handler);
    return () => window.removeEventListener("premium-required", handler);
  }, [user]);

  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          data-testid="premium-prompt-modal"
          onClick={() => setMsg(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border-2 border-amber-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-500">
                <Crown weight="fill" size={26} />
              </div>
              <button onClick={() => setMsg(null)} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" data-testid="premium-prompt-close"><X /></button>
            </div>
            <h3 className="mt-3 text-xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>Upgrade to Premium</h3>
            <p className="mt-1 font-medium text-slate-600">{msg}</p>
            <button
              data-testid="premium-prompt-cta"
              onClick={() => { setMsg(null); navigate("/premium"); }}
              className="mt-4 w-full rounded-xl border-b-4 border-amber-600 bg-amber-400 px-5 py-3 font-bold text-white hover:bg-amber-500"
            >
              See Premium · ₹99/mo
            </button>
            <button onClick={() => setMsg(null)} className="mt-2 w-full rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">Maybe later</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
