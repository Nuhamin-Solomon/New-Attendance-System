import { useEffect, useState } from "react";
import API from "../services/api";
import Icon from "../components/Icon";

export default function MyRequests() {
  const [tab, setTab] = useState("attendance");
  const [attendanceReqs, setAttendanceReqs] = useState([]);
  const [leaveReqs, setLeaveReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = () => {
    setLoading(true);
    Promise.all([
      API.get("/requests", { params: { mine: "true" } }),
      API.get("/leave", { params: { mine: "true" } }),
    ]).then(([reqRes, leaveRes]) => {
      setAttendanceReqs(reqRes.data);
      setLeaveReqs(leaveRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const statusBadge = (s) => {
    const map = { approved: "green", manager_approved: "teal", rejected: "red", pending: "orange" };
    return <span className={`badge badge-${map[s] || "blue"}`}>{(s || "pending").replace(/_/g, " ")}</span>;
  };

  const approvalProgress = (r) => {
    if (r.status === "rejected") return 0;
    if (r.status === "approved") return 100;
    if (r.status === "manager_approved") return 50;
    return r.manager_status === "approved" ? 50 : 0;
  };

  const currentReqs = tab === "attendance" ? attendanceReqs : leaveReqs;
  const filtered = filter === "all" ? currentReqs : currentReqs.filter((r) => r.status === filter);
  const allPending = [...attendanceReqs, ...leaveReqs].filter((r) => r.status === "pending").length;

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Workplace</p><h1>My Requests</h1><p>Track all your attendance and leave requests.</p></div>
      </div>

      <div className="stats-grid stats-grid-4 no-print">
        <article className="stat-card orange"><div className="stat-icon"><Icon name="clock" size={18} /></div><div><p className="stat-label">Pending</p><p className="stat-value">{allPending}</p></div></article>
        <article className="stat-card teal"><div className="stat-icon"><Icon name="check-circle" size={18} /></div><div><p className="stat-label">Manager Approved</p><p className="stat-value">{[...attendanceReqs, ...leaveReqs].filter((r) => r.status === "manager_approved").length}</p></div></article>
        <article className="stat-card green"><div className="stat-icon"><Icon name="check-circle" size={18} /></div><div><p className="stat-label">Fully Approved</p><p className="stat-value">{[...attendanceReqs, ...leaveReqs].filter((r) => r.status === "approved").length}</p></div></article>
        <article className="stat-card red"><div className="stat-icon"><Icon name="x" size={18} /></div><div><p className="stat-label">Rejected</p><p className="stat-value">{[...attendanceReqs, ...leaveReqs].filter((r) => r.status === "rejected").length}</p></div></article>
      </div>

      <div className="panel-actions-row no-print">
        <div style={{ display: "flex", gap: "6px" }}>
          <button className={`btn btn-sm ${tab === "attendance" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("attendance")}>
            Duty Requests ({attendanceReqs.length})
          </button>
          <button className={`btn btn-sm ${tab === "leave" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("leave")}>
            Leave Requests ({leaveReqs.length})
          </button>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {["all", "pending", "manager_approved", "approved", "rejected"].map((f) => (
            <button key={f} className={`btn btn-sm btn-xs ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {tab === "attendance" ? (
        <div className="panel report-panel">
          <div className="table-wrap report-table-wrap">
            <table className="report-table">
              <thead>
                <tr><th>Type</th><th>Date</th><th>Time</th><th>Location</th><th>Reason</th><th>Approval Progress</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="table-message">Loading...</td></tr>
                : filtered.length ? filtered.map((r) => (
                  <tr key={r.id}>
                    <td><span className="badge badge-blue">{r.request_type.replace(/_/g, " ")}</span></td>
                    <td className="td-muted">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="td-muted">{r.start_time && r.end_time ? `${r.start_time} - ${r.end_time}` : r.start_time || "—"}</td>
                    <td className="td-muted">{r.location || "—"}</td>
                    <td className="td-muted" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason || "—"}</td>
                    <td className="td-center">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" }}>
                        <div style={{ width: 60, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${approvalProgress(r)}%`, height: "100%", background: r.status === "rejected" ? "var(--danger)" : "var(--primary)", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{approvalProgress(r)}%</span>
                      </div>
                      {r.manager_comment && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: 2 }}>Mgr: {r.manager_comment}</div>}
                      {r.hr_comment && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: 2 }}>HR: {r.hr_comment}</div>}
                    </td>
                    <td>{statusBadge(r.status)}</td>
                  </tr>
                )) : <tr><td colSpan={7} className="table-message">No requests found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel report-panel">
          <div className="table-wrap report-table-wrap">
            <table className="report-table">
              <thead>
                <tr><th>Type</th><th>Period</th><th>Reason</th><th>Status</th><th>Approved By</th><th>Date</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="table-message">Loading...</td></tr>
                : filtered.length ? filtered.map((l) => (
                  <tr key={l.id}>
                    <td><span className="badge badge-blue">{l.leave_type_name}</span></td>
                    <td className="td-muted">{new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}</td>
                    <td className="td-muted" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.reason || "—"}</td>
                    <td>{statusBadge(l.status)}</td>
                    <td className="td-muted">{l.approved_by ? `User #${l.approved_by}` : "—"}</td>
                    <td className="td-muted">{l.approved_at ? new Date(l.approved_at).toLocaleDateString() : "—"}</td>
                  </tr>
                )) : <tr><td colSpan={6} className="table-message">No leave requests found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
