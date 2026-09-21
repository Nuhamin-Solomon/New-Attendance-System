import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import API from "../services/api";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const SESSION_EXPIRED_KEY = "session_expired";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const timerRef = useRef(null);
  const lastPingRef = useRef(0);

  const fetchUser = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const res = await API.get("/auth/me");
      setUser(res.data);
      setMustChangePassword(res.data.must_change_password || false);
    } catch {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      delete API.defaults.headers.common["Authorization"];
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const login = async (username, password) => {
    const res = await API.post("/auth/login", { username, password });
    const { token: t, user: u, must_change_password } = res.data;
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    localStorage.setItem("token", t);
    setToken(t);
    setUser(u);
    setMustChangePassword(must_change_password || false);
    API.defaults.headers.common["Authorization"] = `Bearer ${t}`;
    return u;
  };

  const clearAuth = useCallback((expired = false) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
    delete API.defaults.headers.common["Authorization"];
    if (expired) {
      sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
  }, []);

  const logout = useCallback(() => clearAuth(false), [clearAuth]);

  const logoutExpired = useCallback(() => clearAuth(true), [clearAuth]);

  const onUserActivity = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => logoutExpired(), SESSION_TIMEOUT_MS);
    const now = Date.now();
    if (now - lastPingRef.current >= HEARTBEAT_INTERVAL_MS) {
      lastPingRef.current = now;
      API.post("/auth/activity").catch(() => {});
    }
  }, [logoutExpired]);

  useEffect(() => {
    if (!user) return;
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];
    events.forEach((evt) => window.addEventListener(evt, onUserActivity, { passive: true }));
    window.addEventListener("focus", onUserActivity);
    onUserActivity();
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onUserActivity));
      window.removeEventListener("focus", onUserActivity);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, onUserActivity]);

  const changePassword = async (currentPassword, newPassword) => {
    await API.put("/auth/change-password", { currentPassword, newPassword });
    setMustChangePassword(false);
  };

  const forceChangePassword = async (newPassword) => {
    await API.put("/auth/force-change-password", { newPassword });
    setMustChangePassword(false);
    setUser((prev) => ({ ...prev, must_change_password: false }));
  };

  const hasRole = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, token, loading, mustChangePassword, login, logout, changePassword, forceChangePassword, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}