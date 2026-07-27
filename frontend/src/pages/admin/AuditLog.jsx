import { useEffect, useState } from "react";
import API from "../../services/api";

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = {};
    if (actionFilter) params.action = actionFilter;
    API.get("/audit", { params }).then((r) => setLogs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [actionFilter]);

  const actionBadge = (action) => {
    if (action.includes("create")) return <span className="badge badge-green">{action.replace(/_/g, " ")}</span>;
    if (action.includes("delete")) return <span className="badge badge-red">{action.replace(/_/g, " ")}</span>;
    if (action.includes("login")) return <span className="badge badge-blue">{action.replace(/_/g, " ")}</span>;
    if (action.includes("approve")) return <span className="badge badge-teal">{action.replace(/_/g, " ")}</span>;
    return <span className="badge badge-orange">{action.replace(/_/g, " ")}</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Administration</p><h1>Audit Log</h1><p>Track all system actions and changes.</p></div>
        <div className="panel-actions">
          <input className="form-input form-input-sm" placeholder="Filter by action..." value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} />
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="table-message">Loading...</td></tr>
              : logs.length ? logs.map((l) => (
                <tr key={l.id}>
                  <td className="td-muted">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="strong-cell">{l.username || l.user_full_name || "System"}</td>
                  <td>{actionBadge(l.action)}</td>
                  <td className="td-muted">{l.entity_type ? `${l.entity_type} #${l.entity_id || ""}` : "—"}</td>
                  <td className="td-muted">{l.details ? JSON.stringify(l.details).slice(0, 100) : "—"}</td>
                </tr>
              )) : <tr><td colSpan="5" className="table-message">No audit logs found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
