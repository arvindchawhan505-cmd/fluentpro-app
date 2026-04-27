import React from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { ChatsCircle, Microphone, Sparkle, CheckCircle, Flame, GraduationCap, Star } from "@phosphor-icons/react";
import Logo from "@/components/Logo";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Landing() {
  const { user } = useAuth();

  const handleLogin = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (user) {
    window.location.href = "/dashboard";
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* ambient gradient blobs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-blue-300/40 to-violet-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-40 h-[380px] w-[380px] rounded-full bg-gradient-to-br from-fuchsia-300/30 to-amber-300/30 blur-3xl" />

      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Logo size={40} textClassName="text-xl" />
        <button
          data-testid="header-login-button"
          onClick={handleLogin}
          className="relative rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2.5 font-bold text-white transition hover:from-blue-600 hover:to-violet-600 active:translate-y-1 active:border-b-0"
        >
          Sign in
        </button>
      </header>

      <section className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 py-10 md:grid-cols-12 md:py-20">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="md:col-span-7">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-indigo-700 shadow-sm">
            <Sparkle weight="duotone" size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Powered by GPT-5.2</span>
          </div>
          <h1
            className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl"
            style={{ fontFamily: "Nunito, sans-serif" }}
          >
            Speak English{" "}
            <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
              confidently
            </span>{" "}
            with FluentPro.
          </h1>
          <p className="mt-5 max-w-xl text-lg font-medium text-slate-600">
            Your personal AI tutor for conversation, pronunciation, vocabulary, grammar, and writing — all in one beautifully simple app.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              data-testid="google-login-button"
              onClick={handleLogin}
              className="relative rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3.5 text-lg font-bold text-white transition hover:from-blue-600 hover:to-violet-600 active:translate-y-1 active:border-b-0"
            >
              Continue with Google
            </button>
            <span className="text-sm font-semibold text-slate-500">Free to start · No card needed</span>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-3 text-sm font-bold text-slate-700 sm:max-w-md">
            {[
              ["12+", "Lessons"],
              ["6", "Practice modes"],
              ["24/7", "AI tutor"],
            ].map(([n, l]) => (
              <div key={l} className="rounded-2xl border-2 border-slate-100 bg-white/80 p-4 backdrop-blur">
                <div className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-2xl font-extrabold text-transparent">{n}</div>
                <div className="text-slate-500">{l}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }} className="relative md:col-span-5">
          <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-violet-300/50 blur-2xl" />
          <div className="absolute -right-8 -bottom-6 h-32 w-32 rounded-full bg-blue-300/50 blur-2xl" />

          <div className="relative overflow-hidden rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-2xl shadow-indigo-500/10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-violet-100 text-indigo-600">
                <ChatsCircle weight="duotone" size={24} />
              </div>
              <div>
                <div className="font-extrabold text-slate-900">Coach Ada</div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Live chat demo</div>
              </div>
              <div className="ml-auto flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-green-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" /> Online
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-gradient-to-br from-blue-500 to-violet-500 p-3 text-white">
                Yesterday I go to the park with friends.
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-md border-2 border-slate-100 bg-slate-50 p-3 text-slate-800">
                Nice! Small fix: <b>I went</b> (→ past tense). What did you do there?
              </div>
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-gradient-to-br from-blue-500 to-violet-500 p-3 text-white">
                We played football and eat ice cream.
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-md border-2 border-slate-100 bg-slate-50 p-3 text-slate-800">
                Sounds fun! <b>ate</b> (→ past of "eat"). Which flavor is your favorite?
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="relative mx-auto max-w-7xl px-6 pb-16">
        <h2 className="mb-6 text-2xl font-bold text-slate-900 md:text-3xl" style={{ fontFamily: "Nunito, sans-serif" }}>
          Everything you need to speak with confidence
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { icon: ChatsCircle, title: "Conversation practice", desc: "Role-play real scenarios with gentle inline corrections.", color: "from-blue-100 to-blue-50 text-blue-600" },
            { icon: Microphone, title: "Pronunciation coach", desc: "Record a sentence, get instant scoring and tips.", color: "from-rose-100 to-rose-50 text-rose-600" },
            { icon: CheckCircle, title: "Grammar & writing", desc: "Rule-by-rule feedback, rewritten versions, and scores.", color: "from-emerald-100 to-emerald-50 text-emerald-600" },
            { icon: Star, title: "Daily vocabulary", desc: "A fresh set of words every day with IPA, examples, synonyms.", color: "from-amber-100 to-amber-50 text-amber-600" },
            { icon: Flame, title: "Streaks & XP", desc: "Stay consistent with streaks, XP, and a progress map.", color: "from-orange-100 to-orange-50 text-orange-600" },
            { icon: GraduationCap, title: "Leveled lessons", desc: "Beginner → Intermediate → Advanced, structured paths.", color: "from-violet-100 to-violet-50 text-violet-600" },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="rounded-3xl border-2 border-slate-100 bg-white p-6 transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10">
              <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${color}`}>
                <Icon weight="duotone" size={24} />
              </div>
              <div className="text-lg font-extrabold text-slate-900">{title}</div>
              <div className="mt-1 font-medium text-slate-600">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative border-t-2 border-slate-100 py-8 text-center text-sm font-semibold text-slate-500">
        Built with care · FluentPro © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
