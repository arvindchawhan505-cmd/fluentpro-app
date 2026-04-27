import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Handle 402 free-tier limit / premium-required → redirect to /premium
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 402) {
      const detail = err.response.data?.detail;
      const msg = typeof detail === "string" ? detail : detail?.message || "Upgrade to Premium to continue.";
      try { window.dispatchEvent(new CustomEvent("premium-required", { detail: { message: msg } })); } catch { /* noop */ }
    }
    return Promise.reject(err);
  }
);
