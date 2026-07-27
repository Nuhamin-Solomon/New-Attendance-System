import { useEffect, useState } from "react";
import API from "../services/api";
import Icon from "../components/Icon";

const statusBadge = (s) => {
  const map = { present: "green", late: "orange", absent: "red", leave: "purple", field_duty: "teal" };
  return <span className={`badge badge-${map[s] || "blue"}`}>{(s || "unknown").replace("_", " ")}</span>;
};

export default function AttendanceSummary() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [dept, setDept] = useState("");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { API.get("/employees/departments").then((r) => setDepartments(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    const params = { start_date: dateFrom, end_date: dateTo };
    if (dept) params.department = dept;
    API.get("/summary", { params }).then((r) => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [dept, dateFrom, dateTo]);

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Attendance</p><h1>Attendance Summary</h1><p>Summarized daily attendance with first in, last out, and status.</p></div>
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
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Department</th><th>Date</th><th>First In</th><th>Last Out</th><th>Hours</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="table-message">Loading...</td></tr>
              : rows.length ? rows.map((r, i) => (
                <tr key={i}>
                  <td className="strong-cell">{r.full_name}</td>
                  <td><span className="badge badge-blue">{r.department || "—"}</span></td>
                  <td className="td-muted">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                  <td className="td-muted">{r.first_in ? new Date(r.first_in).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="td-muted">{r.last_out ? new Date(r.last_out).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="td-muted">{r.total_hours ? `${r.total_hours}h` : "—"}</td>
                  <td>{statusBadge(r.status)}</td>
                </tr>
              )) : <tr><td colSpan="7" className="table-message">No attendance data for this period.</td></tr>}
            </tbody>
          </table>
        </div>
        {!loading && <div className="table-footer">Showing {rows.length} records</div>}
      </div>
    </div>
  );
}
