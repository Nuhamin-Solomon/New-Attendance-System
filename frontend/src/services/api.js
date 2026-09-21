import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

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
