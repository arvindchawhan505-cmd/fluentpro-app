import React, { Suspense, lazy } from "react";
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
import StreakSaverBanner from "@/components/StreakSaverBanner";
import StreakMilestoneModal from "@/components/StreakMilestoneModal";
import ErrorBoundary from "@/components/ErrorBoundary";
import PageSkeleton from "@/components/PageSkeleton";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";

// Code-split the heavier feature pages — they're not needed for first paint.
const Conversation = lazy(() => import("@/pages/Conversation"));
const Grammar = lazy(() => import("@/pages/Grammar"));
const Vocabulary = lazy(() => import("@/pages/Vocabulary"));
const Pronunciation = lazy(() => import("@/pages/Pronunciation"));
const Writing = lazy(() => import("@/pages/Writing"));
const Lessons = lazy(() => import("@/pages/Lessons"));
const LessonDetail = lazy(() => import("@/pages/LessonDetail"));
const Profile = lazy(() => import("@/pages/Profile"));
const Premium = lazy(() => import("@/pages/Premium"));
const StartPractice = lazy(() => import("@/pages/StartPractice"));
const Mission = lazy(() => import("@/pages/Mission"));
const Practice = lazy(() => import("@/pages/Practice"));

function Lazy({ children }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
      <PremiumPrompt />
      <GoalOnboardingModal />
      <StreakProtectorBanner />
      <UpgradeNudgeModal />
      <PracticeNextStep />
      <StreakSaverBanner />
      <StreakMilestoneModal />
    </ProtectedRoute>
  );
}

function PremiumGate({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user && !user.has_completed_day1) return <Navigate to="/mission" replace />;
  return children;
}

function NewUserGate({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user && !user.has_completed_day1) return <Navigate to="/mission" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/practice" element={<Protected><Lazy><Practice /></Lazy></Protected>} />
      <Route path="/lessons" element={<Protected><NewUserGate><Lazy><Lessons /></Lazy></NewUserGate></Protected>} />
      <Route path="/lessons/:id" element={<Protected><NewUserGate><Lazy><LessonDetail /></Lazy></NewUserGate></Protected>} />
      <Route path="/conversation" element={<Protected><NewUserGate><Lazy><Conversation /></Lazy></NewUserGate></Protected>} />
      <Route path="/grammar" element={<Protected><NewUserGate><Lazy><Grammar /></Lazy></NewUserGate></Protected>} />
      <Route path="/vocabulary" element={<Protected><NewUserGate><Lazy><Vocabulary /></Lazy></NewUserGate></Protected>} />
      <Route path="/pronunciation" element={<Protected><NewUserGate><Lazy><Pronunciation /></Lazy></NewUserGate></Protected>} />
      <Route path="/writing" element={<Protected><NewUserGate><Lazy><Writing /></Lazy></NewUserGate></Protected>} />
      <Route path="/profile" element={<Protected><Lazy><Profile /></Lazy></Protected>} />
      <Route path="/premium" element={<Protected><PremiumGate><Lazy><Premium /></Lazy></PremiumGate></Protected>} />
      <Route path="/start-practice" element={<ProtectedRoute><Lazy><StartPractice /></Lazy></ProtectedRoute>} />
      <Route path="/mission" element={<ProtectedRoute><Lazy><Mission /></Lazy></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </div>
  );
}
