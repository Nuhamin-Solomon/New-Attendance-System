import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../services/api";
import Icon from "../components/Icon";

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get("token") || "";

  const [step, setStep] = useState(initialToken ? "reset" : "request");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState(initialToken);
  const [notice, setNotice] = useState(initialToken ? "" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const requestReset = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const res = await API.post("/auth/forgot-password", { username });
      if (res.data.reset_token) {
        setToken(res.data.reset_token);
        setNotice(
          `${res.data.message} The token is valid for ${res.data.expires_in_minutes} minutes. Copy it below, then set your new password.`
        );
        setStep("reset");
      } else {
        setNotice(res.data.message || "Password reset request accepted.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await API.post("/auth/reset-password", { token, newPassword });
      setStep("done");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.error || "Reset failed. Please try again.");
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
        <p className="eyebrow">Password Recovery</p>

        {step === "request" && (
          <>
            <h1>Reset Password</h1>
            <p className="login-intro">Enter your username or email to receive a password reset token.</p>

            {error && <div className="error-msg" role="alert">{error}</div>}
            {notice && <div className="notice-msg" role="status">{notice}</div>}

            <form onSubmit={requestReset}>
              <label className="form-label" htmlFor="username">Username / Email</label>
              <input
                id="username"
                className="form-input"
                placeholder="Enter your username or email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                required
              />
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? "Requesting..." : "REQUEST RESET TOKEN"}
                {!loading && <Icon name="arrow" size={17} />}
              </button>
            </form>
          </>
        )}

        {step === "reset" && (
          <>
            <h1>Set New Password</h1>
            <p className="login-intro">Enter the reset token and your new password.</p>

            {error && <div className="error-msg" role="alert">{error}</div>}
            {notice && <div className="notice-msg" role="status">{notice}</div>}

            {token && (
              <div className="reset-token-box">
                <span className="reset-token-label">Your reset token</span>
                <code className="reset-token-value">{token}</code>
              </div>
            )}

            <form onSubmit={resetPassword}>
              <label className="form-label" htmlFor="reset-token">Reset Token</label>
              <input
                id="reset-token"
                className="form-input"
                placeholder="Paste your reset token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoFocus={!token}
                autoComplete="one-time-code"
                required
              />

              <label className="form-label" htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                className="form-input"
                type="password"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />

              <label className="form-label" htmlFor="confirm-password">Confirm New Password</label>
              <input
                id="confirm-password"
                className="form-input"
                type="password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />

              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? "Resetting..." : "RESET PASSWORD"}
                {!loading && <Icon name="arrow" size={17} />}
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <>
            <h1>Password Reset Complete</h1>
            <p className="login-intro">Your password has been updated successfully.</p>
            <div className="notice-msg" role="status">You can now sign in with your new password.</div>
            <Link to="/login" className="login-btn" style={{ marginTop: 16, textDecoration: "none" }}>
              BACK TO LOGIN
            </Link>
          </>
        )}

        {step !== "done" && (
          <Link to="/login" className="forgot-link" style={{ display: "block", marginTop: 16 }}>
            Back to Login
          </Link>
        )}
      </section>
    </main>
  );
}