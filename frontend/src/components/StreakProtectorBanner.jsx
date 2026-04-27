import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Flame, X, ArrowRight } from "@phosphor-icons/react";

const DISMISS_KEY = "streak_protector_dismissed_date";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function StreakProtectorBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return setShow(false);
    const streak = user.streak || 0;
    const lastActive = user.last_active_date; // YYYY-MM-DD or null
    const today = todayStr();
    const hour = new Date().getHours();
    const dismissedToday = localStorage.getItem(DISMISS_KEY) === today;
    const eligible = streak >= 3 && lastActive !== today && hour >= 21 && !dismissedToday;
    setShow(eligible);
  }, [user]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, todayStr());
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          data-testid="streak-protector-banner"
          className="fixed bottom-20 left-1/2 z-40 w-[92%] max-w-md -translate-x-1/2 md:bottom-6"
        >
          <div className="relative overflow-hidden rounded-2xl border-2 border-orange-300 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 p-4 text-white shadow-2xl">
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/15 blur-2xl" />
            <div className="flex items-start gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <Flame weight="fill" size={26} className="drop-shadow" />
                <span className="absolute inset-0 -z-10 animate-ping rounded-2xl bg-white/20" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold uppercase tracking-wider opacity-90">Don't break your streak</div>
                <div className="mt-1 text-base font-extrabold">
                  You've got a {user?.streak}-day streak 🔥 — 60 seconds keeps it alive.
                </div>
              </div>
              <button onClick={dismiss} aria-label="Dismiss" data-testid="streak-protector-dismiss" className="rounded-lg p-1 text-white/80 hover:bg-white/15"><X /></button>
            </div>
            <div className="mt-3 flex justify-end">
              <Link
                to="/dashboard"
                onClick={dismiss}
                data-testid="streak-protector-resume"
                className="inline-flex items-center gap-1.5 rounded-xl border-b-4 border-white/40 bg-white px-4 py-2 font-bold text-orange-600 transition hover:bg-white/95 active:translate-y-1 active:border-b-0"
              >
                Resume now <ArrowRight weight="bold" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
