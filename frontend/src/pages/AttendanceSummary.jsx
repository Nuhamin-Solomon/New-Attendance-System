import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import SearchBar from "../components/SearchBar";
import { formatBioTimeDateValue, formatBioTimeTimeValue } from "../utils/time";
import { matchesSearch } from "../utils/search";
const statusBadge = (s) => {
  const map = { present: "green", late: "orange", absent: "red", leave: "purple", field_duty: "teal" };
  return <span className={`badge badge-${map[s] || "blue"}`}>{(s || "unknown").replace("_", " ")}</span>;
};

const dropdownStyle = {
  position: "absolute", zIndex: 50, top: "100%", left: 0, right: 0, marginTop: 4,
  background: "var(--card, #fff)", border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 240, overflowY: "auto",
};

const dropdownItemStyle = {
  padding: "8px 12px", cursor: "pointer", fontSize: 14,
  borderBottom: "1px solid var(--border, #f0f0f0)", display: "flex", gap: 8, alignItems: "center",
};

const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return toKey(d); };

function weekRange(dateKey) {
  const d = parseKey(dateKey);
  const dow = d.getDay();
  const monday = addDays(dateKey, dow === 0 ? -6 : 1 - dow);
  return { start: monday, end: addDays(monday, 4) };
}

function monthRange(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${monthKey}-01`, end: `${monthKey}-${String(last).padStart(2, "0")}` };
}

const fmtDay = (k) => parseKey(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtMonth = (m) => new Date(`${m}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const fmtPeriod = (mode, start, end) =>
  mode === "daily" ? fmtDay(start)
  : mode === "weekly" ? `${fmtDay(start)} \u2013 ${fmtDay(end)}`
  : fmtMonth(end.slice(0, 7));

export default function AttendanceSummary() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [dept, setDept] = useState("");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [empQuery, setEmpQuery] = useState("");
  const [empResults, setEmpResults] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [periodMode, setPeriodMode] = useState("weekly");
  const [periodDate, setPeriodDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [periodMonth, setPeriodMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => { API.get("/employees/departments").then((r) => setDepartments(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    const params = { start_date: dateFrom, end_date: dateTo };
    if (dept) params.department = dept;
    API.get("/summary", { params }).then((r) => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [dept, dateFrom, dateTo]);

  useEffect(() => {
    const q = empQuery.trim();
    if (!q || selectedEmployee) { setEmpResults([]); return; }
    const t = setTimeout(() => {
      API.get("/summary/employees", { params: { search: q } })
        .then((r) => setEmpResults(r.data))
        .catch(() => setEmpResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [empQuery, selectedEmployee]);

  const { periodStart, periodEnd } = (() => {
    if (periodMode === "monthly") return monthRange(periodMonth);
    if (periodMode === "daily") return { start: periodDate, end: periodDate };
    return weekRange(periodDate);
  })();

  useEffect(() => {
    if (!selectedEmployee) { setSummary(null); return; }
    setSummaryLoading(true);
    API.get("/summary/employee", {
      params: { employee_id: selectedEmployee.id, start_date: periodStart, end_date: periodEnd },
    })
      .then((r) => setSummary(r.data))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [selectedEmployee, periodStart, periodEnd]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    return rows.filter((r) => matchesSearch(r, query, ["full_name", "card_id", "employee_id", "department", "status"]));
  }, [rows, query]);

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Attendance</p><h1>Attendance Summary</h1><p>Summarized daily attendance with first in, last out, and status.</p></div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Employee Attendance Summary</div>
            <div className="panel-subtitle">Search an employee and pick a period to view BioTime-based daily, weekly, or monthly totals</div>
          </div>
          <div className="panel-actions">
            <div style={{ position: "relative", minWidth: 260 }}>
              <SearchBar
                value={selectedEmployee ? `${selectedEmployee.full_name} (${selectedEmployee.card_id || selectedEmployee.id})` : empQuery}
                onChange={(v) => { setEmpQuery(v); setSelectedEmployee(null); }}
                placeholder="Search employees..."
              />
              {!selectedEmployee && empQuery.trim() && (
                <div style={dropdownStyle}>
                  {empResults.length ? empResults.map((e) => (
                    <div key={e.id} style={dropdownItemStyle} onClick={() => { setSelectedEmployee(e); setEmpQuery(""); setEmpResults([]); }}>
                      <strong>{e.full_name}</strong>
                      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{e.card_id || e.id}</span>
                      <span className="badge badge-blue">{e.department || "—"}</span>
                    </div>
                  )) : <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No employees found</div>}
                </div>
              )}
            </div>
            <div className="period-toggle" role="group" aria-label="Summary period">
              {["daily", "weekly", "monthly"].map((m) => (
                <button key={m} type="button"
                  className={periodMode === m ? "period-btn active" : "period-btn"}
                  onClick={() => setPeriodMode(m)}>{m[0].toUpperCase() + m.slice(1)}</button>
              ))}
            </div>
            {periodMode === "monthly" ? (
              <input type="month" className="form-input form-input-sm" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
            ) : (
              <input type="date" className="form-input form-input-sm" value={periodDate} onChange={(e) => setPeriodDate(e.target.value)} />
            )}
          </div>
        </div>
        {selectedEmployee && (
          <div>
            {summaryLoading ? (
              <div className="panel-body" style={{ color: "var(--text-muted)" }}>Loading summary...</div>
            ) : summary ? (
              <>
                <div className="summary-employee-row">
                  <strong>{summary.employee.full_name}</strong>
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{summary.employee.card_id || summary.employee.id}</span>
                  <span className="badge badge-blue">{summary.employee.department || "—"}</span>
                  <span className="summary-period">{fmtPeriod(periodMode, periodStart, periodEnd)}</span>
                </div>
                <div className="day-status-list">
                  {summary.days.map((d) => (
                    <div key={d.date} className={`day-status-chip status-${d.status}`}>
                      <span className="day-status-name">{d.day}</span>
                      <span className="day-status-date">{d.date.slice(5)}</span>
                      <span className="day-status-value">{d.status.replace("_", " ")}</span>
                    </div>
                  ))}
                </div>
                <div className="stats-grid stats-grid-5">
                  <article className="stat-card blue"><div className="stat-icon"><Icon name="calendar" size={18} /></div><div><p className="stat-label">Working Days</p><p className="stat-value">{summary.total_working_days}</p></div></article>
                  <article className="stat-card green"><div className="stat-icon"><Icon name="check-circle" size={18} /></div><div><p className="stat-label">Present</p><p className="stat-value">{summary.present_days} Day{summary.present_days === 1 ? "" : "s"}</p></div></article>
                  <article className="stat-card red"><div className="stat-icon"><Icon name="x" size={18} /></div><div><p className="stat-label">Absent</p><p className="stat-value">{summary.absent_days} Day{summary.absent_days === 1 ? "" : "s"}</p></div></article>
                  <article className="stat-card orange"><div className="stat-icon"><Icon name="clock" size={18} /></div><div><p className="stat-label">Missing Check-Out</p><p className="stat-value">{summary.missing_checkout} Day{summary.missing_checkout === 1 ? "" : "s"}</p></div></article>
                  <article className="stat-card teal"><div className="stat-icon"><Icon name="file-text" size={18} /></div><div><p className="stat-label">Total Hours</p><p className="stat-value">{summary.total_hours}h</p></div></article>
                </div>
                <div className="table-footer">Approved: {summary.approved_days} | Leave: {summary.leave_days} | Generated from BioTime attendance records</div>
              </>
            ) : (
              <div className="panel-body" style={{ color: "var(--text-muted)" }}>No summary data for this period.</div>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div><div className="panel-title">Daily Summary</div></div>
          <div className="panel-actions">
            <select className="form-input form-select-sm" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <input type="date" className="form-input form-input-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" className="form-input form-input-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <SearchBar value={query} onChange={setQuery} />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Department</th><th>Date</th><th>First In</th><th>Last Out</th><th>Hours</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="table-message">Loading...</td></tr>
              : filtered.length ? filtered.map((r, i) => (
                <tr key={i}>
                  <td className="strong-cell">{r.full_name}</td>
                  <td><span className="badge badge-blue">{r.department || "—"}</span></td>
                  <td className="td-muted">{r.date ? formatBioTimeDateValue(r.date) : "—"}</td>
                  <td className="td-muted">{r.first_in ? formatBioTimeTimeValue(r.first_in) : "—"}</td>
                  <td className="td-muted">{r.last_out ? formatBioTimeTimeValue(r.last_out) : "—"}</td>
                  <td className="td-muted">{r.total_hours ? `${r.total_hours}h` : "—"}</td>
                  <td>{statusBadge(r.status)}</td>
                </tr>
              )) : <tr><td colSpan="7" className="table-message">No attendance data for this period.</td></tr>}
            </tbody>
          </table>
        </div>
        {!loading && <div className="table-footer">Showing {filtered.length} of {rows.length} records</div>}
      </div>
    </div>
  );
}
