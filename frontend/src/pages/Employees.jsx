import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API, { readApiError } from "../services/api";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 25;

const initials = (name = "") => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

function SearchableSelect({ items, value, onChange, placeholder, searchFields, displayField, idField }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => String(i[idField]) === String(value));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => !q || searchFields.some((f) => String(item[f] || "").toLowerCase().includes(q)));
  }, [items, search, searchFields]);

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8,
          background: "var(--input-bg, #fff)", cursor: "pointer", minHeight: 38,
        }}
      >
        <span style={{ color: selected ? "var(--text)" : "var(--text-muted)", fontSize: 14 }}>
          {selected ? selected[displayField] : placeholder}
        </span>
        <Icon name={open ? "x" : "chevron-down"} size={14} style={{ color: "var(--text-muted)" }} />
      </div>
      {open && (
        <div style={{ position: "absolute", zIndex: 50, top: "100%", left: 0, right: 0, marginTop: 4, background: "var(--card, #fff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          <div style={{ padding: 8, borderBottom: "1px solid var(--border, #e2e8f0)" }}>
            <input
              autoFocus
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search..."
              style={{ fontSize: 13 }}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            <div
              onClick={() => { onChange(null); setOpen(false); setSearch(""); }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "var(--text-muted)", borderBottom: "1px solid var(--border, #f0f0f0)" }}
            >
              {placeholder}
            </div>
            {filtered.map((item) => (
              <div
                key={item[idField]}
                onClick={() => { onChange(item[idField]); setOpen(false); setSearch(""); }}
                style={{
                  padding: "8px 12px", cursor: "pointer", fontSize: 14,
                  background: String(item[idField]) === String(value) ? "var(--primary-light, rgba(2,64,79,0.08))" : "transparent",
                  borderBottom: "1px solid var(--border, #f0f0f0)",
                }}
              >
                {item[displayField]}
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No results found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [deptOpen, setDeptOpen] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [editEmp, setEditEmp] = useState(null);
  const [editForm, setEditForm] = useState({ department: "", manager_id: "", hr_id: "" });
  const [managers, setManagers] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      const q = query.trim();
      if (q) params.search = q;
      if (statusFilter !== "all") params.status = statusFilter;
      if (selectedDepts.length) params.department = selectedDepts.join(",");
      const [empRes, deptRes] = await Promise.all([
        API.get("/employees", { params }),
        API.get("/employees/departments"),
      ]);
      const { data, total: t, totalPages: tp } = empRes.data;
      setEmployees(data || []);
      setTotal(t || 0);
      setTotalPages(tp || 1);
      setDepartments(deptRes.data);
      if (page > (tp || 1)) setPage(tp || 1);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, [page, query, selectedDepts, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => fetchEmployees(), query.trim() ? 250 : 0);
    return () => clearTimeout(t);
  }, [fetchEmployees]);

  useEffect(() => {
    if (editEmp && editForm.department) {
      API.get("/employees/managers-for-dept", { params: { department: editForm.department } })
        .then((r) => setManagers(r.data)).catch(() => setManagers([]));
      API.get("/employees/hr-for-dept", { params: { department: editForm.department } })
        .then((r) => setHrUsers(r.data)).catch(() => setHrUsers([]));
    }
  }, [editEmp, editForm.department]);

  const openEdit = (emp) => {
    setEditEmp(emp);
    setEditForm({
      department: emp.department || "",
      manager_id: emp.manager_id || "",
      hr_id: emp.hr_id || "",
    });
  };

  const handleDeptChange = (newDept) => {
    setEditForm((prev) => ({ ...prev, department: newDept || "", manager_id: "", hr_id: "" }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put(`/employees/${editEmp.id}`, {
        department: editForm.department || null,
        manager_id: editForm.manager_id ? parseInt(editForm.manager_id) : null,
        hr_id: editForm.hr_id ? parseInt(editForm.hr_id) : null,
      });
      setEditEmp(null);
      fetchEmployees();
    } catch (err) {
      alert(readApiError(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const toggleDept = (dept) => {
    setPage(1);
    setSelectedDepts((prev) => (prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]));
  };

  const handleStatusChange = (value) => {
    setPage(1);
    setStatusFilter(value);
  };

  const [verify, setVerify] = useState(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setVerify(null); return; }
    let active = true;
    const t = setTimeout(() => {
      API.get("/employees", { params: { search: q, exact: 1 } })
        .then((r) => {
          if (!active) return;
          const matches = r.data || [];
          if (matches.length === 1) {
            const emp = matches[0];
            const deptMismatch = selectedDepts.length > 0 && !selectedDepts.includes(emp.department);
            setVerify(deptMismatch
              ? { type: "warning", text: `${emp.full_name} found in the directory, but is assigned to ${emp.department || "no department"} \u2014 outside your selected department filter.` }
              : { type: "success", text: `${emp.full_name} (${emp.card_id || "no card ID"}) \u2014 verified in ${emp.department || "no department assigned"}.` });
          } else if (matches.length > 1) {
            setVerify({ type: "info", text: `${matches.length} employees share that name \u2014 refine the search or check the department checklist.` });
          } else {
            setVerify({ type: "error", text: `No employee named "${q}" found in the directory.` });
          }
        })
        .catch(() => {});
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [query, selectedDepts]);

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div>
          <p className="eyebrow">Directory</p>
          <h1>Employees</h1>
          <p>View and manage employees imported from BioTime.</p>
        </div>
        <div className="header-count">{total} people</div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Employee Directory</div>
            <div className="panel-subtitle">Search by name, department, card number, manager, or HR</div>
          </div>
          <div className="panel-actions">
            <div className="dept-checklist-wrap">
              <button className="btn btn-ghost" onClick={() => setDeptOpen(!deptOpen)}>
                <Icon name="filter" size={14} />
                {selectedDepts.length ? `Departments (${selectedDepts.length})` : "All Departments"}
                <Icon name={deptOpen ? "chevron-up" : "chevron-down"} size={14} />
              </button>
              {deptOpen && (
                <div className="dept-checklist">
                  <div className="dept-checklist-header">
                    <span>Filter by department</span>
                    {selectedDepts.length > 0 && <button onClick={() => { setPage(1); setSelectedDepts([]); }}>Clear all</button>}
                  </div>
                  <div className="dept-checklist-scroll">
                    {departments.length ? departments.map((d) => (
                      <label key={d} className="dept-checklist-item">
                        <input
                          type="checkbox"
                          checked={selectedDepts.includes(d)}
                          onChange={() => toggleDept(d)}
                        />
                        <span>{d}</span>
                      </label>
                    )) : <div className="dept-checklist-empty">No departments available</div>}
                  </div>
                  <div className="dept-checklist-footer">
                    <button className="btn btn-sm btn-primary" onClick={() => setDeptOpen(false)}>Apply</button>
                  </div>
                </div>
              )}
            </div>
            <select
              className="form-input form-input-sm form-select-sm"
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              title="Filter by employment status"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <label className="search-bar">
              <Icon name="search" size={16} />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search employees" />
            </label>
          </div>
        </div>

        {verify && (
          <div className={`alert alert-${verify.type}`} style={{ margin: "0 16px 16px" }}>
            <Icon name={verify.type === "success" ? "check-circle" : verify.type === "error" ? "x" : verify.type === "warning" ? "bell" : "search"} size={14} style={{ marginRight: 8, verticalAlign: "-2px" }} />
            {verify.text}
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Position</th>
                <th>Line Manager</th>
                <th>HR Responsible</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="table-message">Loading employees...</td></tr>
              ) : employees.length ? employees.map((e) => (
                <tr key={e.id}>
                  <td className="clickable-row" onClick={() => navigate(`/employees/${e.id}`)}>
                    <div className="person-cell">
                      <span className="avatar">{initials(e.full_name)}</span>
                      <div>
                        <span>{e.full_name}</span>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.card_id || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-blue">{e.department || "Unassigned"}</span></td>
                  <td className="td-muted">{e.position || "\u2014"}</td>
                  <td>
                    {e.manager_name ? (
                      <span className="badge badge-teal">{e.manager_name}</span>
                    ) : (
                      <span className="text-muted" style={{ fontSize: 12 }}>Not assigned</span>
                    )}
                  </td>
                  <td>
                    {e.hr_name ? (
                      <span className="badge badge-purple">{e.hr_name}</span>
                    ) : (
                      <span className="text-muted" style={{ fontSize: 12 }}>Not assigned</span>
                    )}
                  </td>
                  <td><span className={`badge badge-${e.status === "active" ? "green" : "orange"}`}>{e.status || "active"}</span></td>
                  {isAdmin && (
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(e)} title="Edit Assignments">
                          <Icon name="edit" size={14} />
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/employees/${e.id}`)} title="View Profile">
                          <Icon name="eye" size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )) : (
                <tr><td colSpan={isAdmin ? 7 : 6} className="table-message">No employees match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="employees" />
        )}
      </div>

      {editEmp && (
        <div className="modal-overlay" onClick={() => setEditEmp(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <h3>Edit: {editEmp.full_name}</h3>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{editEmp.position || "Employee"}</p>
              </div>
              <button className="btn btn-ghost" onClick={() => setEditEmp(null)}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                Changing the department will update available Line Manager and HR users. Historical records remain unchanged.
              </p>
              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <label className="form-label">Department</label>
                  <SearchableSelect
                    items={departments.map((d) => ({ id: d, name: d }))}
                    value={editForm.department}
                    onChange={handleDeptChange}
                    placeholder="-- Select Department --"
                    searchFields={["name"]}
                    displayField="name"
                    idField="id"
                  />
                </div>
                <div>
                  <label className="form-label">Line Manager</label>
                  <SearchableSelect
                    items={managers.map((m) => ({ ...m, label: `${m.employee_name || m.full_name || m.username} (${m.username})` }))}
                    value={editForm.manager_id}
                    onChange={(val) => setEditForm((prev) => ({ ...prev, manager_id: val || "" }))}
                    placeholder="-- No Line Manager --"
                    searchFields={["employee_name", "full_name", "username"]}
                    displayField="label"
                    idField="employee_id"
                  />
                  {editForm.department && managers.length === 0 && (
                    <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>No managers assigned to {editForm.department}.</p>
                  )}
                </div>
                <div>
                  <label className="form-label">HR Responsible Person</label>
                  <SearchableSelect
                    items={hrUsers.map((h) => ({ ...h, label: `${h.employee_name || h.full_name || h.username} (${h.username})` }))}
                    value={editForm.hr_id}
                    onChange={(val) => setEditForm((prev) => ({ ...prev, hr_id: val || "" }))}
                    placeholder="-- No HR Responsible --"
                    searchFields={["employee_name", "full_name", "username"]}
                    displayField="label"
                    idField="employee_id"
                  />
                  {editForm.department && hrUsers.length === 0 && (
                    <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>No HR users assigned to {editForm.department}.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditEmp(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
