import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import Header from "../components/Header";
import Icon from "../components/Icon";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, CartesianGrid, Legend } from "recharts";

const STATUS_COLORS = { present: "#10b981", absent: "#ef4444", late: "#f59e0b", leave: "#8b5cf6", field_duty: "#06b6d4" };

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendRange, setTrendRange] = useState("monthly");
  const [resetModal, setResetModal] = useState(false);
  const [resetSearch, setResetSearch] = useState("");
  const [resetResults, setResetResults] = useState([]);
  const [resetPw, setResetPw] = useState("changeme123");
  const [resetTarget, setResetTarget] = useState(null);

  useEffect(() => {
    API.get("/reports/dashboard")
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const searchUsers = async (q) => {
    setResetSearch(q);
    if (q.length < 2) { setResetResults([]); return; }
    try {
      const r = await API.get("/users");
      const matches = r.data.filter((u) => u.username.toLowerCase().includes(q.toLowerCase()) || (u.full_name || "").toLowerCase().includes(q.toLowerCase()));
      setResetResults(matches);
    } catch (e) { }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    try {
      const r = await API.put(`/users/${resetTarget.id}/reset-password`, { newPassword: resetPw || "changeme123" });
      alert(`Password reset for ${resetTarget.username}. New password: ${r.data.temporary_password}`);
      setResetModal(false);
      setResetTarget(null);
      setResetSearch("");
      setResetPw("changeme123");
    } catch (err) { alert(err.response?.data?.error || "Failed to reset password"); }
  };

  if (loading) return <div className="page-container"><Header title="Dashboard" subtitle="Overview" /><div className="loading-spinner" /></div>;
  if (!stats) return <div className="page-container"><Header title="Dashboard" subtitle="Overview" /><p>Failed to load dashboard data.</p></div>;

  const pieData = [
    { name: "Present", value: stats.today.present || 0 },
    { name: "Absent", value: stats.today.absent || 0 },
    { name: "Late", value: stats.today.late || 0 },
    { name: "Leave", value: stats.today.leave || 0 },
    { name: "Field Duty", value: stats.today.field_duty || 0 },
  ].filter((d) => d.value > 0);

  const deptChart = stats.departments.slice(0, 8).map((d) => ({
    department: d.name.length > 16 ? d.name.slice(0, 14) + "..." : d.name,
    rate: d.rate,
    full: d.name,
  }));

  const trendData = [];
  if (stats.trend) {
    const grouped = {};
    for (const t of stats.trend) {
      if (!grouped[t.date]) grouped[t.date] = { date: t.date };
      grouped[t.date][t.status] = t.count;
    }
    for (const d of Object.values(grouped).slice(-30)) {
      trendData.push({
        date: new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
        present: (d.present || 0) + (d.late || 0),
        absent: d.absent || 0,
        leave: d.leave || 0,
      });
    }
  }

  const summaryCards = [
    { label: "Total Employees", value: stats.total_employees, icon: "users", tone: "blue" },
    { label: "Present Today", value: stats.today.present, icon: "check-circle", tone: "green" },
    { label: "Absent", value: stats.today.absent, icon: "x", tone: "red" },
    { label: "Late", value: stats.today.late, icon: "clock", tone: "orange" },
    { label: "On Leave", value: stats.today.leave, icon: "calendar", tone: "purple" },
    { label: "Field Duty", value: stats.today.field_duty, icon: "team", tone: "teal" },
  ];

  return (
    <div className="page-container">
      <Header title="Dashboard" subtitle="Overview" />

      <div className="stats-grid stats-grid-6">
        {summaryCards.map((s) => (
          <article className={`stat-card ${s.tone}`} key={s.label}>
            <span className="stat-icon"><Icon name={s.icon} size={20} /></span>
            <div>
              <p className="stat-label">{s.label}</p>
              <div className="stat-value">{s.value ?? 0}</div>
            </div>
          </article>
        ))}
      </div>

      <div className="charts-grid">
        <div className="panel chart-section">
          <div className="panel-header">
            <div>
              <div className="panel-title">Attendance Trend</div>
              <div className="panel-subtitle">Daily attendance over the past 30 days</div>
            </div>
          </div>
          <div className="chart-panel">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="leave" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel chart-section">
          <div className="panel-header">
            <div>
              <div className="panel-title">Attendance Status</div>
              <div className="panel-subtitle">Today's breakdown</div>
            </div>
          </div>
          <div className="chart-panel chart-panel-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name.toLowerCase().replace(" ", "_")] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="table-message">No attendance data for today</div>
            )}
          </div>
        </div>
      </div>

      {deptChart.length > 0 && (
        <div className="panel chart-section">
          <div className="panel-header">
            <div>
              <div className="panel-title">Department Attendance Rate</div>
              <div className="panel-subtitle">Attendance percentage by department</div>
            </div>
          </div>
          <div className="chart-panel">
            <ResponsiveContainer width="100%" height={Math.max(200, deptChart.length * 40)}>
              <BarChart data={deptChart} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
                  {deptChart.map((entry, i) => (
                    <Cell key={i} fill={entry.rate >= 90 ? "#10b981" : entry.rate >= 70 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {stats.recent_requests?.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Recent Requests</div>
              <div className="panel-subtitle">Latest attendance requests</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {stats.recent_requests.map((r) => (
                  <tr key={r.id}>
                    <td className="strong-cell">{r.employee_name}</td>
                    <td><span className="badge badge-blue">{r.request_type.replace("_", " ")}</span></td>
                    <td className="td-muted">{new Date(r.date).toLocaleDateString()}</td>
                    <td><span className={`badge badge-${r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "orange"}`}>{r.status.replace("_", " ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {user?.role === "admin" && (
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">Quick Actions</div>
              <div className="panel-subtitle">Administrative tools</div>
            </div>
          </div>
          <div className="panel-body" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={() => setResetModal(true)}>
              <Icon name="refresh" size={16} /> Reset User Password
            </button>
            <a href="/admin/users" className="btn btn-ghost"><Icon name="users" size={16} /> Manage Users</a>
            <a href="/admin/audit" className="btn btn-ghost"><Icon name="eye" size={16} /> Audit Log</a>
          </div>
        </div>
      )}

      {resetModal && (
        <div className="modal-overlay" onClick={() => setResetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset User Password</h3>
              <button className="btn btn-ghost" onClick={() => setResetModal(false)}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              <label className="form-label">Search User</label>
              <input className="form-input" placeholder="Type username or name..." value={resetSearch} onChange={(e) => searchUsers(e.target.value)} />
              {resetResults.length > 0 && (
                <div style={{ marginTop: 8, maxHeight: 160, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                  {resetResults.map((u) => (
                    <div key={u.id} onClick={() => { setResetTarget(u); setResetSearch(u.username); setResetResults([]); }}
                      style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: resetTarget?.id === u.id ? "var(--light)" : "transparent" }}>
                      <span><strong>{u.username}</strong> <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({u.full_name || "No name"})</span></span>
                      <span className={`badge badge-${u.role === "admin" ? "orange" : "blue"}`} style={{ fontSize: 11 }}>{u.role}</span>
                    </div>
                  ))}
                </div>
              )}
              {resetTarget && (
                <div style={{ marginTop: 12 }}>
                  <label className="form-label">New Password for: {resetTarget.username}</label>
                  <input className="form-input" type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>User will need to log in with this new password.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setResetModal(false); setResetTarget(null); setResetSearch(""); }}>Cancel</button>
              <button className="btn btn-primary" disabled={!resetTarget} onClick={handleResetPassword}>Reset Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
