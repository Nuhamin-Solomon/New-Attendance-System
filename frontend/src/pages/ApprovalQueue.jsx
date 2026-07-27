import { useEffect, useState } from "react";
import API from "../services/api";
import Icon from "../components/Icon";

export default function ApprovalQueue() {
  const [requests, setRequests] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [tab, setTab] = useState("requests");
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      API.get("/requests?status=pending"),
      API.get("/leave?status=pending"),
    ]).then(([rRes, lRes]) => { setRequests(rRes.data); setLeaveRequests(lRes.data); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleRequestAction = async (id, action, comment) => {
    try { await API.put(`/requests/${id}/manager`, { status: action, comment }); load(); }
    catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleHRAction = async (id, action, comment) => {
    try { await API.put(`/requests/${id}/hr`, { status: action, comment }); load(); }
    catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  const handleLeaveAction = async (id, action) => {
    try { await API.put(`/leave/${id}/${action}`); load(); }
    catch (err) { alert(err.response?.data?.error || "Failed"); }
  };

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Workplace</p><h1>Approval Queue</h1><p>Review and approve pending attendance requests and leave applications.</p></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "requests" ? "tab-active" : ""}`} onClick={() => setTab("requests")}>Attendance Requests ({requests.length})</button>
        <button className={`tab ${tab === "leave" ? "tab-active" : ""}`} onClick={() => setTab("leave")}>Leave Requests ({leaveRequests.length})</button>
      </div>

      {tab === "requests" && (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Date</th><th>Location</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="7" className="table-message">Loading...</td></tr>
                : requests.length ? requests.map((r) => (
                  <tr key={r.id}>
                    <td className="strong-cell">{r.employee_name}</td>
                    <td><span className="badge badge-blue">{r.request_type.replace("_", " ")}</span></td>
                    <td className="td-muted">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="td-muted">{r.location || "—"}</td>
                    <td className="td-muted">{r.reason || "—"}</td>
                    <td><span className={`badge badge-${r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "orange"}`}>{r.status.replace("_", " ")}</span></td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-sm btn-success" onClick={() => handleRequestAction(r.id, "approved")}>Approve</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleRequestAction(r.id, "rejected")}>Reject</button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan="7" className="table-message">No pending requests.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "leave" && (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="7" className="table-message">Loading...</td></tr>
                : leaveRequests.length ? leaveRequests.map((l) => (
                  <tr key={l.id}>
                    <td className="strong-cell">{l.employee_name}</td>
                    <td><span className="badge badge-blue">{l.leave_type_name}</span></td>
                    <td className="td-muted">{new Date(l.start_date).toLocaleDateString()}</td>
                    <td className="td-muted">{new Date(l.end_date).toLocaleDateString()}</td>
                    <td className="td-muted">{l.reason || "—"}</td>
                    <td><span className="badge badge-orange">{l.status}</span></td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-sm btn-success" onClick={() => handleLeaveAction(l.id, "approve")}>Approve</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleLeaveAction(l.id, "reject")}>Reject</button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan="7" className="table-message">No pending leave requests.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
