import { useEffect, useState, useMemo } from "react";
import API from "../../services/api";
import Icon from "../../components/Icon";

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

export default function Users() {
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: "", password: "", email: "", full_name: "", role: "employee", employee_id: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [filter, setFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetModal, setResetModal] = useState(null);
  const [resetPw, setResetPw] = useState("");

  const load = () => {
    API.get("/users").then((r) => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    API.get("/employees").then((r) => setEmployees(r.data)).catch(() => {});
    API.get("/employees/departments").then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  const resetForm = () => {
    setForm({ username: "", password: "", email: "", full_name: "", role: "employee", employee_id: "" });
    setEditUser(null);
    setShowForm(false);
    setShowPassword(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.employee_id) payload.employee_id = null;
      else payload.employee_id = parseInt(payload.employee_id);
      await API.post("/users", payload);
      resetForm();
      load();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleEdit = (user) => {
    setEditUser(user);
    setForm({
      username: user.username,
      password: "",
      email: user.email || "",
      full_name: user.full_name || "",
      role: user.role,
      employee_id: user.employee_id || "",
      is_active: user.is_active,
    });
    setShowForm(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        username: form.username || null,
        email: form.email || null,
        full_name: form.full_name || null,
        role: form.role,
        is_active: form.is_active,
        employee_id: form.employee_id ? parseInt(form.employee_id) : null,
      };
      await API.put(`/users/${editUser.id}`, payload);
      resetForm();
      load();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleResetPassword = (user) => {
    setResetModal(user);
    setResetPw("changeme123");
  };

  const confirmResetPassword = async () => {
    if (!resetModal) return;
    try {
      const r = await API.put(`/users/${resetModal.id}/reset-password`, { newPassword: resetPw || "changeme123" });
      alert(`Password reset for ${resetModal.username}. New password: ${r.data.temporary_password}`);
      setResetModal(null);
      setResetPw("");
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleToggle = async (id, isActive) => {
    try { await API.put(`/users/${id}`, { is_active: !isActive }); load(); }
    catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleDelete = async (id, username) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try { await API.delete(`/users/${id}`); load(); }
    catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const getEmployeeName = (empId) => {
    if (!empId) return null;
    const emp = employees.find((e) => e.id === empId);
    return emp ? emp.full_name : `Employee #${empId}`;
  };

  const getEmployeeDept = (empId) => {
    if (!empId) return null;
    const emp = employees.find((e) => e.id === empId);
    return emp ? emp.department : null;
  };

  const roleFiltered = filter
    ? users.filter((u) => u.role === filter || (filter === "active" ? u.is_active : filter === "disabled" ? !u.is_active : true))
    : users;

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return roleFiltered;
    return roleFiltered.filter((u) =>
      [u.username, u.full_name, u.email, u.role, u.employee_name, u.department].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [roleFiltered, searchQuery]);

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Administration</p><h1>User Management</h1><p>Create, edit, and manage system user accounts.</p></div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          <Icon name={showForm ? "x" : "plus"} size={16} /> {showForm ? "Cancel" : "Add User"}
        </button>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-header"><div className="panel-title">{editUser ? `Edit User: ${editUser.username}` : "Create New User"}</div></div>
          <form onSubmit={editUser ? handleUpdate : handleCreate} className="form-grid form-grid-4">
            <div>
              <label className="form-label">Username *</label>
              <input className="form-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            {!editUser && (
              <div>
                <label className="form-label">Password *</label>
                <div className="password-toggle">
                  <input className="form-input" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                  <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    <Icon name={showPassword ? "eye-off" : "eye"} size={16} />
                  </button>
                </div>
              </div>
            )}
            <div><label className="form-label">Full Name</label><input className="form-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div>
              <label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="employee">Employee</option>
                <option value="manager">Line Manager</option>
                <option value="hr">HR</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label className="form-label">Employee Record</label>
              <SearchableSelect
                items={employees.map((e) => ({ ...e, label: `${e.full_name} (${e.department || "No Dept"})` }))}
                value={form.employee_id}
                onChange={(val) => setForm({ ...form, employee_id: val || "" })}
                placeholder="None (No Employee Linked)"
                searchFields={["full_name", "department", "card_id", "position"]}
                displayField="label"
                idField="id"
              />
            </div>
            {form.employee_id && getEmployeeDept(parseInt(form.employee_id)) && (
              <div><label className="form-label">Department (from Employee)</label><input className="form-input" value={getEmployeeDept(parseInt(form.employee_id))} disabled /></div>
            )}
            {editUser && (
              <div>
                <label className="form-label">Account Status</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, height: 38 }}>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                      background: form.is_active ? "var(--success, #10b981)" : "var(--text-muted, #94a3b8)",
                      position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 2, left: form.is_active ? 22 : 2,
                      width: 20, height: 20, borderRadius: 10, background: "#fff",
                      transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </button>
                  <span style={{ fontSize: 13, color: "var(--text)" }}>{form.is_active ? "Active" : "Disabled"}</span>
                </div>
              </div>
            )}
            <div style={{ alignSelf: "end", display: "flex", gap: 8 }}>
              <button className="btn btn-primary" type="submit">{editUser ? "Update User" : "Create User"}</button>
              <button className="btn btn-ghost" type="button" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="panel-actions-row no-print">
        <div style={{ display: "flex", gap: 6 }}>
          {["", "admin", "hr", "manager", "employee", "active", "disabled"].map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>
              {f === "" ? "All" : f === "active" ? "Active" : f === "disabled" ? "Disabled" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{filteredUsers.length} users</span>
          <label className="search-bar"><Icon name="search" size={16} /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search users..." /></label>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th><th>Full Name</th><th>Email</th><th>Role</th><th>Employee</th><th>Dept</th><th>Status</th><th>Last Login</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="9" className="table-message">Loading...</td></tr>
              : filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td className="strong-cell">{u.username}</td>
                  <td className="td-muted">{u.full_name || "\u2014"}</td>
                  <td className="td-muted">{u.email || "\u2014"}</td>
                  <td><span className={`badge badge-${u.role === "admin" ? "orange" : u.role === "hr" ? "purple" : u.role === "manager" ? "teal" : "blue"}`}>{u.role === "manager" ? "Line Manager" : u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span></td>
                  <td className="td-muted">{u.employee_name || (u.employee_id ? `#${u.employee_id}` : "\u2014")}</td>
                  <td className="td-muted">{u.department || "\u2014"}</td>
                  <td><span className={`badge badge-${u.is_active ? "green" : "red"}`}>{u.is_active ? "Active" : "Disabled"}</span></td>
                  <td className="td-muted">{u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never"}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(u)} title="Edit User"><Icon name="edit" size={14} /></button>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleToggle(u.id, u.is_active)} title={u.is_active ? "Disable" : "Enable"}>
                        <Icon name={u.is_active ? "x" : "check-circle"} size={14} />
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleResetPassword(u)} title="Reset Password"><Icon name="refresh" size={14} /></button>
                      <button className="btn btn-sm btn-ghost btn-danger-text" onClick={() => handleDelete(u.id, u.username)} title="Delete"><Icon name="trash" size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredUsers.length === 0 && (
                <tr><td colSpan="9" className="table-message">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resetModal && (
        <div className="modal-overlay" onClick={() => setResetModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Reset Password: {resetModal.username}</h3><button className="btn btn-ghost" onClick={() => setResetModal(null)}><Icon name="x" size={16} /></button></div>
            <div className="modal-body">
              <label className="form-label">New Password</label>
              <input className="form-input" type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>User will need to log in with this new password.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setResetModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmResetPassword}>Reset Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
