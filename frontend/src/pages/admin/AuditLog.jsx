import { useEffect, useState, useCallback } from "react";
import API from "../../services/api";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 25;

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [logs, setLogs] = useState([]);
  const [actionFilter, setActionFilter] = useState("");
  const [searchInput, setSearchInput] = useState(actionFilter);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setActionFilter(searchInput), 250);
    return () => clearTimeout(id);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (actionFilter) params.action = actionFilter;
      const res = await API.get("/audit", { params });
      const d = res.data;
      if (Array.isArray(d)) {
        const start = (page - 1) * PAGE_SIZE;
        setLogs(d.slice(start, start + PAGE_SIZE));
        setTotal(d.length);
        setTotalPages(Math.max(1, Math.ceil(d.length / PAGE_SIZE)));
      } else {
        setLogs(d.data || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 1);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [actionFilter]);

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
          <label className="search-bar">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /></svg>
            <input className="form-input-sm" style={{ border: "none", outline: "none", background: "transparent", width: 200 }}
              placeholder="Filter by action..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="table-message">Loading...</td></tr>
              : logs.length ? logs.map((l) => (
                <tr key={l.id}>
                  <td className="td-muted">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="strong-cell">{l.username || l.user_full_name || "System"}</td>
                  <td>{actionBadge(l.action)}</td>
                  <td className="td-muted">{l.entity_type ? `${l.entity_type} #${l.entity_id || ""}` : "—"}</td>
                  <td className="td-muted">{l.details ? JSON.stringify(l.details).slice(0, 100) : "—"}</td>
                </tr>
              )) : <tr><td colSpan={5} className="table-message">No audit logs found.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="log entries" />
      </div>
    </div>
  );
}
