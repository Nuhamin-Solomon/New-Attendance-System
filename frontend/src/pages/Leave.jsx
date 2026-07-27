import { useEffect, useState } from "react";
import API from "../services/api";
import Icon from "../components/Icon";

export default function Leave() {
  const [leaves, setLeaves] = useState([]);
  const [types, setTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "", supporting_doc_url: "" });
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      API.get("/leave"),
      API.get("/leave/types"),
      API.get("/leave/balances"),
    ]).then(([lRes, tRes, bRes]) => { setLeaves(lRes.data); setTypes(tRes.data); setBalances(bRes.data); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await API.put(`/leave/${editId}`, form);
      } else {
        await API.post("/leave", form);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ leave_type_id: "", start_date: "", end_date: "", reason: "", supporting_doc_url: "" });
      load();
    } catch (err) { alert(err.response?.data?.error || "Failed to submit"); }
  };

  const handleEdit = (l) => {
    setForm({
      leave_type_id: l.leave_type_id,
      start_date: l.start_date?.split("T")[0] || "",
      end_date: l.end_date?.split("T")[0] || "",
      reason: l.reason || "",
      supporting_doc_url: l.supporting_doc_url || "",
    });
    setEditId(l.id);
    setShowForm(true);
  };

  const handleCancel = async (id) => {
    if (!confirm("Cancel this leave request?")) return;
    try { await API.put(`/leave/${id}/cancel`); load(); } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const filtered = filter === "all" ? leaves : leaves.filter((l) => l.status === filter);
  const statusBadge = (s) => {
    const map = { approved: "green", rejected: "red", pending: "orange" };
    return <span className={`badge badge-${map[s] || "blue"}`}>{(s || "pending").replace(/_/g, " ")}</span>;
  };

  const dayCount = (s, e) => {
    if (!s || !e) return 0;
    return Math.ceil((new Date(e) - new Date(s)) / 86400000) + 1;
  };

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Workplace</p><h1>Leave Management</h1><p>Apply for leave and track your requests.</p></div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ leave_type_id: "", start_date: "", end_date: "", reason: "", supporting_doc_url: "" }); }}>
          <Icon name={showForm ? "x" : "plus"} size={16} /> {showForm ? "Cancel" : "Apply Leave"}
        </button>
      </div>

      {balances.length > 0 && (
        <div className="stats-grid stats-grid-5 no-print">
          {balances.map((b) => (
            <article className="stat-card blue" key={b.id}>
              <div><p className="stat-label">{b.leave_type_name}</p><div className="stat-value">{b.remaining_days}<span className="stat-value-sm">/{b.total_days}</span></div><p className="stat-sublabel">remaining days</p></div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-header"><div className="panel-title">{editId ? "Edit Leave Request" : "Apply for Leave"}</div></div>
          <form onSubmit={handleSubmit} className="form-grid">
            <div><label className="form-label">Leave Type *</label><select className="form-input" value={form.leave_type_id} onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })} required><option value="">Select type</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className="form-label">Start Date *</label><input type="date" className="form-input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></div>
            <div><label className="form-label">End Date *</label><input type="date" className="form-input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required /></div>
            {form.start_date && form.end_date && (
              <div><label className="form-label">Duration</label><div style={{ padding: "10px 0", fontWeight: 600, color: "var(--primary)" }}>{dayCount(form.start_date, form.end_date)} day{dayCount(form.start_date, form.end_date) !== 1 ? "s" : ""}</div></div>
            )}
            <div style={{ gridColumn: "1 / -1" }}><label className="form-label">Reason</label><textarea className="form-input" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason for leave..." /></div>
            <div style={{ gridColumn: "1 / -1" }}><label className="form-label">Supporting Document URL (optional)</label><input className="form-input" value={form.supporting_doc_url} onChange={(e) => setForm({ ...form, supporting_doc_url: e.target.value })} placeholder="Link to supporting document" /></div>
            <div style={{ gridColumn: "1 / -1" }}><button className="btn btn-primary" type="submit">{editId ? "Update Request" : "Submit Application"}</button></div>
          </form>
        </div>
      )}

      <div className="panel-actions-row no-print">
        {["all", "pending", "approved", "rejected"].map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>
            {f === "all" ? `All (${leaves.length})` : `${f} (${leaves.filter((l) => l.status === f).length})`}
          </button>
        ))}
      </div>

      <div className="panel report-panel">
        <div className="table-wrap report-table-wrap">
          <table className="report-table">
            <thead><tr><th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Reason</th><th>Status</th><th>Applied</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="table-message">Loading...</td></tr>
              : filtered.length ? filtered.map((l) => (
                <tr key={l.id}>
                  <td><span className="badge badge-blue">{l.leave_type_name}</span></td>
                  <td className="td-muted">{new Date(l.start_date).toLocaleDateString()}</td>
                  <td className="td-muted">{new Date(l.end_date).toLocaleDateString()}</td>
                  <td className="td-center">{dayCount(l.start_date, l.end_date)}</td>
                  <td className="td-muted" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.reason || "—"}</td>
                  <td>{statusBadge(l.status)}</td>
                  <td className="td-muted">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="td-center">
                    {l.status === "pending" && (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(l)} title="Edit"><Icon name="edit" size={14} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(l.id)} title="Cancel" style={{ color: "var(--danger)" }}><Icon name="trash" size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )) : <tr><td colSpan={8} className="table-message">No leave requests found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
