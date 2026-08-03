import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import { formatBioTimeDateTimeValue } from "../utils/time";
import { matchesSearch } from "../utils/search";

const formatTime = (iso) => iso ? formatBioTimeDateTimeValue(iso) : "—";

export default function AttendanceTransactions() {
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = {};
    if (dateFrom) params.start_date = dateFrom;
    if (dateTo) params.end_date = dateTo;
    API.get("/attendance", { params }).then((r) => setRecords(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() => records.filter((r) =>
    matchesSearch(r, query, ["full_name", "card_id", "department", "source"])
  ), [records, query]);

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Records</p><h1>Attendance Transactions</h1><p>Raw biometric check-in records from BioTime.</p></div>
        <div className="header-count">{records.length} records</div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <div><div className="panel-title">Transaction Log</div><div className="panel-subtitle">Most recent scans first</div></div>
          <div className="panel-actions">
            <input type="date" className="form-input form-input-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" className="form-input form-input-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <label className="search-bar"><Icon name="search" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, ID, or department" /></label>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Department</th><th>Scan Time</th><th>Source</th><th>Log ID</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="table-message">Loading...</td></tr>
              : filtered.length ? filtered.map((r) => (
                <tr key={r.id}>
                  <td className="strong-cell">{r.full_name}</td>
                  <td><span className="badge badge-blue">{r.department || "—"}</span></td>
                  <td className="td-muted">{formatTime(r.scan_time)}</td>
                  <td><span className="badge badge-green">{r.source || "BioTime"}</span></td>
                  <td className="td-muted">#{r.id}</td>
                </tr>
              )) : <tr><td colSpan="5" className="table-message">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
        {!loading && <div className="table-footer">Showing {filtered.length} of {records.length} records</div>}
      </div>
    </div>
  );
}
