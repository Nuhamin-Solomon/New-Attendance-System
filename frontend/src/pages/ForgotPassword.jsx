import { useState } from "react";
import Icon from "../components/Icon";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
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
        <h1>Reset Password</h1>
        <p className="login-intro">Enter your email address and we'll send you a link to reset your password.</p>

        {sent ? (
          <div className="success-msg">
            <Icon name="check-circle" size={20} />
            <p>If an account exists with that email, you'll receive a password reset link shortly.</p>
            <a href="/login" className="login-btn" style={{ marginTop: 16, textDecoration: "none" }}>Back to Login</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              className="form-input"
              placeholder="Enter your email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
            <button className="login-btn" type="submit">Send Reset Link</button>
            <a href="/login" className="forgot-link" style={{ textAlign: "center", marginTop: 16, display: "block" }}>Back to Login</a>
          </form>
        )}
      </section>
    </main>
  );
}
