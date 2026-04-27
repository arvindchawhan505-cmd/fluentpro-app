import React from "react";
import { useLocation } from "react-router-dom";
import ContinueLearningBanner from "@/components/ContinueLearningBanner";
import { useAuth } from "@/context/AuthContext";

/**
 * Mounts the Continue-Learning banner only on practice pages.
 * Hidden on dashboard, landing, onboarding (start-practice) & for brand-new users.
 */
const PRACTICE_PATHS = [
  "/conversation", "/vocabulary", "/grammar", "/writing", "/pronunciation",
  "/lessons",
];

export default function PracticeNextStep() {
  const { user } = useAuth();
  const loc = useLocation();
  // Only returning users who've completed Day 1 get the sticky nudge.
  if (!user || !user.has_completed_day1) return null;
  const active = PRACTICE_PATHS.some((p) => loc.pathname === p || loc.pathname.startsWith(p + "/"));
  if (!active) return null;
  return <ContinueLearningBanner currentPath={loc.pathname} trigger={loc.pathname} />;
}
