import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import Icon from "../components/Icon";

const statusBadge = (s) => {
  const map = { present: "green", late: "orange", absent: "red", leave: "purple", field_duty: "teal" };
  return <span className={`badge badge-${map[s] || "blue"}`}>{(s || "no data").replace("_", " ")}</span>;
};

export default function MyTeam() {
  const [team, setTeam] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    API.get("/summary/my-team").then((r) => { setTeam(r.data.team); setPending(r.data.pending_requests); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const present = team.filter((t) => t.status === "present" || t.status === "late").length;
  const absent = team.filter((t) => t.status === "absent").length;

  const filteredTeam = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return team;
    return team.filter((t) => [t.full_name, t.position, t.status].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [team, query]);

  const filteredPending = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return pending;
    return pending.filter((r) => [r.employee_name, r.request_type, r.reason].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [pending, query]);

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Team</p><h1>My Team</h1><p>Monitor your team's attendance and pending requests.</p></div>
      </div>

      <div className="stats-grid stats-grid-3">
        <article className="stat-card blue"><span className="stat-icon"><Icon name="team" size={20} /></span><div><p className="stat-label">Team Size</p><div className="stat-value">{team.length}</div></div></article>
        <article className="stat-card green"><span className="stat-icon"><Icon name="check-circle" size={20} /></span><div><p className="stat-label">Present Today</p><div className="stat-value">{present}</div></div></article>
        <article className="stat-card red"><span className="stat-icon"><Icon name="x" size={20} /></span><div><p className="stat-label">Absent Today</p><div className="stat-value">{absent}</div></div></article>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Team Members</div>
          <label className="search-bar"><Icon name="search" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team..." /></label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Position</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" className="table-message">Loading...</td></tr>
              : filteredTeam.length ? filteredTeam.map((t) => (
                <tr key={t.id}>
                  <td className="strong-cell">{t.full_name}</td>
                  <td className="td-muted">{t.position || "—"}</td>
                  <td className="td-muted">{t.first_in ? new Date(t.first_in).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="td-muted">{t.last_out ? new Date(t.last_out).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="td-muted">{t.total_hours ? `${t.total_hours}h` : "—"}</td>
                  <td>{statusBadge(t.status)}</td>
                </tr>
              )) : <tr><td colSpan="6" className="table-message">No team members found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {filteredPending.length > 0 && (
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Pending Requests</div><div className="panel-subtitle">{filteredPending.length} requests awaiting your approval</div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Date</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {filteredPending.map((r) => (
                  <tr key={r.id}>
                    <td className="strong-cell">{r.employee_name}</td>
                    <td><span className="badge badge-blue">{r.request_type.replace("_", " ")}</span></td>
                    <td className="td-muted">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="td-muted">{r.reason || "—"}</td>
                    <td><span className="badge badge-orange">{r.status.replace("_", " ")}</span></td>
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
