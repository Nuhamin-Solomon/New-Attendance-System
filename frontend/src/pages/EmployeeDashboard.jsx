import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import Icon from "../components/Icon";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [todayData, setTodayData] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.employee_id) return;
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

    Promise.all([
      API.get("/summary/my", { params: { start_date: today, end_date: today } }),
      API.get("/summary/my", { params: { start_date: weekAgo, end_date: today } }),
      API.get("/requests", { params: { mine: "true" } }),
      API.get("/leave", { params: { mine: "true" } }),
    ]).then(([todayRes, weekRes, reqRes, leaveRes]) => {
      setTodayData(todayRes.data[0] || null);
      setRecentRecords(weekRes.data.slice(0, 7));
      setPendingRequests(reqRes.data.filter((r) => r.status === "pending").length);
      setPendingLeaves(leaveRes.data.filter((l) => l.status === "pending").length);
      setRecentRequests(reqRes.data.slice(0, 5));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const today = new Date();
  const dayName = today.toLocaleDateString("en-GB", { weekday: "long" });
  const dateStr = today.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const totalWeekHours = recentRecords.reduce((s, r) => s + (parseFloat(r.total_hours) || 0), 0);

  const statusBadge = (s) => {
    const map = { present: "green", late: "orange", absent: "red", leave: "purple", field_duty: "teal", approved: "green", present_incomplete: "orange" };
    return <span className={`badge badge-${map[s] || "blue"}`}>{(s || "no data").replace(/_/g, " ")}</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Welcome Back</p>
          <h1>Good {today.getHours() < 12 ? "Morning" : today.getHours() < 17 ? "Afternoon" : "Evening"}, {user?.full_name?.split(" ")[0] || "Employee"}</h1>
          <p>{dayName}, {dateStr}</p>
        </div>
      </div>

      <div className="stats-grid stats-grid-4">
        <article className="stat-card green">
          <div className="stat-icon"><Icon name="check-circle" size={20} /></div>
          <div><p className="stat-label">Today's Status</p><div className="stat-value">{todayData ? statusBadge(todayData.status) : <span className="badge badge-gray">No data</span>}</div></div>
        </article>
        <article className="stat-card blue">
          <div className="stat-icon"><Icon name="clock" size={20} /></div>
          <div><p className="stat-label">Today's Hours</p><div className="stat-value">{todayData?.total_hours ? `${parseFloat(todayData.total_hours).toFixed(1)}h` : "0h"}</div></div>
        </article>
        <article className="stat-card orange">
          <div className="stat-icon"><Icon name="database" size={20} /></div>
          <div><p className="stat-label">This Week</p><div className="stat-value">{totalWeekHours.toFixed(1)}h</div></div>
        </article>
        <article className="stat-card teal">
          <div className="stat-icon"><Icon name="file-text" size={20} /></div>
          <div><p className="stat-label">Pending Actions</p><div className="stat-value">{pendingRequests + pendingLeaves}</div></div>
        </article>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Today's Attendance</div></div>
          <div className="panel-body">
            {todayData ? (
              <div style={{ display: "grid", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-muted">Check In</span><strong>{todayData.first_in ? new Date(todayData.first_in).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-muted">Check Out</span><strong>{todayData.last_out ? new Date(todayData.last_out).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-muted">Working Hours</span><strong>{todayData.total_hours ? `${parseFloat(todayData.total_hours).toFixed(1)}h` : "—"}</strong></div>
                {todayData.status === "present_incomplete" && <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-muted">Reminder</span><span className="badge badge-orange">Don't forget to check out!</span></div>}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No attendance recorded today. Scan your badge at the biometric device.</p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><div className="panel-title">Quick Actions</div></div>
          <div className="panel-body" style={{ display: "grid", gap: "10px" }}>
            <a href="/my-attendance" className="btn btn-ghost" style={{ justifyContent: "flex-start" }}><Icon name="calendar" size={16} /> View My Attendance</a>
            <a href="/requests" className="btn btn-ghost" style={{ justifyContent: "flex-start" }}><Icon name="edit" size={16} /> Submit Duty Request</a>
            <a href="/leave" className="btn btn-ghost" style={{ justifyContent: "flex-start" }}><Icon name="file-text" size={16} /> Apply for Leave</a>
            <a href="/notifications" className="btn btn-ghost" style={{ justifyContent: "flex-start" }}><Icon name="bell" size={16} /> Notifications {pendingRequests + pendingLeaves > 0 && <span className="badge badge-orange" style={{ marginLeft: 8 }}>{pendingRequests + pendingLeaves}</span>}</a>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: "20px" }}>
        <div className="panel-header"><div className="panel-title">Recent Attendance (Last 7 Days)</div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr></thead>
            <tbody>
              {recentRecords.length ? recentRecords.map((r) => (
                <tr key={r.id}>
                  <td className="strong-cell">{new Date(r.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}</td>
                  <td className="td-muted">{r.first_in ? new Date(r.first_in).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="td-muted">{r.last_out ? new Date(r.last_out).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="td-muted">{r.total_hours ? `${parseFloat(r.total_hours).toFixed(1)}h` : "—"}</td>
                  <td>{statusBadge(r.status)}</td>
                </tr>
              )) : <tr><td colSpan={5} className="table-message">No records this week.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {recentRequests.length > 0 && (
        <div className="panel" style={{ marginTop: "20px" }}>
          <div className="panel-header"><div className="panel-title">Recent Requests</div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Date</th><th>Status</th><th>Manager</th><th>HR</th></tr></thead>
              <tbody>
                {recentRequests.map((r) => (
                  <tr key={r.id}>
                    <td><span className="badge badge-blue">{r.request_type.replace(/_/g, " ")}</span></td>
                    <td className="td-muted">{new Date(r.date).toLocaleDateString()}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td><span className={`badge badge-${r.manager_status === "approved" ? "green" : r.manager_status === "rejected" ? "red" : "orange"}`}>{r.manager_status.replace(/_/g, " ")}</span></td>
                    <td><span className={`badge badge-${r.hr_status === "approved" ? "green" : r.hr_status === "rejected" ? "red" : "orange"}`}>{r.hr_status.replace(/_/g, " ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
