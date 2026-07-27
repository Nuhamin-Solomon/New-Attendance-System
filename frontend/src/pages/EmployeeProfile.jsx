import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";
import Icon from "../components/Icon";

const initials = (name = "") => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
const formatTime = (iso) => iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      API.get(`/employees/${id}`),
      API.get(`/attendance?employee_id=${id}`),
    ]).then(([empRes, attRes]) => {
      setEmployee(empRes.data);
      setAttendance(attRes.data);
    }).catch(() => navigate("/employees")).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div className="page-container"><div className="loading-spinner" /></div>;
  if (!employee) return null;

  const attendanceRate = attendance.length > 0 ? Math.min(100, Math.round((attendance.length / Math.max(1, attendance.length)) * 100)) : 0;

  return (
    <div className="page-container">
      <button className="btn btn-ghost" onClick={() => navigate("/employees")} style={{ marginBottom: 16 }}>
        <Icon name="arrow-left" size={16} /> Back to Employees
      </button>

      <div className="profile-header">
        <div className="avatar avatar-lg">{initials(employee.full_name)}</div>
        <div>
          <h1>{employee.full_name}</h1>
          <p className="profile-subtitle">{employee.position || "Employee"} &middot; {employee.department || "Unassigned"}</p>
        </div>
      </div>

      <div className="stats-grid stats-grid-3" style={{ marginBottom: 24 }}>
        <article className="stat-card blue">
          <span className="stat-icon"><Icon name="building" size={20} /></span>
          <div><p className="stat-label">Department</p><div className="stat-value stat-value-text">{employee.department || "N/A"}</div></div>
        </article>
        <article className="stat-card green">
          <span className="stat-icon"><Icon name="card-id" size={20} /></span>
          <div><p className="stat-label">Card ID</p><div className="stat-value stat-value-text">{employee.card_id || "N/A"}</div></div>
        </article>
        <article className="stat-card orange">
          <span className="stat-icon"><Icon name="attendance" size={20} /></span>
          <div><p className="stat-label">Attendance Records</p><div className="stat-value">{attendance.length}</div></div>
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
