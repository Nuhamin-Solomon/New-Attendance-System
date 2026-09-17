import { useEffect, useMemo, useState, useCallback } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import { formatBioTimeDateTimeValue } from "../utils/time";

const PAGE_SIZE = 25;
const formatTime = (iso) => iso ? formatBioTimeDateTimeValue(iso) : "—";

export default function AttendanceTransactions() {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState(query);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setQuery(searchInput), 250);
    return () => clearTimeout(id);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (query) params.search = query;
      if (dateFrom) params.start_date = dateFrom;
      if (dateTo) params.end_date = dateTo;
      const res = await API.get("/attendance", { params });
      const d = res.data;
      if (Array.isArray(d)) {
        const start = (page - 1) * PAGE_SIZE;
        setRecords(d.slice(start, start + PAGE_SIZE));
        setTotal(d.length);
        setTotalPages(Math.max(1, Math.ceil(d.length / PAGE_SIZE)));
      } else {
        setRecords(d.data || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 1);
      }
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [page, query, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [query, dateFrom, dateTo]);

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Records</p><h1>Attendance Transactions</h1><p>Raw biometric check-in records from BioTime.</p></div>
        <div className="header-count">{total} records</div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <div><div className="panel-title">Transaction Log</div><div className="panel-subtitle">Most recent scans first</div></div>
          <div className="panel-actions">
            <input type="date" className="form-input form-input-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" className="form-input form-input-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <label className="search-bar"><Icon name="search" size={16} /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search by name, ID, or department" /></label>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Department</th><th>Scan Time</th><th>Source</th><th>Log ID</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="table-message">Loading...</td></tr>
              : records.length ? records.map((r) => (
                <tr key={r.id}>
                  <td className="strong-cell">{r.full_name}</td>
                  <td><span className="badge badge-blue">{r.department || "—"}</span></td>
                  <td className="td-muted">{formatTime(r.scan_time)}</td>
                  <td><span className="badge badge-green">{r.source || "BioTime"}</span></td>
                  <td className="td-muted">#{r.id}</td>
                </tr>
              )) : <tr><td colSpan={5} className="table-message">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="records" />
      </div>
    </div>
  );
}
