import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { celebrate } from "@/lib/celebrate";
import { useAuth } from "@/context/AuthContext";
import { Crown, CheckCircle, Sparkle, Lightning, Lock, X } from "@phosphor-icons/react";
const FEATURES = [
  { name: "AI Conversation practice", free: "5 messages / day", premium: "Unlimited" },
  { name: "Grammar checks", free: "3 / day", premium: "Unlimited" },
  { name: "Writing feedback", free: "3 / day", premium: "Unlimited" },
  { name: "Pronunciation practice", free: "5 / day", premium: "Unlimited" },
  { name: "Daily vocabulary + quiz", free: true, premium: true },
  { name: "Beginner lessons", free: true, premium: true },
  { name: "Intermediate + Advanced lessons", free: false, premium: true },
  { name: "Streak share cards", free: true, premium: true },
  { name: "Priority Coach Ada model", free: false, premium: true },
];

export default function Premium() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [paying, setPaying] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/billing/status");
      setStatus(data);
    })();
  }, [user]);

  const upgrade = async () => {
    setPaying(true);
    try {
      // MOCKED Razorpay-style checkout. Backend mocks the payment success.
      await new Promise((r) => setTimeout(r, 1200));
      const { data } = await api.post("/billing/upgrade");
      setStatus((s) => ({ ...s, ...data }));
      await refreshUser();
      setSuccess(true);
      celebrate({ intensity: "big" });
    } finally {
      setPaying(false);
    }
  };

  const cancel = async () => {
    if (!confirm("Cancel Premium? You'll lose access to advanced lessons and unlimited usage.")) return;
    await api.post("/billing/cancel");
    await refreshUser();
    const { data } = await api.get("/billing/status");
    setStatus(data);
  };

  const isPremium = status?.is_premium;

  return (
    <div className="space-y-6 pb-24 md:pb-8" data-testid="premium-page">
      {!isPremium && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 p-4 text-white shadow-lg"
          data-testid="launch-banner"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20"><Lightning weight="fill" size={22} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-widest opacity-90">Limited launch offer</div>
              <div className="text-lg font-extrabold" style={{ fontFamily: "Nunito, sans-serif" }}>
                Premium at <span className="line-through opacity-70 text-base">₹199</span> <span className="ml-1">₹99/month</span> · 7-day free trial
              </div>
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider">Save 50%</span>
          </div>
        </motion.div>
      )}

      <header className="text-center md:text-left">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-700">
          <Crown weight="fill" size={16} />
          <span className="text-xs font-bold uppercase tracking-wider">Coach Premium</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl" style={{ fontFamily: "Nunito, sans-serif" }}>
          {isPremium ? "You're a Premium learner ✨" : "Go Premium · Start your 7-day free trial"}
        </h1>
        <p className="mt-2 max-w-2xl font-medium text-slate-600">
          Unlock unlimited AI chat, advanced lessons, and priority coaching. {!isPremium && "Cancel anytime — even before the trial ends."}
        </p>
        {isPremium && status?.premium_until && (
          <div className="mt-2 text-sm font-bold text-slate-500">
            Renews on {new Date(status.premium_until).toLocaleDateString()}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-3xl border-2 border-slate-100 bg-white p-6 md:p-8" data-testid="plan-free">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Free</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-4xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>₹0</span>
            <span className="font-bold text-slate-500">/month</span>
          </div>
          <p className="mt-2 font-medium text-slate-600">Great for getting started.</p>
          <ul className="mt-5 space-y-2 text-sm font-medium text-slate-700">
            <li className="flex items-start gap-2"><CheckCircle weight="duotone" className="mt-0.5 text-green-500" /> 5 chats / day with Coach Ada</li>
            <li className="flex items-start gap-2"><CheckCircle weight="duotone" className="mt-0.5 text-green-500" /> 3 grammar + 3 writing checks / day</li>
            <li className="flex items-start gap-2"><CheckCircle weight="duotone" className="mt-0.5 text-green-500" /> 5 pronunciation attempts / day</li>
            <li className="flex items-start gap-2"><CheckCircle weight="duotone" className="mt-0.5 text-green-500" /> Beginner lessons + daily vocabulary</li>
            <li className="flex items-start gap-2 text-slate-400"><Lock weight="duotone" className="mt-0.5" /> Intermediate + Advanced lessons locked</li>
          </ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-6 md:p-8"
          data-testid="plan-premium"
        >
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-amber-300/30 blur-2xl" />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-white">
              <Crown weight="fill" size={18} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Premium · Most popular</span>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-4xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>₹99</span>
            <span className="font-bold text-slate-500">/month</span>
            <span className="ml-2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Launch price</span>
          </div>
          <p className="mt-2 font-medium text-slate-700">For serious learners. <b>7-day free trial</b>, then ₹99/month.</p>
          <ul className="mt-5 space-y-2 text-sm font-medium text-slate-800">
            <li className="flex items-start gap-2"><Lightning weight="fill" className="mt-0.5 text-amber-500" /> <b>Unlimited</b> AI chat with Coach Ada</li>
            <li className="flex items-start gap-2"><Lightning weight="fill" className="mt-0.5 text-amber-500" /> <b>Unlimited</b> grammar, writing, and pronunciation</li>
            <li className="flex items-start gap-2"><Sparkle weight="fill" className="mt-0.5 text-rose-500" /> All Intermediate + Advanced lessons</li>
            <li className="flex items-start gap-2"><Sparkle weight="fill" className="mt-0.5 text-rose-500" /> Priority Coach Ada model & faster replies</li>
            <li className="flex items-start gap-2"><CheckCircle weight="duotone" className="mt-0.5 text-green-500" /> Cancel anytime — no commitment</li>
          </ul>

          {!isPremium ? (
            <motion.button
              onClick={() => setShowCheckout(true)}
              data-testid="upgrade-cta"
              disabled={paying}
              animate={{ boxShadow: ["0 0 0 0 rgba(251,191,36,0.5)", "0 0 0 12px rgba(251,191,36,0)", "0 0 0 0 rgba(251,191,36,0)"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-6 w-full rounded-xl border-b-4 border-amber-600 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-6 py-3.5 text-lg font-extrabold text-white shadow-lg disabled:opacity-50"
            >
              {paying ? "Processing…" : "Start 7-day free trial"}
            </motion.button>
          ) : (
            <button
              onClick={cancel}
              data-testid="cancel-premium-button"
              className="mt-6 w-full rounded-xl border-2 border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 hover:border-rose-200 hover:text-rose-600"
            >
              Cancel Premium
            </button>
          )}
          {!isPremium && <div className="mt-2 text-center text-xs font-bold text-slate-500">Then ₹99/month · cancel anytime</div>}
        </motion.div>
      </div>

      <div className="rounded-3xl border-2 border-slate-100 bg-white p-6 md:p-8">
        <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>What's included</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3">Feature</th>
                <th className="pb-3 text-center">Free</th>
                <th className="pb-3 text-center">Premium</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.name} className="border-t border-slate-100">
                  <td className="py-3 font-medium text-slate-800">{f.name}</td>
                  <td className="py-3 text-center font-medium text-slate-600">{renderCell(f.free)}</td>
                  <td className="py-3 text-center font-bold text-amber-700">{renderCell(f.premium)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal
          onClose={() => setShowCheckout(false)}
          onConfirm={async () => { setShowCheckout(false); await upgrade(); }}
          paying={paying}
        />
      )}

      {success && (
        <SuccessModal onClose={() => setSuccess(false)} until={status?.premium_until} />
      )}
    </div>
  );
}

function renderCell(v) {
  if (v === true) return <CheckCircle weight="duotone" className="inline text-green-500" />;
  if (v === false) return <X weight="bold" className="inline text-slate-300" />;
  return v;
}

function CheckoutModal({ onClose, onConfirm, paying }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" data-testid="checkout-modal">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-600">
            <Crown weight="fill" /><span className="font-bold">FluentPro Premium</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X /></button>
        </div>
        <div className="mt-4 rounded-2xl bg-amber-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Order summary</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-bold text-slate-800">Premium · monthly</span>
            <span className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>₹99</span>
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">Auto-renews monthly. Cancel anytime in Profile.</div>
        </div>
        <div className="mt-3 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-3 text-xs font-bold text-amber-700">
          ⚠️ DEMO MODE — payment is MOCKED. No real card needed. Click Pay to instantly activate Premium for testing.
        </div>
        <button
          data-testid="checkout-pay-button"
          onClick={onConfirm}
          disabled={paying}
          className="mt-4 w-full rounded-xl border-b-4 border-amber-600 bg-amber-400 px-6 py-3.5 text-lg font-bold text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {paying ? "Processing…" : "Pay ₹99 · Activate Premium"}
        </button>
        <div className="mt-2 text-center text-xs font-medium text-slate-400">Razorpay integration ready — add API keys when going live.</div>
      </motion.div>
    </div>
  );
}

function SuccessModal({ onClose, until }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" data-testid="upgrade-success-modal">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="w-full max-w-md rounded-3xl border-2 border-amber-200 bg-white p-6 text-center shadow-xl"
      >
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500">
          <Crown weight="fill" size={36} />
        </div>
        <h3 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>Welcome to Premium! 🎉</h3>
        <p className="mt-2 font-medium text-slate-600">All lessons unlocked. Unlimited Coach Ada is yours.</p>
        {until && <div className="mt-2 text-sm font-bold text-slate-500">Active until {new Date(until).toLocaleDateString()}</div>}
        <button onClick={onClose} data-testid="upgrade-success-close" className="mt-5 rounded-xl border-b-4 border-amber-600 bg-amber-400 px-6 py-3 font-bold text-white">
          Start learning
        </button>
      </motion.div>
    </div>
  );
}
