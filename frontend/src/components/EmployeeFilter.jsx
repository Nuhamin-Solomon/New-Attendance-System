import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import Icon from "./Icon";

export default function EmployeeFilter({ open, onClose, onApply, selectedDepartments = [], selectedEmployeeIds = [] }) {
  const [options, setOptions] = useState({ employees: [], departments: [] });
  const [deptSel, setDeptSel] = useState([]);
  const [empSel, setEmpSel] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDeptSel(selectedDepartments);
    setEmpSel(selectedEmployeeIds);
    setSearch("");
    setLoading(true);
    API.get("/reports/employee-options")
      .then((r) => setOptions({ employees: r.data.employees || [], departments: r.data.departments || [] }))
      .catch(() => setOptions({ employees: [], departments: [] }))
      .finally(() => setLoading(false));
  }, [open, selectedDepartments, selectedEmployeeIds]);

  const filteredEmployees = useMemo(() => {
    let list = options.employees;
    if (deptSel.length > 0) list = list.filter((e) => deptSel.includes(e.department));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((e) =>
        (e.full_name || "").toLowerCase().includes(q) ||
        String(e.card_id || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [options.employees, deptSel, search]);

  const shownIds = useMemo(() => filteredEmployees.map((e) => e.employee_id), [filteredEmployees]);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => empSel.includes(id));

  const toggleDept = (d) => {
    const next = deptSel.includes(d) ? deptSel.filter((x) => x !== d) : [...deptSel, d];
    setDeptSel(next);
    if (next.length > 0) {
      const allowed = new Set(options.employees.filter((e) => next.includes(e.department)).map((e) => e.employee_id));
      setEmpSel((prev) => prev.filter((id) => allowed.has(id)));
    }
  };

  const toggleAllShown = () => {
    if (allShownSelected) {
      const shown = new Set(shownIds);
      setEmpSel((prev) => prev.filter((id) => !shown.has(id)));
    } else {
      setEmpSel((prev) => Array.from(new Set([...prev, ...shownIds])));
    }
  };

  const clearAll = () => {
    setDeptSel([]);
    setEmpSel([]);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content emp-filter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Filter by Employee &amp; Department</h3>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="emp-filter-body">
          <div className="emp-filter-col">
            <div className="emp-filter-col-title">Departments</div>
            <div className="emp-filter-list">
              <label className="emp-filter-item">
                <input type="checkbox" checked={deptSel.length === 0} onChange={() => { setDeptSel([]); setEmpSel([]); }} />
                <span>All Departments</span>
              </label>
              {options.departments.length === 0 && !loading && <div className="table-message">No departments</div>}
              {options.departments.map((d) => (
                <label key={d} className="emp-filter-item">
                  <input type="checkbox" checked={deptSel.includes(d)} onChange={() => toggleDept(d)} />
                  <span>{d}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="emp-filter-col">
            <div className="emp-filter-col-title emp-filter-col-title-row">
              <span>Employees</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={toggleAllShown}>
                {allShownSelected ? "Clear Shown" : "Select All Shown"}
              </button>
            </div>
            <label className="search-bar">
              <Icon name="search" size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or ID…" />
            </label>
            <div className="emp-filter-list">
              {loading ? (
                <div className="table-message">Loading employees…</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="table-message">No employees found</div>
              ) : (
                filteredEmployees.map((e) => (
                  <label key={e.employee_id} className="emp-filter-item">
                    <input type="checkbox" checked={empSel.includes(e.employee_id)} onChange={() => toggleEmp(e.employee_id, empSel, setEmpSel)} />
                    <span className="emp-filter-name">{e.full_name}</span>
                    <span className="td-muted">{e.card_id || e.employee_id}</span>
                    <span className="badge badge-blue">{e.department || "—"}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer emp-filter-footer">
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>Clear All</button>
          <span className="td-muted">
            {empSel.length} employee{empSel.length === 1 ? "" : "s"} selected
            {deptSel.length > 0 ? ` · ${deptSel.length} dept${deptSel.length === 1 ? "" : "s"}` : " · all depts"}
          </span>
          <div className="emp-filter-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={() => onApply({ departments: deptSel, employeeIds: empSel })}>
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function toggleEmp(id, empSel, setEmpSel) {
  setEmpSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
}
