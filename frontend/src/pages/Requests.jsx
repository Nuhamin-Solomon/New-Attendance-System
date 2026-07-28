import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import Icon from "../components/Icon";

const REQUEST_TYPES = [
  { value: "field_duty", label: "Field Duty", showLocation: true },
  { value: "official_travel", label: "Official Travel", showLocation: true },
  { value: "client_visit", label: "Client Visit", showLocation: true },
  { value: "training", label: "Training", showLocation: true },
  { value: "work_from_home", label: "Work From Home", showLocation: false },
  { value: "meeting_outside", label: "Meeting Outside Office", showLocation: true },
  { value: "missing_check_in", label: "Missing Check-In", showLocation: false },
  { value: "missing_check_out", label: "Missing Check-Out", showLocation: false },
  { value: "forgotten_punch", label: "Forgotten Punch", showLocation: false },
  { value: "overtime", label: "Overtime Request", showLocation: false },
  { value: "other", label: "Other", showLocation: true },
];

const emptyForm = { request_type: "field_duty", date: "", start_time: "", end_time: "", location: "", reason: "" };

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => { API.get("/requests").then((r) => setRequests(r.data)).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const selectedType = REQUEST_TYPES.find((t) => t.value === form.request_type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await API.put(`/requests/${editId}`, form);
      } else {
        await API.post("/requests", form);
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      load();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleEdit = (r) => {
    setForm({ request_type: r.request_type, date: r.date?.split("T")[0] || "", start_time: r.start_time || "", end_time: r.end_time || "", location: r.location || "", reason: r.reason || "" });
    setEditId(r.id);
    setShowForm(true);
  };

  const handleCancel = async (id) => {
    if (!confirm("Cancel this request?")) return;
    try { await API.put(`/requests/${id}/cancel`); load(); } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const statusFiltered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return statusFiltered;
    return statusFiltered.filter((r) =>
      [r.request_type, r.reason, r.location, r.status, r.manager_status, r.hr_status].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [statusFiltered, query]);

  const statusBadge = (s) => {
    const map = { approved: "green", manager_approved: "teal", rejected: "red", pending: "orange" };
    return <span className={`badge badge-${map[s] || "blue"}`}>{(s || "pending").replace(/_/g, " ")}</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Workplace</p><h1>Duty Requests</h1><p>Submit attendance correction and duty requests.</p></div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); setForm(emptyForm); }}>
          <Icon name={showForm ? "x" : "plus"} size={16} /> {showForm ? "Cancel" : "New Request"}
        </button>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-header"><div className="panel-title">{editId ? "Edit Request" : "Submit Duty Request"}</div></div>
          <form onSubmit={handleSubmit} className="form-grid">
            <div>
              <label className="form-label">Request Type *</label>
              <select className="form-input" value={form.request_type} onChange={(e) => setForm({ ...form, request_type: e.target.value })} required>
                {REQUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label className="form-label">Date *</label><input type="date" className="form-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            {(form.request_type === "overtime" || form.request_type === "missing_check_in" || form.request_type === "missing_check_out" || form.request_type === "forgotten_punch") && (
              <>
                <div><label className="form-label">Start Time</label><input type="time" className="form-input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                <div><label className="form-label">End Time</label><input type="time" className="form-input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
              </>
            )}
            {selectedType?.showLocation && <div><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location details" /></div>}
            <div style={{ gridColumn: "1 / -1" }}><label className="form-label">Reason *</label><textarea className="form-input" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Describe your request..." required /></div>
            <div style={{ gridColumn: "1 / -1" }}><button className="btn btn-primary" type="submit">{editId ? "Update Request" : "Submit Request"}</button></div>
          </form>
        </div>
      )}

      <div className="panel-actions-row no-print">
        <div style={{ display: "flex", gap: "6px" }}>
          {["all", "pending", "manager_approved", "approved", "rejected"].map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>
              {f === "all" ? `All (${requests.length})` : `${f.replace(/_/g, " ")} (${requests.filter((r) => r.status === f).length})`}
            </button>
          ))}
        </div>
        <label className="search-bar"><Icon name="search" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requests..." /></label>
      </div>

      <div className="panel report-panel">
        <div className="table-wrap report-table-wrap">
          <table className="report-table">
            <thead>
              <tr><th>Type</th><th>Date</th><th>Time</th><th>Location</th><th>Reason</th><th>Manager</th><th>HR</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="table-message">Loading...</td></tr>
              : filtered.length ? filtered.map((r) => (
                <tr key={r.id}>
                  <td><span className="badge badge-blue">{r.request_type.replace(/_/g, " ")}</span></td>
                  <td className="td-muted">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="td-muted">{r.start_time && r.end_time ? `${r.start_time} - ${r.end_time}` : r.start_time || "\u2014"}</td>
                  <td className="td-muted">{r.location || "\u2014"}</td>
                  <td className="td-muted" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason || "\u2014"}</td>
                  <td><span className={`badge badge-${r.manager_status === "approved" ? "green" : r.manager_status === "rejected" ? "red" : "orange"}`}>{r.manager_status?.replace(/_/g, " ") || "pending"}</span></td>
                  <td><span className={`badge badge-${r.hr_status === "approved" ? "green" : r.hr_status === "rejected" ? "red" : "orange"}`}>{r.hr_status?.replace(/_/g, " ") || "pending"}</span></td>
                  <td>{statusBadge(r.status)}</td>
                  <td className="td-center">
                    {r.status === "pending" && (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(r)} title="Edit"><Icon name="edit" size={14} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(r.id)} title="Cancel" style={{ color: "var(--danger)" }}><Icon name="trash" size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )) : <tr><td colSpan={9} className="table-message">No requests found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
