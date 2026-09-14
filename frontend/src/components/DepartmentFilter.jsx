import { useEffect, useLayoutEffect, useRef, useState } from "react";
import API from "../services/api";
import Icon from "./Icon";

export default function DepartmentFilter({ selectedDepartments = [], onApply }) {
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [deptSel, setDeptSel] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setDeptSel(selectedDepartments);
    setLoading(true);
    API.get("/reports/employee-options")
      .then((r) => setDepartments(r.data.departments || []))
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const panelWidth = 300;
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 8);
    setPos({ top: rect.bottom + 6, left });
    const onResize = () => setOpen(false);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open]);

  const allSelected = deptSel.length === 0;
  const isActive = selectedDepartments.length > 0;
  const label = isActive
    ? selectedDepartments.length === 1
      ? selectedDepartments[0]
      : `${selectedDepartments.length} Departments`
    : "All Departments";

  const toggleDept = (d) => {
    setDeptSel((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const clearAll = () => setDeptSel([]);

  return (
    <>
      {open && <div className="dept-filter-backdrop" onClick={() => setOpen(false)} />}
      <div className="dept-filter" ref={wrapRef}>
        <button
          type="button"
          className={`btn btn-ghost btn-sm${isActive ? " dept-filter-active" : ""}`}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="building" size={14} /> {label}
          <Icon name={open ? "chevron-up" : "chevron-down"} size={12} />
        </button>

        {open && (
          <div className="dept-filter-panel" style={{ top: pos.top, left: pos.left }} onClick={(e) => e.stopPropagation()}>
            <div className="dept-filter-panel-title">Departments</div>
            <div className="emp-filter-list">
              <label className="emp-filter-item">
                <input type="checkbox" checked={allSelected} onChange={() => setDeptSel([])} />
                <span>All Departments</span>
              </label>
              {loading ? (
                <div className="table-message">Loading departments...</div>
              ) : departments.length === 0 ? (
                <div className="table-message">No departments available</div>
              ) : (
                departments.map((d) => (
                  <label key={d} className="emp-filter-item">
                    <input type="checkbox" checked={deptSel.includes(d)} onChange={() => toggleDept(d)} />
                    <span>{d}</span>
                  </label>
                ))
              )}
            </div>
            <div className="dept-filter-footer">
              <span className="td-muted">
                {allSelected ? "All departments selected" : `${deptSel.length} department${deptSel.length === 1 ? "" : "s"} selected`}
              </span>
              <div className="emp-filter-actions">
                {!allSelected && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>Clear</button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => { onApply(deptSel); setOpen(false); }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}