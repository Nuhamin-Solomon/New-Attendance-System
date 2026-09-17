import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import Icon from "../components/Icon";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";

const STATUS_BADGE = {
  present: "green", late: "orange", absent: "red", leave: "purple",
  approved: "blue", missing_checkout: "orange",
};

const statusBadge = (status) => {
  const tone = STATUS_BADGE[status] || "blue";
  return <span className={`badge badge-${tone}`}>{(status || "unknown").replace(/_/g, " ")}</span>;
};

function aggregateTrend(raw, groupBy) {
  if (!raw || raw.length === 0) return [];
  const grouped = {};
  for (const t of raw) {
    const key = t.date_key || t.date;
    let bucket;
    if (groupBy === "daily") {
      bucket = key;
    } else if (groupBy === "weekly") {
      const d = new Date(key + "T12:00:00Z");
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
      d.setUTCDate(diff);
      bucket = d.toISOString().split("T")[0];
    } else {
      bucket = key.slice(0, 7);
    }
    if (!grouped[bucket]) grouped[bucket] = { date: bucket, present: 0, missing: 0, absent: 0, late: 0 };
    grouped[bucket].present += t.present || 0;
    grouped[bucket].missing += t.missing_checkout || 0;
    grouped[bucket].absent += t.absent || 0;
    grouped[bucket].late += t.late || 0;
  }
  const list = Object.values(grouped).slice(-30);
  return list.map((d) => ({
    ...d,
    label: groupBy === "monthly"
      ? new Date(d.date + "-01T12:00:00Z").toLocaleDateString("en", { month: "short", year: "2-digit", timeZone: "UTC" })
      : groupBy === "weekly"
        ? "W/C " + new Date(d.date + "T12:00:00Z").toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" })
        : new Date(d.date + "T12:00:00Z").toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" }),
  }));
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  const row = (key, color, name) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, margin: "2px 0" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flex: "0 0 auto" }} />
      <span style={{ color: "var(--text-muted)" }}>{name}</span>
      <strong style={{ marginLeft: "auto", paddingLeft: 12 }}>{data[key] ?? 0}</strong>
    </div>
  );
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", minWidth: 180 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label || data.date}</div>
      {row("present", "#10b981", "Present")}
      {row("absent", "#ef4444", "Absent")}
      {row("missing", "#f59e0b", "Missing Clock-Out")}
      {row("late", "#8b5cf6", "Late")}
    </div>
  );
}

function DeptTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  const total = (data.present || 0) + (data.missing || 0) + (data.absent || 0) + (data.approved || 0);
  const row = (key, color, name) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, margin: "2px 0" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flex: "0 0 auto" }} />
      <span style={{ color: "var(--text-muted)" }}>{name}</span>
      <strong style={{ marginLeft: "auto", paddingLeft: 12 }}>{data[key] ?? 0}</strong>
    </div>
  );
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", minWidth: 200 }}>
      <div style={{ fontWeight: 600, marginBottom: 4, maxWidth: 240 }}>{label || data.department}</div>
      {row("present", "#10b981", "Present")}
      {row("missing", "#f59e0b", "Missing Clock-Out")}
      {row("absent", "#ef4444", "Absent")}
      {data.approved ? row("approved", "#3b82f6", "Approved") : null}
      {data.late ? row("late", "#8b5cf6", "Late (of present)") : null}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 4, fontWeight: 600 }}>Total employees: {total}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trendGranularity, setTrendGranularity] = useState("daily");
  const [resetModal, setResetModal] = useState(false);
  const [resetSearch, setResetSearch] = useState("");
  const [resetResults, setResetResults] = useState([]);
  const [resetPw, setResetPw] = useState("changeme123");
  const [resetTarget, setResetTarget] = useState(null);

  const loadDashboard = () => {
    setLoading(true);
    setError("");
    API.get("/reports/dashboard")
      .then((r) => setStats(r.data))
      .catch((err) => setError(err.response?.data?.error || "Unable to load dashboard data."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDashboard(); }, []);

  const searchUsers = async (q) => {
    setResetSearch(q);
    if (q.length < 2) { setResetResults([]); return; }
    try {
      const r = await API.get("/users");
      setResetResults(r.data.filter((u) => u.username.toLowerCase().includes(q.toLowerCase()) || (u.full_name || "").toLowerCase().includes(q.toLowerCase())));
    } catch (e) {}
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

  const trendData = useMemo(() => {
    if (!stats?.trend) return [];
    return aggregateTrend(stats.trend, trendGranularity);
  }, [stats, trendGranularity]);

  const deptChart = useMemo(() => {
    if (!stats?.departments) return [];
    return stats.departments.slice(0, 10).map((d) => ({
      department: d.name,
      present: d.present,
      missing: d.missing,
      absent: d.absent,
      late: d.late,
      approved: d.approved || 0,
    }));
  }, [stats]);
  const yMax = Math.max(stats?.total_employees || 10, 10);

  const todayAttendance = stats?.today_attendance || [];

  if (loading) {
    return (
      <div className="page-container">
        <div className="dash-header"><div><h1>Attendance Dashboard</h1></div></div>
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}><div className="loading-spinner" /></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="page-container">
        <div className="dash-header"><div><h1>Attendance Dashboard</h1></div></div>
        <div className="alert alert-error" role="alert">{error || "Failed to load dashboard data."}</div>
        <button className="btn btn-primary" onClick={loadDashboard}>Retry</button>
      </div>
    );
  }

  const summaryCards = [
    { label: "Total Employees", value: stats.total_employees, icon: "users", tone: "blue" },
    { label: "Present Today", value: stats.today.present, icon: "check-circle", tone: "green" },
    { label: "Absent", value: stats.today.absent, icon: "x", tone: "red" },
    { label: "Missed Clock-Out", value: stats.today.missing_checkout, icon: "clock", tone: "orange" },
    { label: "Late Arrivals", value: stats.today.late, icon: "alert", tone: "orange" },
  ];

  return (
    <div className="page-container">
      <div className="dash-header">
        <div className="dash-header-left">
          <button
            className="brand-mark brand-mark-sm brand-mark-btn"
            onClick={() => { if (window.location.pathname !== "/dashboard") navigate("/dashboard"); }}
            title="Home"
            aria-label="Go to Attendance Dashboard"
          >
            <Icon name="home" size={14} />
          </button>
          <div>
            <p className="eyebrow">Overview</p>
            <h1>Attendance Dashboard</h1>
            <p className="dash-date">{new Date((stats.date || "") + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</p>
          </div>
        </div>
        <div className="dash-header-right">
          <button className="btn btn-ghost notification-bell" onClick={() => navigate("/notifications")}>
            <Icon name="bell" size={18} />
          </button>
          <div className="dash-user" onClick={() => navigate("/my-attendance")}>
            <div className="avatar-sm">{(user?.full_name || user?.username || "U").charAt(0).toUpperCase()}</div>
            <div>
              <div className="sidebar-user-name">{user?.full_name || user?.username}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="stats-grid stats-grid-5">
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
              <div className="panel-subtitle">
                {trendGranularity === "daily" ? "Daily attendance over the past 30 working days"
                  : trendGranularity === "weekly" ? "Weekly attendance summary"
                  : "Monthly attendance summary"}
              </div>
            </div>
            <div className="period-toggle" role="group" aria-label="Trend granularity">
              {["daily", "weekly", "monthly"].map((g) => (
                <button key={g} type="button"
                  className={`period-btn${trendGranularity === g ? " active" : ""}`}
                  onClick={() => setTrendGranularity(g)}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-panel">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={28} />
                  <YAxis tick={{ fontSize: 11 }} width={46} domain={[0, yMax]} allowDecimals={false} />
                  <Tooltip content={<TrendTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={false} name="Present" />
                  <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={false} name="Absent" />
                  <Line type="monotone" dataKey="missing" stroke="#f59e0b" strokeWidth={2} dot={false} name="Missing Clock-Out" />
                  <Line type="monotone" dataKey="late" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Late" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="table-message">No trend data available</div>
            )}
          </div>
        </div>

        <div className="panel chart-section">
          <div className="panel-header">
            <div>
              <div className="panel-title">Attendance by Department</div>
              <div className="panel-subtitle">Today's attendance status per department (employee counts)</div>
            </div>
          </div>
          <div className="chart-panel" style={{ height: 430 }}>
            {deptChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChart} layout="vertical" margin={{ top: 12, right: 32, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={170} interval={0}
                    tickFormatter={(v) => (v.length > 26 ? v.slice(0, 26) + "\u2026" : v)} />
                  <Tooltip content={<DeptTooltip />} />
                  <Legend />
                  <Bar dataKey="present" stackId="a" fill="#10b981" name="Present" />
                  <Bar dataKey="missing" stackId="a" fill="#f59e0b" name="Missing Clock-Out" />
                  <Bar dataKey="absent" stackId="a" fill="#ef4444" radius={[0, 6, 6, 0]} name="Absent" />
                  <Bar dataKey="approved" stackId="a" fill="#3b82f6" radius={[0, 6, 6, 0]} name="Approved" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="table-message">No department data available</div>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Today's Attendance</div>
            <div className="panel-subtitle">Employee attendance for today</div>
          </div>
          <a href="/daily-report" className="btn btn-ghost btn-sm">
            View All <Icon name="arrow-right" size={13} />
          </a>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Employee</th>
                <th>Department</th>
                <th>First In</th>
                <th>Last Out</th>
                <th>Total Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {todayAttendance.length > 0 ? todayAttendance.slice(0, 15).map((emp, i) => (
                <tr key={emp.employee_id}>
                  <td className="td-muted">{i + 1}</td>
                  <td className="strong-cell">{emp.full_name}</td>
                  <td><span className="badge badge-blue">{emp.department || "—"}</span></td>
                  <td className="td-center">{emp.first_in || "—"}</td>
                  <td className="td-center">{emp.last_out || "—"}</td>
                  <td className="td-center">{emp.total_hours ? `${Number(emp.total_hours).toFixed(1)}h` : "—"}</td>
                  <td className="td-center">{statusBadge(emp.status)}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="table-message">No attendance data for today</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {todayAttendance.length > 15 && (
          <div className="table-footer">Showing 15 of {todayAttendance.length} employees &middot; <a href="/daily-report">View full report</a></div>
        )}
      </div>

      <div className="charts-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Recent Activity</div>
              <div className="panel-subtitle">Latest attendance requests</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {stats.recent_requests?.length > 0 ? stats.recent_requests.map((r) => (
                  <tr key={r.id}>
                    <td className="strong-cell">{r.employee_name}</td>
                    <td><span className="badge badge-blue">{(r.request_type || "").replace(/_/g, " ")}</span></td>
                    <td className="td-muted">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                    <td>
                      <span className={`badge badge-${r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "orange"}`}>
                        {(r.status || "").replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="table-message">No recent activity</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Quick Actions</div>
              <div className="panel-subtitle">Navigate to key sections</div>
            </div>
          </div>
          <div className="panel-body dash-quick-actions">
            <button className="btn btn-ghost dash-action-btn" onClick={() => navigate("/daily-report")}>
              <Icon name="calendar" size={16} /> Daily Report
            </button>
            <button className="btn btn-ghost dash-action-btn" onClick={() => navigate("/employees")}>
              <Icon name="users" size={16} /> Employees
            </button>
            <button className="btn btn-ghost dash-action-btn" onClick={() => navigate("/weekly-report")}>
              <Icon name="calendar" size={16} /> Weekly Report
            </button>
            <button className="btn btn-ghost dash-action-btn" onClick={() => navigate("/attendance-summary")}>
              <Icon name="check-circle" size={16} /> Attendance Summary
            </button>
            {user?.role === "admin" && (
              <>
                <div className="dash-action-divider" />
                <button className="btn btn-ghost dash-action-btn" onClick={() => setResetModal(true)}>
                  <Icon name="refresh" size={16} /> Reset Password
                </button>
                <button className="btn btn-ghost dash-action-btn" onClick={() => navigate("/admin/users")}>
                  <Icon name="settings" size={16} /> Manage Users
                </button>
              </>
            )}
          </div>
        </div>
      </div>

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
