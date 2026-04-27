import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import AuthCallback from "@/pages/AuthCallback";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import PremiumPrompt from "@/components/PremiumPrompt";
import GoalOnboardingModal from "@/components/GoalOnboardingModal";
import StreakProtectorBanner from "@/components/StreakProtectorBanner";
import UpgradeNudgeModal from "@/components/UpgradeNudgeModal";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Conversation from "@/pages/Conversation";
import Grammar from "@/pages/Grammar";
import Vocabulary from "@/pages/Vocabulary";
import Pronunciation from "@/pages/Pronunciation";
import Writing from "@/pages/Writing";
import Lessons from "@/pages/Lessons";
import LessonDetail from "@/pages/LessonDetail";
import Profile from "@/pages/Profile";
import Premium from "@/pages/Premium";
import StartPractice from "@/pages/StartPractice";

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
      <PremiumPrompt />
      <GoalOnboardingModal />
      <StreakProtectorBanner />
      <UpgradeNudgeModal />
    </ProtectedRoute>
  );
}

function AppRouter() {
  const location = useLocation();
  // Synchronous check for OAuth callback to avoid race conditions
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/lessons" element={<Protected><Lessons /></Protected>} />
      <Route path="/lessons/:id" element={<Protected><LessonDetail /></Protected>} />
      <Route path="/conversation" element={<Protected><Conversation /></Protected>} />
      <Route path="/grammar" element={<Protected><Grammar /></Protected>} />
      <Route path="/vocabulary" element={<Protected><Vocabulary /></Protected>} />
      <Route path="/pronunciation" element={<Protected><Pronunciation /></Protected>} />
      <Route path="/writing" element={<Protected><Writing /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/premium" element={<Protected><Premium /></Protected>} />
      <Route path="/start-practice" element={<ProtectedRoute><StartPractice /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
