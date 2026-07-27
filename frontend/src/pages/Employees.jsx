import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Icon from "../components/Icon";

const initials = (name = "") => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      API.get("/employees"),
      API.get("/employees/departments"),
    ]).then(([empRes, deptRes]) => {
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchQuery = !query || [e.full_name, e.department, e.card_id, e.position]
        .some((v) => String(v || "").toLowerCase().includes(query.toLowerCase()));
      const matchDept = !deptFilter || e.department === deptFilter;
      return matchQuery && matchDept;
    });
  }, [employees, query, deptFilter]);

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div>
          <p className="eyebrow">Directory</p>
          <h1>Employees</h1>
          <p>View and manage employees imported from BioTime.</p>
        </div>
        <div className="header-count">{employees.length} people</div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Employee Directory</div>
            <div className="panel-subtitle">Search by name, department, or card number</div>
          </div>
          <div className="panel-actions">
            <select className="form-input form-select-sm" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <label className="search-bar">
              <Icon name="search" size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees" />
            </label>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Employee</th><th>Department</th><th>Position</th><th>Card ID</th><th>Status</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="table-message">Loading employees...</td></tr>
              ) : filtered.length ? filtered.map((e) => (
                <tr key={e.id} className="clickable-row" onClick={() => navigate(`/employees/${e.id}`)}>
                  <td>
                    <div className="person-cell">
                      <span className="avatar">{initials(e.full_name)}</span>
                      <span>{e.full_name}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-blue">{e.department || "Unassigned"}</span></td>
                  <td className="td-muted">{e.position || "—"}</td>
                  <td className="td-muted">{e.card_id || "—"}</td>
                  <td><span className={`badge badge-${e.status === "active" ? "green" : "orange"}`}>{e.status || "active"}</span></td>
                </tr>
              )) : (
                <tr><td colSpan="5" className="table-message">No employees match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && <div className="table-footer">Showing {filtered.length} of {employees.length} employees</div>}
      </div>
    </div>
  );
}
