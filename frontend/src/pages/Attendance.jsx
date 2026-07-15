import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import Icon from "../components/Icon";

const formatTime = (iso) => iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

export default function Attendance() {
  const [attendance, setAttendance] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { API.get("/attendance").then((res) => setAttendance(res.data)).catch(() => setAttendance([])).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => attendance.filter((row) => [row.full_name, row.department, row.source].some((value) => String(value || "").toLowerCase().includes(query.toLowerCase()))), [attendance, query]);
  return <section className="fade-in">
    <div className="page-header page-header-row"><div><p className="eyebrow">Records</p><h1>Attendance</h1><p>Review biometric check-ins captured from BioTime.</p></div><div className="header-count">{attendance.length} records</div></div>
    <div className="panel"><div className="panel-header"><div><div className="panel-title">Attendance log</div><div className="panel-subtitle">Most recent scans appear first</div></div><label className="search-bar"><Icon name="search" size={16}/><input aria-label="Search attendance" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search attendance" /></label></div>
      <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>Scan time</th><th>Source</th><th>Log ID</th></tr></thead><tbody>{loading ? <tr><td colSpan="5" className="table-message">Loading attendance records…</td></tr> : filtered.length ? filtered.map((row) => <tr key={row.id}><td className="strong-cell">{row.full_name}</td><td><span className="badge badge-blue">{row.department || "Unassigned"}</span></td><td className="td-muted">{formatTime(row.scan_time)}</td><td><span className="badge badge-green">{row.source || "BioTime"}</span></td><td className="td-muted">#{row.id}</td></tr>) : <tr><td colSpan="5" className="table-message">No attendance records match your search.</td></tr>}</tbody></table></div>
      {!loading && <div className="table-footer">Showing {filtered.length} of {attendance.length} records</div>}</div>
  </section>;
}
