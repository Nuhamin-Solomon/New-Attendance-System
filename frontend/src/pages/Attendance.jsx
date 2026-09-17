import { useEffect, useMemo, useState, useCallback } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import { formatBioTimeDateTimeValue } from "../utils/time";

const PAGE_SIZE = 25;
const formatTime = (iso) => iso ? formatBioTimeDateTimeValue(iso) : "—";

export default function Attendance() {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [attendance, setAttendance] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    const id = setTimeout(() => setQuery(searchInput), 250);
    return () => clearTimeout(id);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (query) params.search = query;
      const res = await API.get("/attendance", { params });
      const d = res.data;
      if (Array.isArray(d)) {
        const start = (page - 1) * PAGE_SIZE;
        setAttendance(d.slice(start, start + PAGE_SIZE));
        setTotal(d.length);
        setTotalPages(Math.max(1, Math.ceil(d.length / PAGE_SIZE)));
      } else {
        setAttendance(d.data || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 1);
      }
    } catch {
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [query]);

  return (
    <section className="fade-in">
      <div className="page-header page-header-row">
        <div>
          <p className="eyebrow">Records</p>
          <h1>Attendance</h1>
          <p>Review biometric check-ins captured from BioTime.</p>
        </div>
        <div className="header-count">{total} records</div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Attendance log</div>
            <div className="panel-subtitle">Most recent scans appear first</div>
          </div>
          <label className="search-bar">
            <Icon name="search" size={16} />
            <input
              aria-label="Search attendance"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, ID, or department"
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th><th>Department</th><th>Scan time</th><th>Source</th><th>Log ID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="table-message">Loading attendance records…</td></tr>
              ) : attendance.length ? (
                attendance.map((row) => (
                  <tr key={row.id}>
                    <td className="strong-cell">{row.full_name}</td>
                    <td><span className="badge badge-blue">{row.department || "Unassigned"}</span></td>
                    <td className="td-muted">{formatTime(row.scan_time)}</td>
                    <td><span className="badge badge-green">{row.source || "BioTime"}</span></td>
                    <td className="td-muted">#{row.id}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="table-message">No attendance records match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="records" />
      </div>
    </section>
  );
}
