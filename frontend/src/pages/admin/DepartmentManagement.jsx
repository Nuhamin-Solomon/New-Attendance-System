import { useEffect, useState, useMemo } from "react";
import API from "../../services/api";
import Icon from "../../components/Icon";

export default function DepartmentManagement() {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [deptName, setDeptName] = useState("");
  const [assignModal, setAssignModal] = useState(null);
  const [assignType, setAssignType] = useState("manager");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    API.get("/departments").then((r) => setDepartments(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    API.get("/employees").then((r) => setEmployees(r.data)).catch(() => {});
    API.get("/users").then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    try {
      await API.post("/departments", { name: deptName.trim() });
      setDeptName(""); setShowForm(false); load();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    try {
      await API.put(`/departments/${editDept.id}`, { name: deptName.trim() });
      setDeptName(""); setEditDept(null); setShowForm(false); load();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleDelete = async (dept) => {
    if (!confirm(`Delete department "${dept.name}"?`)) return;
    try {
      await API.delete(`/departments/${dept.id}`);
      load();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleAssignEmployee = async () => {
    if (!selectedEmployeeId || !assignModal) return;
    setSubmitting(true);
    try {
      await API.post(`/departments/${assignModal.id}/assign`, {
        employee_id: parseInt(selectedEmployeeId),
        assignment_type: assignType,
      });
      setAssignModal(null); setSelectedEmployeeId(""); setEmployeeSearch(""); load();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
    finally { setSubmitting(false); }
  };

  const handleAssignUser = async () => {
    if (!selectedUserId || !assignModal) return;
    setSubmitting(true);
    try {
      await API.post(`/departments/${assignModal.id}/assign`, {
        user_id: parseInt(selectedUserId),
        assignment_type: assignType,
      });
      setAssignModal(null); setSelectedUserId(""); setUserSearch(""); load();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
    finally { setSubmitting(false); }
  };

  const handleRemoveAssignment = async (deptId, assignmentId) => {
    if (!confirm("Remove this assignment?")) return;
    try {
      await API.delete(`/departments/${deptId}/assignments/${assignmentId}`);
      load();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const openEdit = (dept) => {
    setEditDept(dept);
    setDeptName(dept.name);
    setShowForm(true);
  };

  const openAssign = (dept, type) => {
    setAssignModal(dept);
    setAssignType(type);
    setSelectedEmployeeId("");
    setSelectedUserId("");
    setEmployeeSearch("");
    setUserSearch("");
  };

  const deptSearch = useState("");
  const search = deptSearch[0];
  const setSearch = deptSearch[1];

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const assignedEmpIds = new Set(
    (assignModal?.assignments || []).map((a) => a.employee_id).filter(Boolean)
  );

  const assignedUserIds = new Set(
    (assignModal?.assignments || []).map((a) => a.user_id).filter(Boolean)
  );

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.toLowerCase();
    return employees
      .filter((e) => e.status === "active")
      .filter((e) => !q || e.full_name?.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q) || e.card_id?.includes(q))
      .slice(0, 50);
  }, [employees, employeeSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return users
      .filter((u) => !q || u.full_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q))
      .slice(0, 50);
  }, [users, userSearch]);

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Department Management</h1>
          <p className="text-muted">Configure departments and assign Line Managers (from BioTime employees) and HR responsible persons</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditDept(null); setDeptName(""); setShowForm(true); }}>
          <Icon name="plus" size={16} /> Add Department
        </button>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title">{editDept ? "Edit Department" : "New Department"}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setEditDept(null); setDeptName(""); }}>
              <Icon name="x" size={14} />
            </button>
          </div>
          <div className="panel-body">
            <form onSubmit={editDept ? handleUpdate : handleCreate} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Department Name</label>
                <input className="form-input" value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Engineering" autoFocus />
              </div>
              <button type="submit" className="btn btn-primary">{editDept ? "Update" : "Create"}</button>
            </form>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">All Departments ({filtered.length})</div>
          <input className="form-input" style={{ width: 220 }} placeholder="Search departments..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Employees</th>
                <th>Line Managers</th>
                <th>HR Responsible</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((dept) => {
                const mgrs = (dept.assignments || []).filter((a) => a.assignment_type === "manager");
                const hrs = (dept.assignments || []).filter((a) => a.assignment_type === "hr");
                return (
                  <tr key={dept.id}>
                    <td className="strong-cell">{dept.name}</td>
                    <td>{dept.employee_count || 0}</td>
                    <td>
                      {mgrs.length > 0 ? mgrs.map((m) => (
                        <span key={m.assignment_id} className="badge badge-blue" style={{ marginRight: 4, marginBottom: 2 }}>
                          {m.employee_name || m.full_name || m.username}
                          <button onClick={() => handleRemoveAssignment(dept.id, m.assignment_id)} style={{ marginLeft: 4, background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 12 }}>&times;</button>
                        </span>
                      )) : <span className="text-muted">Unassigned</span>}
                    </td>
                    <td>
                      {hrs.length > 0 ? hrs.map((h) => (
                        <span key={h.assignment_id} className="badge badge-purple" style={{ marginRight: 4, marginBottom: 2 }}>
                          {h.employee_name || h.full_name || h.username}
                          <button onClick={() => handleRemoveAssignment(dept.id, h.assignment_id)} style={{ marginLeft: 4, background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 12 }}>&times;</button>
                        </span>
                      )) : <span className="text-muted">Unassigned</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openAssign(dept, "manager")} title="Assign Line Manager from BioTime employees">
                          <Icon name="user-plus" size={14} /> Manager
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openAssign(dept, "hr")} title="Assign HR user">
                          <Icon name="user-plus" size={14} /> HR
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(dept)} title="Edit">
                          <Icon name="edit" size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(dept)} title="Delete" style={{ color: "var(--red, #e53e3e)" }}>
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="table-message">No departments found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {assignModal && assignType === "manager" && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Assign Line Manager to {assignModal.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setAssignModal(null)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ marginBottom: 12, fontSize: 13 }}>
                Select an employee from the BioTime-synced list. If they don't have a system account yet, one will be created automatically.
              </p>
              <label className="form-label">Search Employees (from BioTime)</label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  placeholder="Search by name, department, or card ID..."
                  value={employeeSearch}
                  onChange={(e) => { setEmployeeSearch(e.target.value); setSelectedEmployeeId(""); }}
                  onFocus={() => setEmployeeSearch(employeeSearch)}
                  style={{ paddingRight: 28 }}
                />
                {employeeSearch && (
                  <button
                    onClick={() => { setEmployeeSearch(""); setSelectedEmployeeId(""); }}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
                  ><Icon name="x" size={14} /></button>
                )}
              </div>

              {employeeSearch && (
                <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 8, maxHeight: 260, overflowY: "auto", marginTop: 4 }}>
                  {filteredEmployees.length === 0 && (
                    <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No employees found matching "{employeeSearch}"</div>
                  )}
                  {filteredEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => { setSelectedEmployeeId(String(emp.id)); setEmployeeSearch(emp.full_name); }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        background: selectedEmployeeId === String(emp.id) ? "var(--primary-light, rgba(2,64,79,0.08))" : "transparent",
                        borderBottom: "1px solid var(--border, #f0f0f0)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{emp.full_name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {emp.department} {emp.position ? `| ${emp.position}` : ""} {emp.card_id ? `| ID: ${emp.card_id}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {assignedEmpIds.has(emp.id) && <span className="badge badge-green" style={{ fontSize: 11 }}>Already Assigned</span>}
                        {selectedEmployeeId === String(emp.id) && <Icon name="check" size={16} />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!employeeSearch && (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13, border: "1px dashed var(--border, #e2e8f0)", borderRadius: 8, marginTop: 4 }}>
                  Start typing to search the BioTime employee database...
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAssignModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleAssignEmployee}
                disabled={!selectedEmployeeId || submitting}
              >
                {submitting ? "Assigning..." : "Assign Manager"}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignModal && assignType === "hr" && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Assign HR to {assignModal.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setAssignModal(null)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ marginBottom: 12, fontSize: 13 }}>
                Select a system user with HR or Admin role to handle this department's HR responsibilities.
              </p>
              <label className="form-label">Search Users</label>
              <input
                className="form-input"
                placeholder="Search by name or username..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setSelectedUserId(""); }}
              />

              {userSearch && (
                <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 8, maxHeight: 260, overflowY: "auto", marginTop: 4 }}>
                  {filteredUsers.length === 0 && (
                    <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No users found</div>
                  )}
                  {filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => { setSelectedUserId(String(u.id)); setUserSearch(u.full_name || u.username); }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        background: selectedUserId === String(u.id) ? "var(--primary-light, rgba(2,64,79,0.08))" : "transparent",
                        borderBottom: "1px solid var(--border, #f0f0f0)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{u.full_name || u.username}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          @{u.username} | <span className={`badge badge-${u.role === "hr" ? "purple" : u.role === "admin" ? "blue" : "gray"}`} style={{ fontSize: 11 }}>{u.role}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {assignedUserIds.has(u.id) && <span className="badge badge-green" style={{ fontSize: 11 }}>Already Assigned</span>}
                        {selectedUserId === String(u.id) && <Icon name="check" size={16} />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!userSearch && (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13, border: "1px dashed var(--border, #e2e8f0)", borderRadius: 8, marginTop: 4 }}>
                  Start typing to search system users...
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAssignModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleAssignUser}
                disabled={!selectedUserId || submitting}
              >
                {submitting ? "Assigning..." : "Assign HR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
