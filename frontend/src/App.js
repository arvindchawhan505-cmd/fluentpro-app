import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AuthCallback from "@/pages/AuthCallback";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import PremiumPrompt from "@/components/PremiumPrompt";
import GoalOnboardingModal from "@/components/GoalOnboardingModal";
import StreakProtectorBanner from "@/components/StreakProtectorBanner";
import UpgradeNudgeModal from "@/components/UpgradeNudgeModal";
import PracticeNextStep from "@/components/PracticeNextStep";
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
      <PracticeNextStep />
    </ProtectedRoute>
  );
}

function PremiumGate({ children }) {
  // Premium upsell is hidden until the user finishes Day-1 onboarding.
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user && !user.has_completed_day1) {
    return <Navigate to="/start-practice" replace />;
  }
  return children;
}

function NewUserGate({ children }) {
  // Any feature route is hidden for new users — they are funnelled to /start-practice.
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user && !user.has_completed_day1) {
    return <Navigate to="/start-practice" replace />;
  }
  return children;
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
      <Route path="/lessons" element={<Protected><NewUserGate><Lessons /></NewUserGate></Protected>} />
      <Route path="/lessons/:id" element={<Protected><NewUserGate><LessonDetail /></NewUserGate></Protected>} />
      <Route path="/conversation" element={<Protected><NewUserGate><Conversation /></NewUserGate></Protected>} />
      <Route path="/grammar" element={<Protected><NewUserGate><Grammar /></NewUserGate></Protected>} />
      <Route path="/vocabulary" element={<Protected><NewUserGate><Vocabulary /></NewUserGate></Protected>} />
      <Route path="/pronunciation" element={<Protected><NewUserGate><Pronunciation /></NewUserGate></Protected>} />
      <Route path="/writing" element={<Protected><NewUserGate><Writing /></NewUserGate></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/premium" element={<Protected><PremiumGate><Premium /></PremiumGate></Protected>} />
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
