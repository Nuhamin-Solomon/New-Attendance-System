import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

// Always return a plain string from any error shape (axios error, HTTP error
// body, or Vercel's {code, message}). Prevents React error #31
// ("Objects are not valid as a React child") from rendering error objects.
export function readApiError(err, fallback = "Request failed. Please try again.") {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data.error === "string" && data.error.trim()) return data.error;
  if (data && typeof data.message === "string" && data.message.trim()) return data.message;
  if (data && data.error && typeof data.error === "object") {
    if (typeof data.error.message === "string" && data.error.message.trim()) return data.error.message;
    if (typeof data.error.code === "string" && data.error.code.trim()) return data.error.code;
  }
  if (err?.response?.status) return `Request failed (${err.response.status})`;
  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  return fallback;
}

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isLoginRequest = /\/auth\/login$/.test(url);
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("token");
      const msg = (error.response.data?.error || "").toLowerCase();
      const sessionExpired = /expired|session/i.test(msg) || /\/auth\/me$/.test(url);
      if (sessionExpired) {
        sessionStorage.setItem("session_expired", "1");
      }
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default API;
