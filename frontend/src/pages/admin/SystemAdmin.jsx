import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import Icon from "../../components/Icon";

const HUB_CARDS = [
  { path: "/admin/users", label: "User Management", desc: "Create users, assign roles, link employees", icon: "users", tone: "teal" },
  { path: "/admin/roles", label: "Roles & Permissions", desc: "Manage access levels and permissions", icon: "shield", tone: "orange" },
  { path: "/admin/departments", label: "Departments", desc: "Configure departments and assignments", icon: "building", tone: "teal" },
  { path: "/admin/settings", label: "System Settings", desc: "Company info, attendance rules, integrations", icon: "settings", tone: "orange" },
  { path: "/admin/audit", label: "Audit Log", desc: "Track every system action and change", icon: "eye", tone: "teal" },
  { path: "/admin/data", label: "Data Import/Export", desc: "Import employees, export reports", icon: "database", tone: "orange" },
];

const actionBadge = (action) => {
  if (action.includes("create")) return <span className="badge badge-green">{action.replace(/_/g, " ")}</span>;
  if (action.includes("delete")) return <span className="badge badge-red">{action.replace(/_/g, " ")}</span>;
  if (action.includes("login")) return <span className="badge badge-blue">{action.replace(/_/g, " ")}</span>;
  if (action.includes("approve")) return <span className="badge badge-teal">{action.replace(/_/g, " ")}</span>;
  return <span className="badge badge-orange">{action.replace(/_/g, " ")}</span>;
};

export default function SystemAdmin() {
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [usersCount, setUsersCount] = useState(0);
  const [employeesCount, setEmployeesCount] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [syncing, setSyncing] = useState(null);
  const [syncResult, setSyncResult] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const results = await Promise.allSettled([
      API.get("/health"), API.get("/users"), API.get("/employees/departments"),
      API.get("/reports/dashboard"), API.get("/audit"),
    ]);
    if (results[0].status === "fulfilled") setHealth(results[0].value.data);
    if (results[1].status === "fulfilled") setUsersCount(results[1].value.data.length);
    if (results[2].status === "fulfilled") setDepartments(results[2].value.data || []);
    if (results[3].status === "fulfilled") setEmployeesCount(results[3].value.data?.total_employees ?? null);
    if (results[4].status === "fulfilled") setLogs((results[4].value.data || []).slice(0, 8));
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleSync = async (kind) => {
    setSyncing(kind);
    setSyncResult("");
    try {
      const r = await API.post(`/sync/${kind === "full" ? "full" : kind}`, {});
      setSyncResult(r.data.message || "Synchronization complete.");
      load();
    } catch (err) {
      setSyncResult(`Sync failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setSyncing(null);
    }
  };

  const stat = (label, value, sub, tone) => (
    <div className="panel sys-stat" key={label}>
      <div className={`sys-stat-dot sys-dot-${tone}`} />
      <div>
        <div className="sys-stat-label">{label}</div>
        <div className="sys-stat-value">{value}</div>
        <div className="sys-stat-sub">{sub}</div>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div>
          <p className="eyebrow">System Administrator</p>
          <h1>System Administration</h1>
          <p>Central hub for users, permissions, integrations, and system oversight.</p>
        </div>
        <div className="panel-actions">
          <button className="btn btn-primary" onClick={() => handleSync("full")} disabled={syncing}>
            <Icon name="sync" size={16} />
            {syncing === "full" ? "Syncing..." : "Full Sync"}
          </button>
        </div>
      </div>

      {syncResult && <div className={`alert ${syncResult.startsWith("Sync failed") ? "alert-error" : "alert-success"}`}>{syncResult}</div>}

      <div className="sys-stats">
        {stat("System Users", loading ? "—" : usersCount, "Accounts in the platform", "teal")}
        {stat("Employees", employeesCount == null ? "—" : employeesCount, "Synced from BioTime", "orange")}
        {stat("Departments", loading ? "—" : departments.length, "Configured divisions", "teal")}
        {stat("Database", health ? (health.db ? "Connected" : "Error") : "—",
          health ? `Uptime ${Math.floor(health.uptime / 60)}m` : "Checking...",
          health?.db ? "green" : (health && !health.db ? "red" : "orange"))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Administration</div>
        </div>
        <div className="sys-hub-grid">
          {HUB_CARDS.map((c) => (
            <button key={c.path} className="hub-card" onClick={() => navigate(c.path)}>
              <div className={`hub-card-icon hub-icon-${c.tone}`}><Icon name={c.icon} size={22} /></div>
              <div>
                <div className="hub-card-title">{c.label}</div>
                <div className="hub-card-desc">{c.desc}</div>
              </div>
              <Icon name="arrow-right" size={16} className="hub-card-arrow" />
            </button>
          ))}
        </div>
      </div>

      <div className="sys-two-col">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">BioTime Synchronization</div>
          </div>
          <div className="panel-body">
            <p className="sys-hint">BioTime is the source of truth for employees and attendance. Sync pulls the latest records without deleting history.</p>
            <div className="sys-sync-actions">
              <button className="btn btn-outline" onClick={() => handleSync("employees")} disabled={syncing}>
                <Icon name="users" size={16} />
                {syncing === "employees" ? "Syncing..." : "Sync Employees"}
              </button>
              <button className="btn btn-outline" onClick={() => handleSync("attendance")} disabled={syncing}>
                <Icon name="clock" size={16} />
                {syncing === "attendance" ? "Syncing..." : "Sync Attendance"}
              </button>
              <button className="btn btn-primary" onClick={() => handleSync("full")} disabled={syncing}>
                <Icon name="sync" size={16} />
                {syncing === "full" ? "Syncing..." : "Full Sync"}
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">System Status</div>
          </div>
          <div className="panel-body">
            <div className="sys-status-row">
              <span className="badge badge-green">API Online</span>
              <span className="sys-status-text">Backend responding normally</span>
            </div>
            <div className="sys-status-row">
              {health?.db
                ? <span className="badge badge-green">Database Connected</span>
                : <span className="badge badge-red">Database Offline</span>}
              <span className="sys-status-text">{health ? `Uptime ${Math.floor(health.uptime / 60)}m` : "Checking..."}</span>
            </div>
            <div className="sys-status-row">
              <span className="badge badge-teal">Auto Sync</span>
              <span className="sys-status-text">Runs every 60s while server is live</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header page-header-row">
          <div className="panel-title">Recent Activity</div>
          <button className="link-btn" onClick={() => navigate("/admin/audit")}>View all →</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="5" className="table-message">No recent activity.</td></tr>
              ) : logs.map((l) => (
                <tr key={l.id}>
                  <td className="td-muted">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="strong-cell">{l.username || l.user_full_name || "System"}</td>
                  <td>{actionBadge(l.action)}</td>
                  <td className="td-muted">{l.entity_type ? `${l.entity_type} #${l.entity_id || ""}` : "—"}</td>
                  <td className="td-muted">{l.details ? JSON.stringify(l.details).slice(0, 100) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
