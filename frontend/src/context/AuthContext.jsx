import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { identify, reset, track, EVT } from "@/lib/analytics";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const identifiedRef = useRef(false);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      // Identify once per session — and capture the very first sign-in event.
      if (data?.user_id && !identifiedRef.current) {
        identify(data.user_id, {
          email: data.email,
          name: data.name,
          is_premium: !!data.is_premium,
          goal: data.goal || null,
          level: data.level || null,
          has_completed_day1: !!data.has_completed_day1,
        });
        track(EVT.AUTH_SIGNED_IN, { is_premium: !!data.is_premium, goal: data.goal || null });
        identifiedRef.current = true;
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* noop */ }
    reset();
    identifiedRef.current = false;
    setUser(null);
    window.location.href = "/";
  };

  const refreshUser = checkAuth;

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
