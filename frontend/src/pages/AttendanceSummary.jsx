import { useEffect, useState, useMemo, Fragment } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import SearchBar from "../components/SearchBar";
import { formatBioTimeDateValue, formatBioTimeTimeValue } from "../utils/time";
import { matchesSearch } from "../utils/search";

const statusBadge = (s) => {
  if (s === "present_partial") s = "present";
  const map = {
    present: "green", late: "orange", absent: "red", leave: "purple", on_leave: "purple",
    approved: "blue", field_duty: "teal", present_incomplete: "orange",
  };
  return <span className={`badge badge-${map[s] || "blue"}`}>{(s || "unknown").replace(/_/g, " ")}</span>;
};

const CAT_PRESENT = "present";
const CAT_ABSENT = "absent";
const CAT_MISSING = "missing_checkout";

const categoryMeta = {
  [CAT_PRESENT]: { label: "Present", icon: "check-circle", tone: "green", hint: "Checked in during the period" },
  [CAT_ABSENT]: { label: "Absent", icon: "x", tone: "red", hint: "No clock-in recorded" },
  [CAT_MISSING]: { label: "Missed Clock-Out", icon: "clock", tone: "orange", hint: "Checked in without checkout" },
};

function recordCategory(r) {
  const st = r.status;
  if (!st) return CAT_ABSENT;
  if (st === "present_incomplete") return CAT_MISSING;
  if (r.first_in && !r.last_out) return CAT_MISSING;
  if (st === "absent") return CAT_ABSENT;
  return CAT_PRESENT;
}

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

function fmtAgg(e) {
  const parts = [];
  if (e.present) parts.push(`${e.present} present`);
  if (e.missing_checkout) parts.push(`${e.missing_checkout} missed CO`);
  if (e.absent) parts.push(`${e.absent} absent`);
  const extra = [];
  if (e.leave) extra.push(`${e.leave} leave`);
  if (e.approved) extra.push(`${e.approved} approved`);
  let s = parts.join(" \u00b7 ");
  if (extra.length) s += (s ? "  |  " : "") + extra.join(" \u00b7 ");
  return s || "\u2014";
}

