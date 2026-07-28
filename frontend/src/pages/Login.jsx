import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-orb orb-one" />
      <div className="login-orb orb-two" />
      <section className="login-card fade-in">
        <div className="brand-mark brand-mark-lg">
          <Icon name="building" size={25} />
        </div>
        <p className="eyebrow">Kifiya Attendance</p>
        <h1>Welcome Back</h1>
        <p className="login-intro">Sign in to the Attendance Management System</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="username">Email / Username</label>
          <input
            id="username"
            className="form-input"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />

          <label className="form-label" htmlFor="password">Password</label>
          <div className="password-toggle">
            <input
              id="password"
              className="form-input"
              placeholder="Enter your password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
              <Icon name={showPassword ? "eye-off" : "eye"} size={16} />
            </button>
          </div>

          <div className="login-options">
            <label className="checkbox-label">
              <input type="checkbox" defaultChecked /> Remember Me
            </label>
            <a href="/forgot-password" className="forgot-link">Forgot Password?</a>
          </div>

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "LOGIN"}
            {!loading && <Icon name="arrow" size={17} />}
          </button>
        </form>
      </section>
    </main>
  );
}
