import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";

const initials = (name = "") => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
const formatTime = (iso) => iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : "\u2014";

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

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [formDept, setFormDept] = useState("");
  const [formManagerId, setFormManagerId] = useState("");
  const [formHrId, setFormHrId] = useState("");

  const load = () => {
    Promise.all([
      API.get(`/employees/${id}`),
      API.get(`/attendance?employee_id=${id}`),
    ]).then(([empRes, attRes]) => {
      setEmployee(empRes.data);
      setAttendance(attRes.data);
      setFormDept(empRes.data.department || "");
      setFormManagerId(empRes.data.manager_id || "");
      setFormHrId(empRes.data.hr_id || "");
    }).catch(() => navigate("/employees")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id, navigate]);

  useEffect(() => {
    API.get("/employees/departments").then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (editing && formDept) {
      API.get("/employees/managers-for-dept", { params: { department: formDept } })
        .then((r) => setManagers(r.data)).catch(() => setManagers([]));
      API.get("/employees/hr-for-dept", { params: { department: formDept } })
        .then((r) => setHrUsers(r.data)).catch(() => setHrUsers([]));
    }
  }, [editing, formDept]);

  const handleDeptChange = (newDept) => {
    setFormDept(newDept || "");
    setFormManagerId("");
    setFormHrId("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put(`/employees/${id}`, {
        department: formDept || null,
        manager_id: formManagerId ? parseInt(formManagerId) : null,
        hr_id: formHrId ? parseInt(formHrId) : null,
      });
      setEditing(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-container"><div className="loading-spinner" /></div>;
  if (!employee) return null;

  return (
    <div className="page-container">
      <button className="btn btn-ghost" onClick={() => navigate("/employees")} style={{ marginBottom: 16 }}>
        <Icon name="arrow-left" size={16} /> Back to Employees
      </button>

      <div className="profile-header">
        <div className="avatar avatar-lg">{initials(employee.full_name)}</div>
        <div style={{ flex: 1 }}>
          <h1>{employee.full_name}</h1>
          <p className="profile-subtitle">{employee.position || "Employee"} &middot; {employee.department || "Unassigned"}</p>
        </div>
        {isAdmin && !editing && (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            <Icon name="edit" size={16} /> Edit Assignments
          </button>
        )}
        {editing && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { setEditing(false); setFormDept(employee.department || ""); setFormManagerId(employee.manager_id || ""); setFormHrId(employee.hr_id || ""); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      <div className="stats-grid stats-grid-4" style={{ marginBottom: 24 }}>
        <article className="stat-card blue">
          <span className="stat-icon"><Icon name="building" size={20} /></span>
          <div><p className="stat-label">Department</p><div className="stat-value stat-value-text">{employee.department || "N/A"}</div></div>
        </article>
        <article className="stat-card green">
          <span className="stat-icon"><Icon name="card-id" size={20} /></span>
          <div><p className="stat-label">Card ID</p><div className="stat-value stat-value-text">{employee.card_id || "N/A"}</div></div>
        </article>
        <article className="stat-card teal">
          <span className="stat-icon"><Icon name="user" size={20} /></span>
          <div><p className="stat-label">Line Manager</p><div className="stat-value stat-value-text">{employee.manager_name || "Not assigned"}</div></div>
        </article>
        <article className="stat-card" style={{ background: "rgba(139,92,246,.06)" }}>
          <span className="stat-icon" style={{ color: "#7c3aed" }}><Icon name="user" size={20} /></span>
          <div><p className="stat-label">HR Responsible</p><div className="stat-value stat-value-text">{employee.hr_name || "Not assigned"}</div></div>
        </article>
      </div>

      <div className="tabs">
        {["overview", "attendance"].map((t) => (
          <button key={t} className={`tab ${tab === t ? "tab-active" : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Personal Information</div></div>
          <div className="info-grid">
            <div className="info-item"><span className="info-label">Full Name</span><span>{employee.full_name}</span></div>
            <div className="info-item"><span className="info-label">Department</span><span>{employee.department || "N/A"}</span></div>
            <div className="info-item"><span className="info-label">Position</span><span>{employee.position || "N/A"}</span></div>
            <div className="info-item"><span className="info-label">Card ID</span><span>{employee.card_id || "N/A"}</span></div>
            <div className="info-item"><span className="info-label">Email</span><span>{employee.email || "N/A"}</span></div>
            <div className="info-item"><span className="info-label">Phone</span><span>{employee.phone || "N/A"}</span></div>
            <div className="info-item"><span className="info-label">Status</span><span className={`badge badge-${employee.status === "active" ? "green" : "orange"}`}>{employee.status || "active"}</span></div>
            <div className="info-item"><span className="info-label">Hire Date</span><span>{employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : "N/A"}</span></div>
          </div>
        </div>
      )}

      {tab === "overview" && editing && (
        <div className="panel" style={{ marginTop: 16, border: "2px solid var(--primary, #02404F)" }}>
          <div className="panel-header">
            <div className="panel-title">Edit Department, Line Manager & HR Assignment</div>
            {formDept && <span className="badge badge-blue">{formDept}</span>}
          </div>
          <div className="panel-body">
            <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
              Changing the department will update the available Line Manager and HR users. Historical records remain unchanged.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <div>
                <label className="form-label">Department</label>
                <SearchableSelect
                  items={departments.map((d) => ({ id: d, name: d }))}
                  value={formDept}
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
                  value={formManagerId}
                  onChange={setFormManagerId}
                  placeholder="-- No Line Manager --"
                  searchFields={["employee_name", "full_name", "username"]}
                  displayField="label"
                  idField="employee_id"
                />
                {formDept && managers.length === 0 && (
                  <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                    No managers assigned to {formDept}. Assign one in Department Management.
                  </p>
                )}
              </div>
              <div>
                <label className="form-label">HR Responsible Person</label>
                <SearchableSelect
                  items={hrUsers.map((h) => ({ ...h, label: `${h.employee_name || h.full_name || h.username} (${h.username})` }))}
                  value={formHrId}
                  onChange={setFormHrId}
                  placeholder="-- No HR Responsible --"
                  searchFields={["employee_name", "full_name", "username"]}
                  displayField="label"
                  idField="employee_id"
                />
                {formDept && hrUsers.length === 0 && (
                  <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                    No HR users assigned to {formDept}. Assign one in Department Management.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "attendance" && (
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Attendance History</div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Time</th><th>Source</th></tr></thead>
              <tbody>
                {attendance.length ? attendance.slice(0, 50).map((a) => (
                  <tr key={a.id}>
                    <td>{formatTime(a.scan_time)}</td>
                    <td className="td-muted">{new Date(a.scan_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td><span className="badge badge-green">{a.source || "BioTime"}</span></td>
                  </tr>
                )) : <tr><td colSpan="3" className="table-message">No attendance records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
