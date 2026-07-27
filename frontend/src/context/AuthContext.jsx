import { createContext, useContext, useState, useEffect, useCallback } from "react";
import API from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

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
    localStorage.setItem("token", t);
    setToken(t);
    setUser(u);
    setMustChangePassword(must_change_password || false);
    API.defaults.headers.common["Authorization"] = `Bearer ${t}`;
    return u;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
    delete API.defaults.headers.common["Authorization"];
  };

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