export default function AttendanceSummary() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [dept, setDept] = useState("");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [expanded, setExpanded] = useState(null);

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

  const overview = useMemo(() => {
    const empMap = new Map();
    for (const r of rows) {
      const id = r.employee_id;
      if (!empMap.has(id)) {
        empMap.set(id, {
          employee_id: id, card_id: r.card_id, full_name: r.full_name, department: r.department,
          days: [], present: 0, absent: 0, missing_checkout: 0, leave: 0, approved: 0,
        });
      }
      const e = empMap.get(id);
      const cat = recordCategory(r);
      e.days.push({ date: r.date, status: r.status, cat, first_in: r.first_in, last_out: r.last_out });
      e[cat]++;
      if (r.status === "on_leave" || r.status === "leave") e.leave++;
      if (r.status === "approved") e.approved++;
    }
    const list = [...empMap.values()];
    for (const e of list) {
      e.primary = e.missing_checkout > 0 ? CAT_MISSING : e.present > 0 ? CAT_PRESENT : CAT_ABSENT;
      e.days.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    }
    list.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return list;
  }, [rows]);

  const presentCount = overview.filter((e) => e.primary === CAT_PRESENT).length;
  const absentCount = overview.filter((e) => e.primary === CAT_ABSENT).length;
  const missingCount = overview.filter((e) => e.primary === CAT_MISSING).length;

  const categoryList = useMemo(() => {
    let list = overview;
    if (category) list = overview.filter((e) => e.primary === category);
    if (query.trim()) list = list.filter((e) => matchesSearch(e, query, ["full_name", "card_id", "department"]));
    return list;
  }, [overview, category, query]);

  const isSingleDay = dateFrom === dateTo;
  const rangeLabel = isSingleDay
    ? fmtDay(dateFrom)
    : `${fmtDay(dateFrom)} \u2013 ${fmtDay(dateTo)}`;

  const openEmployee = (e) => {
    setSelectedEmployee({ id: e.employee_id, full_name: e.full_name, card_id: e.card_id, department: e.department });
    document.getElementById("summary-top-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Attendance</p><h1>Attendance Summary</h1><p>Overview of Present, Absent, and Missed Clock-Out employees. Click a category to view its list.</p></div>
      </div>

      <div className="panel" id="summary-top-panel">
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
                    <div key={d.date} className={`day-status-chip status-${d.status === "missing_checkout" || d.status === "present_incomplete" ? "missing_checkout" : d.status}`}>
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

      <div className="overview-cards">
        {Object.keys(categoryMeta).map((cat) => {
          const meta = categoryMeta[cat];
          const count = cat === CAT_PRESENT ? presentCount : cat === CAT_ABSENT ? absentCount : missingCount;
          const active = category === cat;
          return (
            <button key={cat} type="button"
              className={`stat-card ${meta.tone} clickable overview-card${active ? " active" : ""}`}
              onClick={() => setCategory(active ? "" : cat)}>
              <div className="stat-icon"><Icon name={meta.icon} size={20} /></div>
              <div>
                <p className="stat-label">{meta.label}</p>
                <p className="stat-count">{count}</p>
                <p className="stat-hint">{meta.hint}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">{category ? `${categoryMeta[category].label} Employees` : "Employee Attendance"}</div>
            <div className="panel-subtitle">{rangeLabel} | {category ? `${categoryMeta[category].label}: ${category === CAT_PRESENT ? presentCount : category === CAT_ABSENT ? absentCount : missingCount} of ${overview.length} employees` : `All employees (${overview.length})`}</div>
          </div>
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
            <thead><tr><th style={{ width: 30 }}></th><th>Employee</th><th>Department</th><th>Attendance</th><th style={{ width: 90 }}></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="table-message">Loading...</td></tr>
              : categoryList.length ? categoryList.map((e) => (
                <Fragment key={e.employee_id}>
                  <tr className="clickable-row" onClick={() => setExpanded(expanded === e.employee_id ? null : e.employee_id)}>
                    <td className="td-center"><Icon name={expanded === e.employee_id ? "chevron-up" : "chevron-down"} size={14} /></td>
                    <td className="strong-cell">
                      {e.full_name}
                      <div className="td-muted">{e.card_id || e.employee_id}</div>
                    </td>
                    <td><span className="badge badge-blue">{e.department || "—"}</span></td>
                    <td>
                      {isSingleDay ? (
                        (() => {
                          const day = e.days.find((d) => d.date);
                          if (!day) return <span className="td-muted">No record</span>;
                          const times = [];
                          if (day.first_in) times.push(formatBioTimeTimeValue(day.first_in));
                          if (day.last_out) times.push(formatBioTimeTimeValue(day.last_out));
                          return (
                            <>
                              {statusBadge(day.status || "absent")}
                              {times.length ? <span className="td-muted" style={{ marginLeft: 8 }}>{times.join(" \u2192 ")}</span> : null}
                            </>
                          );
                        })()
                      ) : (
                        <span className="td-muted">{fmtAgg(e)}</span>
                      )}
                    </td>
                    <td className="td-center">
                      <button className="btn btn-ghost btn-sm" onClick={(ev) => { ev.stopPropagation(); openEmployee(e); }}>
                        <Icon name="eye" size={13} /> Details
                      </button>
                    </td>
                  </tr>
                  {expanded === e.employee_id && (
                    <tr>
                      <td colSpan="5">
                        <div className="emp-day-chips">
                          {e.days.filter((d) => d.date).length ? e.days.filter((d) => d.date).map((d) => (
                            <div key={d.date} className={`day-status-chip status-${d.cat}`}>
                              <span className="day-status-name">{formatBioTimeDateValue(d.date)}</span>
                              <span className="day-status-value">{d.status ? d.status.replace(/_/g, " ") : "absent"}</span>
                            </div>
                          )) : <span className="td-muted">No attendance records for this period.</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )) : <tr><td colSpan="5" className="table-message">No employees in this category for the selected period.</td></tr>}
            </tbody>
          </table>
        </div>
        {!loading && <div className="table-footer">Showing {categoryList.length} of {overview.length} employees | Period: {rangeLabel}</div>}
      </div>
    </div>
  );
}
