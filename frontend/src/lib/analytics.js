/**
 * PostHog analytics wrapper. The PostHog snippet is already loaded in
 * /public/index.html — this just provides a single typed helper used across
 * the app, plus a `safe` no-op fallback if the script failed to load (e.g.
 * blocked by an ad blocker), so calls never crash the UI.
 */

const ph = () => (typeof window !== "undefined" ? window.posthog : null);

/** Track a product event. Properties should be small / non-PII. */
export function track(event, properties) {
  try {
    ph()?.capture?.(event, properties || {});
  } catch { /* noop */ }
}

/** Identify the signed-in user (call once after login + on /auth/me load). */
export function identify(userId, traits) {
  if (!userId) return;
  try {
    ph()?.identify?.(userId, traits || {});
  } catch { /* noop */ }
}

/** Reset PostHog state on logout. */
export function reset() {
  try {
    ph()?.reset?.();
  } catch { /* noop */ }
}

/** Canonical event names — keep in one place to avoid typos. */
export const EVT = {
  // Onboarding funnel
  AUTH_SIGNED_IN: "auth_signed_in",
  GOAL_SELECTED: "goal_selected",
  DAY1_STARTED: "day1_started",
  DAY1_STEP_COMPLETED: "day1_step_completed",
  DAY1_COMPLETED: "day1_completed",
  // Activation / habit loop
  CONVERSATION_MESSAGE_SENT: "conversation_message_sent",
  CHECKIN_COMPLETED: "checkin_completed",
  DAILY_PATH_TASK_DONE: "daily_path_task_done",
  DAILY_PATH_CLAIMED: "daily_path_claimed",
  // Retention
  STREAK_SAVED: "streak_saved",
  MILESTONE_CLAIMED: "milestone_claimed",
  // Monetisation
  UPGRADE_CLICKED: "upgrade_clicked",
  PREMIUM_PURCHASED: "premium_purchased",
  // Referral
  REFERRAL_SHARED: "referral_shared",
};
