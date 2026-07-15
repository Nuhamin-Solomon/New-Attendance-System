import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import Icon from "../components/Icon";

const initials = (name = "") => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/employees").then((res) => setEmployees(res.data)).catch(() => setEmployees([])).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => employees.filter((employee) => [employee.full_name, employee.department, employee.card_id].some((value) => String(value || "").toLowerCase().includes(query.toLowerCase()))), [employees, query]);

  return <section className="fade-in">
    <div className="page-header page-header-row"><div><p className="eyebrow">Directory</p><h1>Employees</h1><p>View the people imported from your BioTime directory.</p></div><div className="header-count">{employees.length} people</div></div>
    <div className="panel">
      <div className="panel-header"><div><div className="panel-title">Employee directory</div><div className="panel-subtitle">Search by name, department, or card number</div></div><label className="search-bar"><Icon name="search" size={16}/><input aria-label="Search employees" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees" /></label></div>
      <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>Card ID</th><th>Employee ID</th></tr></thead><tbody>{loading ? <tr><td colSpan="4" className="table-message">Loading employee directory…</td></tr> : filtered.length ? filtered.map((employee) => <tr key={employee.id}><td><div className="person-cell"><span className="avatar">{initials(employee.full_name)}</span><span>{employee.full_name}</span></div></td><td><span className="badge badge-blue">{employee.department || "Unassigned"}</span></td><td className="td-muted">{employee.card_id || "—"}</td><td className="td-muted">#{employee.id}</td></tr>) : <tr><td colSpan="4" className="table-message">No employees match your search.</td></tr>}</tbody></table></div>
      {!loading && <div className="table-footer">Showing {filtered.length} of {employees.length} employees</div>}
    </div>
  </section>;
}
