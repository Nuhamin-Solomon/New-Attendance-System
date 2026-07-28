import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";

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
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [editEmp, setEditEmp] = useState(null);
  const [editForm, setEditForm] = useState({ department: "", manager_id: "", hr_id: "" });
  const [managers, setManagers] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      API.get("/employees"),
      API.get("/employees/departments"),
    ]).then(([empRes, deptRes]) => {
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

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
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchQuery = !query || [e.full_name, e.department, e.card_id, e.position, e.manager_name, e.hr_name]
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
            <div className="panel-subtitle">Search by name, department, card number, manager, or HR</div>
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
              ) : filtered.length ? filtered.map((e) => (
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

        {!loading && <div className="table-footer">Showing {filtered.length} of {employees.length} employees</div>}
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
