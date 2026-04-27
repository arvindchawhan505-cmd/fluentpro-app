import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { celebrate } from "@/lib/celebrate";
import { UsersThree, ShareNetwork, Copy, WhatsappLogo, CheckCircle, Lightning } from "@phosphor-icons/react";

export default function ReferralCard() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/referral/me"); setData(data); } catch { /* noop */ }
    })();
  }, []);

  if (!data) return null;

  // If backend returned an absolute URL (PUBLIC_APP_URL set), use it as-is.
  // Otherwise concat with the current origin so the link is always shareable.
  const fullLink = /^https?:\/\//i.test(data.link)
    ? data.link
    : (typeof window !== "undefined" ? `${window.location.origin}${data.link}` : data.link);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  };

  const whatsapp = () => {
    const text = encodeURIComponent(`${data.share_text}\n${fullLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const nativeShare = async () => {
    const payload = { title: "Try FluentPro", text: data.share_text, url: fullLink };
    if (navigator.share) {
      try { await navigator.share(payload); } catch { /* user cancelled */ }
    } else {
      copy();
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      data-testid="referral-card"
      className="relative overflow-hidden rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 md:p-6"
    >
      <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-emerald-300/30 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]">
            <UsersThree weight="fill" size={26} />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-emerald-700 shadow-sm">
              <Lightning weight="fill" size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Invite friends</span>
            </div>
            <h3 className="mt-2 text-lg font-extrabold text-slate-900 md:text-xl" style={{ fontFamily: "Nunito, sans-serif" }}>
              Earn +{data.referrer_reward} XP for every friend who joins
            </h3>
            <p className="mt-1 max-w-md text-sm font-medium text-slate-600">
              They also get +{data.invitee_reward} XP. Share your code below.
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-white px-3 py-1.5 text-right text-xs font-bold text-slate-500 ring-1 ring-emerald-100">
          <div>Friends invited</div>
          <div className="text-emerald-700 text-base">{data.redemptions}</div>
          <div className="mt-1 text-amber-700">+{data.xp_earned} XP earned</div>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Code</span>
          <span data-testid="referral-code" className="font-mono text-sm font-extrabold text-slate-900">{data.code}</span>
          <span className="ml-auto truncate text-xs font-medium text-slate-500" title={fullLink}>{fullLink}</span>
        </div>
        <button onClick={copy} data-testid="referral-copy-button" className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-emerald-200">
          {copied ? <><CheckCircle weight="fill" className="text-emerald-500" /> Copied</> : <><Copy weight="duotone" /> Copy link</>}
        </button>
        <button onClick={whatsapp} data-testid="referral-whatsapp-button" className="inline-flex items-center gap-1.5 rounded-xl border-b-4 border-green-700 bg-green-500 px-3 py-2 text-sm font-bold text-white hover:bg-green-600 active:translate-y-1 active:border-b-0">
          <WhatsappLogo weight="fill" /> WhatsApp
        </button>
        <button onClick={nativeShare} data-testid="referral-native-share-button" className="inline-flex items-center gap-1.5 rounded-xl border-b-4 border-emerald-700 bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-sm font-bold text-white hover:opacity-95 active:translate-y-1 active:border-b-0">
          <ShareNetwork weight="duotone" /> Share
        </button>
      </div>
    </motion.section>
  );
}
