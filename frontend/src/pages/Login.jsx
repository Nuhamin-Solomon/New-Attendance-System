import { useState } from "react";
import Icon from "../components/Icon";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const handleLogin = (event) => {
    event.preventDefault(); setError("");
    const accounts = { superadmin: "super_admin", admin: "admin", employee: "employee" };
    if (accounts[username] && password === "1234") { localStorage.setItem("role", accounts[username]); localStorage.setItem("username", username); onLogin({ username, role: accounts[username] }); return; }
    setError("That username or password does not match a demo account.");
  };
  return <main className="login-page"><div className="login-orb orb-one"/><div className="login-orb orb-two"/><section className="login-card fade-in"><div className="brand-mark"><Icon name="building" size={25}/></div><p className="eyebrow">Attendance workspace</p><h1>Welcome back</h1><p className="login-intro">Sign in to monitor your people and attendance activity.</p>{error && <div className="error-msg">{error}</div>}<form onSubmit={handleLogin}><label className="form-label" htmlFor="username">Username</label><input id="username" className="form-input" placeholder="Enter your username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus/><label className="form-label" htmlFor="password">Password</label><input id="password" className="form-input" placeholder="Enter your password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}/><button className="login-btn" type="submit">Sign in <Icon name="arrow" size={17}/></button></form><div className="login-hint"><strong>Demo access</strong><span>superadmin, admin, or employee</span><code>Password: 1234</code></div></section></main>;
}
