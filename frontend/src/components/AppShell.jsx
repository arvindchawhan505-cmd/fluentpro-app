import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  GraduationCap, ChatsCircle, BookBookmark, Microphone, PencilSimpleLine,
  Notebook, User, SignOut, Flame, Star, Crown,
} from "@phosphor-icons/react";
import Logo from "@/components/Logo";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: GraduationCap, testId: "nav-dashboard" },
  { to: "/lessons", label: "Lessons", icon: Notebook, testId: "nav-lessons" },
  { to: "/conversation", label: "Conversation", icon: ChatsCircle, testId: "nav-conversation" },
  { to: "/vocabulary", label: "Vocabulary", icon: BookBookmark, testId: "nav-vocabulary" },
  { to: "/pronunciation", label: "Pronunciation", icon: Microphone, testId: "nav-pronunciation" },
  { to: "/writing", label: "Writing", icon: PencilSimpleLine, testId: "nav-writing" },
  { to: "/grammar", label: "Grammar", icon: Notebook, testId: "nav-grammar" },
  { to: "/premium", label: "Premium", icon: Crown, testId: "nav-premium" },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b-2 border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
          <Link to="/dashboard" className="flex items-center gap-2" data-testid="brand-link">
            <Logo size={36} />
            {user?.is_premium && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700" data-testid="premium-badge">
                <Crown weight="fill" size={10} /> Premium
              </span>
            )}
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-orange-700 sm:flex" data-testid="streak-badge">
              <Flame weight="duotone" size={18} />
              <span className="text-sm font-bold">{user?.streak || 0}</span>
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 sm:flex" data-testid="xp-badge">
              <Star weight="duotone" size={18} />
              <span className="text-sm font-bold">{user?.xp || 0} XP</span>
            </div>
            <button
              data-testid="profile-button"
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 rounded-full border-2 border-slate-200 bg-white px-2 py-1 pr-3 transition hover:border-sky-300"
            >
              {user?.picture ? (
                <img src={user.picture} alt="avatar" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  <User weight="duotone" size={16} />
                </div>
              )}
              <span className="hidden text-sm font-semibold text-slate-700 md:inline">{user?.name?.split(" ")[0]}</span>
            </button>
            <button
              data-testid="logout-button"
              onClick={logout}
              className="rounded-xl border-2 border-slate-200 bg-white p-2 text-slate-500 transition hover:border-rose-300 hover:text-rose-500"
              aria-label="Log out"
              title="Log out"
            >
              <SignOut weight="duotone" size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-8">
        <aside className="sticky top-[72px] hidden h-fit w-56 shrink-0 flex-col gap-1 md:flex">
          {nav.map(({ to, label, icon: Icon, testId }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testId}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition ${
                  isActive
                    ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)]"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`
              }
            >
              <Icon weight="duotone" size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t-2 border-slate-100 bg-white p-2 md:hidden">
        {nav.slice(0, 5).map(({ to, label, icon: Icon, testId }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={testId + "-mobile"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-xs font-bold ${
                isActive ? "text-indigo-600" : "text-slate-500"
              }`
            }
          >
            <Icon weight="duotone" size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
