import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

export default function ChangePassword() {
  const { forceChangePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) { setError("Passwords do not match"); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await forceChangePassword(newPassword);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to change password");
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
          <Icon name="shield" size={25} />
        </div>
        <p className="eyebrow">Security Required</p>
        <h1>Change Your Password</h1>
        <p className="login-intro">You must change your password before continuing. This is required for first-time login.</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="newPassword">New Password</label>
          <div className="password-toggle">
            <input id="newPassword" className="form-input" type={showNew ? "text" : "password"} placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus required />
            <button type="button" className="password-toggle-btn" onClick={() => setShowNew(!showNew)} tabIndex={-1}>
              <Icon name={showNew ? "eye-off" : "eye"} size={16} />
            </button>
          </div>

          <label className="form-label" htmlFor="confirm">Confirm Password</label>
          <div className="password-toggle">
            <input id="confirm" className="form-input" type={showConfirm ? "text" : "password"} placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            <button type="button" className="password-toggle-btn" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>
              <Icon name={showConfirm ? "eye-off" : "eye"} size={16} />
            </button>
          </div>

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Changing..." : "Change Password & Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
