import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import Icon from "../components/Icon";

export default function ApprovalQueue() {
  const [requests, setRequests] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [tab, setTab] = useState("requests");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [commentModal, setCommentModal] = useState(null);
  const [comment, setComment] = useState("");
  const [user, setUser] = useState(null);

  const load = () => {
    Promise.all([
      API.get("/requests"),
      API.get("/leave"),
      API.get("/auth/me"),
    ]).then(([rRes, lRes, uRes]) => {
      const pendingReq = rRes.data.filter((r) => ["pending", "manager_approved"].includes(r.status));
      const pendingLeave = lRes.data.filter((l) => ["pending", "manager_approved"].includes(l.status));
      setRequests(pendingReq);
      setLeaveRequests(pendingLeave);
      setUser(uRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const canManagerAct = (r) => user && ["manager", "admin"].includes(user.role) && r.status === "pending";
  const canHRAct = (r) => user && ["hr", "admin"].includes(user.role) && r.status === "manager_approved";

  const handleRequestAction = async (id, action, commentText) => {
    try {
      const req = requests.find((r) => r.id === id);
      if (canManagerAct(req)) {
        await API.put(`/requests/${id}/manager`, { status: action, comment: commentText || null });
      } else if (canHRAct(req)) {
        await API.put(`/requests/${id}/hr`, { status: action, comment: commentText || null });
      }
      load();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleLeaveAction = async (id, action, commentText) => {
    try {
      const lr = leaveRequests.find((l) => l.id === id);
      if (canManagerAct(lr)) {
        await API.put(`/leave/${id}/manager`, { status: action, comment: commentText || null });
      } else if (canHRAct(lr)) {
        await API.put(`/leave/${id}/hr`, { status: action, comment: commentText || null });
      }
      load();
    } catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const openComment = (type, id, action) => {
    setCommentModal({ type, id, action });
    setComment("");
  };

  const submitWithComment = async () => {
    if (!commentModal) return;
    if (commentModal.type === "request") {
      await handleRequestAction(commentModal.id, commentModal.action, comment);
    } else {
      await handleLeaveAction(commentModal.id, commentModal.action, comment);
    }
    setCommentModal(null);
    setComment("");
  };

  const filteredRequests = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      [r.employee_name, r.request_type, r.location, r.reason].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [requests, query]);

  const filteredLeave = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return leaveRequests;
    return leaveRequests.filter((l) =>
      [l.employee_name, l.leave_type_name, l.reason].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [leaveRequests, query]);

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Workplace</p><h1>Approval Queue</h1><p>Review and approve pending attendance and leave requests.</p></div>
      </div>

      <div className="panel-actions-row no-print">
        <div className="tabs" style={{ border: "none", padding: 0, margin: 0 }}>
          <button className={`tab ${tab === "requests" ? "tab-active" : ""}`} onClick={() => setTab("requests")}>Attendance Requests ({requests.length})</button>
          <button className={`tab ${tab === "leave" ? "tab-active" : ""}`} onClick={() => setTab("leave")}>Leave Requests ({leaveRequests.length})</button>
        </div>
        <label className="search-bar"><Icon name="search" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." /></label>
      </div>

      {tab === "requests" && (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Date</th><th>Location</th><th>Reason</th><th>Stage</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="8" className="table-message">Loading...</td></tr>
                : filteredRequests.length ? filteredRequests.map((r) => (
                  <tr key={r.id}>
                    <td className="strong-cell">{r.employee_name}</td>
                    <td><span className="badge badge-blue">{r.request_type.replace(/_/g, " ")}</span></td>
                    <td className="td-muted">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="td-muted">{r.location || "\u2014"}</td>
                    <td className="td-muted">{r.reason || "\u2014"}</td>
                    <td>
                      {r.status === "pending" && <span className="badge badge-orange">Manager Review</span>}
                      {r.status === "manager_approved" && <span className="badge badge-blue">HR Review</span>}
                    </td>
                    <td><span className={`badge badge-${r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "orange"}`}>{r.status.replace(/_/g, " ")}</span></td>
                    <td>
                      <div className="action-btns">
                        {(canManagerAct(r) || canHRAct(r)) && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => openComment("request", r.id, "approved")}>Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => openComment("request", r.id, "rejected")}>Reject</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan="8" className="table-message">No pending requests.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "leave" && (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Reason</th><th>Stage</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="8" className="table-message">Loading...</td></tr>
                : filteredLeave.length ? filteredLeave.map((l) => (
                  <tr key={l.id}>
                    <td className="strong-cell">{l.employee_name}</td>
                    <td><span className="badge badge-blue">{l.leave_type_name}</span></td>
                    <td className="td-muted">{new Date(l.start_date).toLocaleDateString()}</td>
                    <td className="td-muted">{new Date(l.end_date).toLocaleDateString()}</td>
                    <td className="td-muted">{l.reason || "\u2014"}</td>
                    <td>
                      {l.status === "pending" && <span className="badge badge-orange">Manager Review</span>}
                      {l.status === "manager_approved" && <span className="badge badge-blue">HR Review</span>}
                    </td>
                    <td><span className={`badge badge-${l.status === "approved" ? "green" : l.status === "rejected" ? "red" : "orange"}`}>{l.status}</span></td>
                    <td>
                      <div className="action-btns">
                        {(canManagerAct(l) || canHRAct(l)) && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => openComment("leave", l.id, "approved")}>Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => openComment("leave", l.id, "rejected")}>Reject</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan="8" className="table-message">No pending leave requests.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {commentModal && (
        <div className="modal-overlay" onClick={() => setCommentModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>{commentModal.action === "approved" ? "Approve" : "Reject"}</h3>
              <button className="btn btn-ghost" onClick={() => setCommentModal(null)}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              <label className="form-label">Comment (optional)</label>
              <textarea className="form-input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder={commentModal.action === "approved" ? "Any notes for the employee..." : "Reason for rejection..."} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setCommentModal(null)}>Cancel</button>
              <button className={`btn ${commentModal.action === "approved" ? "btn-success" : "btn-danger"}`} onClick={submitWithComment}>
                {commentModal.action === "approved" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
