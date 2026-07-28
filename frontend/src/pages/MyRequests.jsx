import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import Icon from "../components/Icon";

export default function MyRequests() {
  const [tab, setTab] = useState("attendance");
  const [attendanceReqs, setAttendanceReqs] = useState([]);
  const [leaveReqs, setLeaveReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

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

  const handleCancelRequest = async (id) => {
    if (!confirm("Cancel this request?")) return;
    try { await API.put(`/requests/${id}/cancel`); load(); } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleRecallRequest = async (id) => {
    if (!confirm("Recall this approved request? This will revert the attendance records.")) return;
    try { await API.put(`/requests/${id}/recall`); load(); } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleCancelLeave = async (id) => {
    if (!confirm("Cancel this leave request?")) return;
    try { await API.put(`/leave/${id}/cancel`); load(); } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleRecallLeave = async (id) => {
    if (!confirm("Recall this approved leave? This will revert attendance records and restore leave balance.")) return;
    try { await API.put(`/leave/${id}/recall`); load(); } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const statusBadge = (s) => {
    const map = { approved: "green", manager_approved: "teal", rejected: "red", pending: "orange", cancelled: "gray", recalled: "gray" };
    return <span className={`badge badge-${map[s] || "blue"}`}>{(s || "pending").replace(/_/g, " ")}</span>;
  };

  const approvalProgress = (r) => {
    if (r.status === "rejected") return 0;
    if (r.status === "approved") return 100;
    if (r.status === "manager_approved") return 50;
    return r.manager_status === "approved" ? 50 : 0;
  };

  const currentReqs = tab === "attendance" ? attendanceReqs : leaveReqs;
  const statusFiltered = filter === "all" ? currentReqs : currentReqs.filter((r) => r.status === filter);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return statusFiltered;
    return statusFiltered.filter((r) => {
      const fields = tab === "attendance"
        ? [r.request_type, r.reason, r.location, r.status]
        : [r.leave_type_name, r.reason, r.status];
      return fields.some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [statusFiltered, query, tab]);

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
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {["all", "pending", "manager_approved", "approved", "rejected"].map((f) => (
            <button key={f} className={`btn btn-sm btn-xs ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f.replace(/_/g, " ")}
            </button>
          ))}
          <label className="search-bar" style={{ marginLeft: 4 }}><Icon name="search" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." /></label>
        </div>
      </div>

      {tab === "attendance" ? (
        <div className="panel report-panel">
          <div className="table-wrap report-table-wrap">
            <table className="report-table">
              <thead>
                <tr><th>Type</th><th>Date</th><th>Time</th><th>Location</th><th>Reason</th><th>Approval Progress</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8} className="table-message">Loading...</td></tr>
                : filtered.length ? filtered.map((r) => (
                  <tr key={r.id}>
                    <td><span className="badge badge-blue">{r.request_type.replace(/_/g, " ")}</span></td>
                    <td className="td-muted">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="td-muted">{r.start_time && r.end_time ? `${r.start_time} - ${r.end_time}` : r.start_time || "\u2014"}</td>
                    <td className="td-muted">{r.location || "\u2014"}</td>
                    <td className="td-muted" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason || "\u2014"}</td>
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
                    <td className="td-center">
                      {r.status === "pending" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleCancelRequest(r.id)} title="Cancel" style={{ color: "var(--danger)" }}><Icon name="trash" size={14} /></button>
                      )}
                      {r.status === "manager_approved" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleCancelRequest(r.id)} title="Cancel" style={{ color: "var(--danger)" }}><Icon name="trash" size={14} /></button>
                      )}
                      {r.status === "approved" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleRecallRequest(r.id)} title="Recall" style={{ color: "var(--warning, #f59e0b)" }}><Icon name="refresh" size={14} /></button>
                      )}
                    </td>
                  </tr>
                )) : <tr><td colSpan={8} className="table-message">No requests found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel report-panel">
          <div className="table-wrap report-table-wrap">
            <table className="report-table">
              <thead>
                <tr><th>Type</th><th>Period</th><th>Reason</th><th>Status</th><th>Manager</th><th>HR</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="table-message">Loading...</td></tr>
                : filtered.length ? filtered.map((l) => (
                  <tr key={l.id}>
                    <td><span className="badge badge-blue">{l.leave_type_name}</span></td>
                    <td className="td-muted">{new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}</td>
                    <td className="td-muted" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.reason || "\u2014"}</td>
                    <td>{statusBadge(l.status)}</td>
                    <td className="td-muted">{l.manager_name || "\u2014"}</td>
                    <td className="td-muted">{l.hr_name || "\u2014"}</td>
                    <td className="td-center">
                      {l.status === "pending" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleCancelLeave(l.id)} title="Cancel" style={{ color: "var(--danger)" }}><Icon name="trash" size={14} /></button>
                      )}
                      {l.status === "manager_approved" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleCancelLeave(l.id)} title="Cancel" style={{ color: "var(--danger)" }}><Icon name="trash" size={14} /></button>
                      )}
                      {l.status === "approved" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleRecallLeave(l.id)} title="Recall" style={{ color: "var(--warning, #f59e0b)" }}><Icon name="refresh" size={14} /></button>
                      )}
                    </td>
                  </tr>
                )) : <tr><td colSpan={7} className="table-message">No leave requests found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
