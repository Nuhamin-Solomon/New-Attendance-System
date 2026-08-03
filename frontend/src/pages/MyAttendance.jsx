import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import SearchBar from "../components/SearchBar";
import { formatBioTimeDateValue, formatBioTimeTimeValue } from "../utils/time";
import { matchesSearch } from "../utils/search";

const statusBadge = (s) => {
  const map = { present: "green", late: "orange", absent: "red", leave: "purple", field_duty: "teal", approved: "green", present_incomplete: "orange" };
  return <span className={`badge badge-${map[s] || "blue"}`}>{(s || "no data").replace(/_/g, " ")}</span>;
};

export default function MyAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("monthly");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    API.get("/summary/my", { params: { start_date: startDate, end_date: endDate } })
      .then((r) => setRecords(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [startDate, endDate]);

  const setPreset = (preset) => {
    const today = new Date();
    const end = today.toISOString().split("T")[0];
    let start;
    if (preset === "week") {
      const d = new Date(today); d.setDate(d.getDate() - 7);
      start = d.toISOString().split("T")[0];
    } else if (preset === "month") {
      const d = new Date(today); d.setDate(1);
      start = d.toISOString().split("T")[0];
    } else if (preset === "3months") {
      const d = new Date(today); d.setMonth(d.getMonth() - 3);
      start = d.toISOString().split("T")[0];
    }
    setStartDate(start);
    setEndDate(end);
    setViewMode(preset === "week" ? "daily" : "monthly");
  };

  const totalHours = records.reduce((s, r) => s + (parseFloat(r.total_hours) || 0), 0);
  const presentDays = records.filter((r) => r.status === "present" || r.status === "late").length;
  const absentDays = records.filter((r) => r.status === "absent").length;
  const missingCODays = records.filter((r) => r.status === "present_incomplete").length;
  const approvedDays = records.filter((r) => r.status === "approved" || r.status === "field_duty").length;

  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.trim().toLowerCase();
    return records.filter((r) =>
      matchesSearch(r, query, ["date", "status", "notes"]) ||
      formatBioTimeDateValue(r.date).toLowerCase().includes(q)
    );
  }, [records, query]);

  const handleExport = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = [
        ["Kifiya Financial Technology plc"],
        ["My Attendance Report"],
        [`Period: ${startDate} to ${endDate}`],
        [`Generated: ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`],
        [],
        ["#", "Date", "First Check-In", "Last Check-Out", "Total Working Hours", "Status", "Notes"],
      ];
      filtered.forEach((r, i) => {
        let notes = "";
        if (r.status === "present_incomplete") notes = "Missing check-out";
        else if (r.status === "approved") notes = r.notes || "Approved";
        rows.push([
          i + 1,
          formatBioTimeDateValue(r.date),
          r.first_in ? formatBioTimeTimeValue(r.first_in) : "",
          r.last_out ? formatBioTimeTimeValue(r.last_out) : "",
          r.total_hours ? parseFloat(r.total_hours).toFixed(1) : "0",
          r.status || "absent",
          notes,
        ]);
      });
      rows.push([]);
      rows.push(["Summary"]);
      rows.push(["Total Working Hours", totalHours.toFixed(1)]);
      rows.push(["Days Present", presentDays]);
      rows.push(["Days Absent", absentDays]);
      rows.push(["Missing Check-Out", missingCODays]);
      rows.push(["Approved Days", approvedDays]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 22 }];
      ws["!freeze"] = { xSplit: 0, ySplit: 5 };
      ws["!props"] = [{ orientation: "landscape" }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "My Attendance");
      XLSX.writeFile(wb, `my-attendance-${startDate}-to-${endDate}.xlsx`);
    } catch (e) { alert("Export failed: " + e.message); }
  };

  const handlePrint = () => window.print();

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">My Attendance</p><h1>My Attendance</h1><p>View your personal attendance history.</p></div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-ghost no-print" onClick={handlePrint}><Icon name="eye" size={14} /> Print</button>
          <button className="btn btn-primary no-print" onClick={handleExport}><Icon name="download" size={14} /> Export Excel</button>
        </div>
      </div>

      <div className="panel-actions-row no-print">
        <div style={{ display: "flex", gap: "6px" }}>
          {["week", "month", "3months"].map((p) => (
            <button key={p} className={`btn btn-sm ${viewMode === p || (p === "week" && viewMode === "daily") || (p !== "week" && viewMode === "monthly") ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setPreset(p)}>
              {p === "week" ? "Last 7 Days" : p === "month" ? "This Month" : "Last 3 Months"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <label className="form-label" style={{ margin: 0 }}>From</label>
          <input type="date" className="form-input form-input-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <label className="form-label" style={{ margin: 0 }}>To</label>
          <input type="date" className="form-input form-input-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <SearchBar value={query} onChange={setQuery} placeholder="Search by date, status, or notes" />
        </div>
      </div>

      <div className="stats-grid stats-grid-5 no-print">
        <article className="stat-card blue"><div className="stat-icon"><Icon name="database" size={18} /></div><div><p className="stat-label">Total Hours</p><p className="stat-value">{totalHours.toFixed(1)}h</p></div></article>
        <article className="stat-card green"><div className="stat-icon"><Icon name="check-circle" size={18} /></div><div><p className="stat-label">Present</p><p className="stat-value">{presentDays}</p></div></article>
        <article className="stat-card red"><div className="stat-icon"><Icon name="users" size={18} /></div><div><p className="stat-label">Absent</p><p className="stat-value">{absentDays}</p></div></article>
        <article className="stat-card orange"><div className="stat-icon"><Icon name="clock" size={18} /></div><div><p className="stat-label">Missing CO</p><p className="stat-value">{missingCODays}</p></div></article>
        <article className="stat-card teal"><div className="stat-icon"><Icon name="file-text" size={18} /></div><div><p className="stat-label">Approved</p><p className="stat-value">{approvedDays}</p></div></article>
      </div>

      <div className="panel report-panel">
        <div className="table-wrap report-table-wrap">
          <table className="report-table">
            <thead>
              <tr><th>#</th><th>Date</th><th>First Check-In</th><th>Last Check-Out</th><th>Total Working Hours</th><th>Status</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="table-message">Loading...</td></tr>
              : filtered.length ? filtered.map((r, i) => {
                let notes = "";
                if (r.status === "present_incomplete") notes = "Missing check-out";
                else if (r.status === "approved") notes = r.notes || "Approved";
                return (
                  <tr key={r.id}>
                    <td className="td-muted">{i + 1}</td>
                    <td className="strong-cell">{formatBioTimeDateValue(r.date)}</td>
                    <td className="td-center">{r.first_in ? formatBioTimeTimeValue(r.first_in) : "—"}</td>
                    <td className="td-center">{r.last_out ? formatBioTimeTimeValue(r.last_out) : "—"}</td>
                    <td className="td-center"><strong>{r.total_hours ? `${parseFloat(r.total_hours).toFixed(1)}h` : "—"}</strong></td>
                    <td className="td-center">{statusBadge(r.status)}</td>
                    <td className="td-center">{notes && <span className="badge badge-orange">{notes}</span>}</td>
                  </tr>
                );
              }) : <tr><td colSpan={7} className="table-message">No attendance records found for this period.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && <div className="table-footer">Showing {filtered.length} of {records.length} days | Total: {totalHours.toFixed(1)} hours</div>}
      </div>
    </div>
  );
}
