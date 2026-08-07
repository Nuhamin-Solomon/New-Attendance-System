import { useEffect, useState } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import ReportHeader from "../components/ReportHeader";
import SearchBar from "../components/SearchBar";
import { formatBioTimeDateValue } from "../utils/time";

function getMonthStart() {
  const d = new Date();
  d.setUTCDate(1);
  return d.toISOString().split("T")[0];
}
function getMonthEnd() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().split("T")[0];
}

const statusBadge = (status) => {
  const map = { present: "green", late: "orange", missing_checkout: "orange", approved: "green", leave: "purple", absent: "red" };
  return <span className={`badge badge-${map[status] || "blue"}`}>{(status || "").replace(/_/g, " ")}</span>;
};

const fmtMonth = (start) =>
  new Date(start + "T12:00:00Z").toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });

function periodLabel(start, end) {
  if (start && end && start.slice(0, 7) === end.slice(0, 7)) return fmtMonth(start);
  return `${formatBioTimeDateValue(start)} \u2013 ${formatBioTimeDateValue(end)}`;
}

export default function MonthlySummary() {
  const [data, setData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getMonthEnd);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    API.get("/reports/department").then((r) => setDepartments(r.data.departments || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { start_date: startDate, end_date: endDate, status };
    if (department) params.department = department;
    if (query.trim()) params.search = query.trim();
    API.get("/reports/summary-monthly", { params })
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [startDate, endDate, department, status, query]);

  const employees = data?.employees || [];
  const workingDays = data?.working_days || 0;
  const settings = data?.settings || {};

  const openDetail = async (emp) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(emp.employee_id)) next.delete(emp.employee_id);
      else next.add(emp.employee_id);
      return next;
    });
  };

  const handleExport = async () => {
    if (!data) return;
    try {
      const XLSX = await import("xlsx");
      const rows = [
        ["Kifiya Financial Technology plc"],
        ["Monthly Attendance Summary"],
        [`Reporting Period: ${startDate} to ${endDate}`],
        [`Generated: ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} | By: System`],
        [],
        ["#", "Employee ID", "Full Name", "Department", "Month", "Total Hours", "Present Days", "Late Arrivals", "Early Departures", "Absent Days", "Missing Check-Outs", "Approved Days", "Leave Days", "Overtime Hours"],
      ];
      employees.forEach((e, i) => {
        rows.push([
          i + 1, e.card_id || e.employee_id, e.full_name, e.department || "",
          periodLabel(startDate, endDate),
          e.total_hours?.toFixed(1) || "0",
          e.present_days, e.late_arrivals, e.early_departures, e.absent_days,
          e.missing_checkouts, e.approved_days, e.leave_days,
          e.overtime_hours?.toFixed(1) || "0",
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 5 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 16 }, { wch: 11 },
        { wch: 16 }, { wch: 13 }, { wch: 10 }, { wch: 14 },
      ];
      ws["!freeze"] = { xSplit: 0, ySplit: 5 };
      ws["!props"] = [{ orientation: "landscape" }];

      const detailRows = [
        ["Kifiya Financial Technology plc"],
        ["Monthly Attendance Report - Daily Breakdown"],
        [`Reporting Period: ${startDate} to ${endDate}`],
        [`Generated: ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} | By: System`],
        [],
        ["Employee ID", "Full Name", "Department", "Date", "Day", "Check-In", "Check-Out", "Daily Hours", "Overtime", "Status"],
      ];
      employees.forEach((e) => {
        (e.days || []).forEach((d) => {
          detailRows.push([
            e.card_id || e.employee_id, e.full_name, e.department || "",
            d.date, d.day, d.check_in || "", d.check_out || "",
            d.total_hours ? d.total_hours.toFixed(1) : "",
            d.overtime ? d.overtime.toFixed(1) : "",
            d.is_late && d.status === "present" ? "late" : d.status,
          ]);
        });
      });
      const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
      ws2["!cols"] = [
        { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 10 },
        { wch: 9 }, { wch: 9 }, { wch: 11 }, { wch: 9 }, { wch: 16 },
      ];
      ws2["!freeze"] = { xSplit: 0, ySplit: 5 };
      ws2["!props"] = [{ orientation: "landscape" }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Monthly Summary");
      XLSX.utils.book_append_sheet(wb, ws2, "Daily Breakdown");
      XLSX.writeFile(wb, `monthly-summary-${startDate}-to-${endDate}.xlsx`);
    } catch (e) { alert("Export failed: " + e.message); }
  };

  return (
    <div className="page-container">
      <ReportHeader
        title="Monthly Attendance Summary"
        subtitle={`Reporting Period: ${startDate} to ${endDate}`}
        dateRange={department ? `Department: ${department}` : "All Departments"}
      >
        <button className="btn btn-ghost no-print" onClick={() => window.print()}><Icon name="eye" size={14} /> Print</button>
        <button className="btn btn-primary no-print" onClick={handleExport}><Icon name="download" size={14} /> Export Excel</button>
      </ReportHeader>

      <div className="panel-actions-row no-print">
        <label className="form-label" style={{ margin: 0 }}>Start Date</label>
        <input type="date" className="form-input form-input-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label className="form-label" style={{ margin: 0 }}>End Date</label>
        <input type="date" className="form-input form-input-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <select className="form-input form-input-sm form-select-sm" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="form-input form-input-sm form-select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="present">Present (No Absence)</option>
          <option value="late">Late Arrivals</option>
          <option value="early_departure">Early Departures</option>
          <option value="absent">With Absences</option>
          <option value="missing_checkout">Missing Check-Outs</option>
          <option value="approved">Approved Days</option>
          <option value="leave">On Leave</option>
        </select>
        <SearchBar value={query} onChange={setQuery} placeholder="Search by name or ID" />
      </div>

      <div className="panel report-panel">
        <div className="table-wrap report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th className="sticky-col">#</th>
                <th className="sticky-col-2">Employee ID</th>
                <th className="sticky-col-3">Employee</th>
                <th className="sticky-col-4">Dept</th>
                <th className="th-center">Month</th>
                <th className="th-total">Total Hours</th>
                <th className="th-center">Present</th>
                <th className="th-center">Late</th>
                <th className="th-center">Early</th>
                <th className="th-center">Absent</th>
                <th className="th-center">Miss CO</th>
                <th className="th-center">Approved</th>
                <th className="th-center">Leave</th>
                <th className="th-center">Overtime</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={14} className="table-message">Loading...</td></tr>
              ) : employees.length ? (
                employees.map((emp, i) => (
                  <>
                  <tr key={emp.employee_id}>
                    <td className="sticky-col td-muted">{i + 1}</td>
                    <td className="sticky-col-2 td-center">{emp.card_id || emp.employee_id}</td>
                    <td className="sticky-col-3">
                      <button className="link-cell" onClick={() => openDetail(emp)}>
                        {expanded.has(emp.employee_id) ? <Icon name="chevron-down" size={12} /> : <Icon name="arrow-right" size={12} />} {emp.full_name}
                      </button>
                    </td>
                    <td className="sticky-col-4"><span className="badge badge-blue">{emp.department || "\u2014"}</span></td>
                    <td className="td-center td-muted">{periodLabel(startDate, endDate)}</td>
                    <td className="td-center td-total">
                      <button className="link-cell" onClick={() => openDetail(emp)}>{emp.total_hours?.toFixed(1) || "0"}h</button>
                    </td>
                    <td className="td-center">{emp.present_days}</td>
                    <td className="td-center">{emp.late_arrivals || "\u2014"}</td>
                    <td className="td-center">{emp.early_departures || "\u2014"}</td>
                    <td className={`td-center${emp.absent_days ? " td-status-absent" : ""}`}>{emp.absent_days || "\u2014"}</td>
                    <td className={`td-center${emp.missing_checkouts ? " td-status-late" : ""}`}>{emp.missing_checkouts || "\u2014"}</td>
                    <td className="td-center">{emp.approved_days || "\u2014"}</td>
                    <td className="td-center">{emp.leave_days || "\u2014"}</td>
                    <td className="td-center td-total">{emp.overtime_hours ? `${emp.overtime_hours.toFixed(1)}h` : "\u2014"}</td>
                  </tr>
                  {expanded.has(emp.employee_id) && (
                    <tr key={`${emp.employee_id}-days`} className="daily-breakdown-row">
                      <td colSpan={14}>
                        <div className="daily-breakdown">
                          <p className="daily-breakdown-title">Daily Attendance for {emp.full_name} ({periodLabel(startDate, endDate)})</p>
                          <div className="table-wrap">
                            <table className="daily-table">
                              <thead>
                                <tr><th>Date</th><th>Day</th><th>Check-In</th><th>Check-Out</th><th>Daily Hours</th><th>Overtime</th><th>Status</th></tr>
                              </thead>
                              <tbody>
                                {(emp.days || []).map((d) => {
                                  const displayStatus = d.is_late && d.status === "present" ? "late" : d.status;
                                  return (
                                    <tr key={d.date}>
                                      <td className="strong-cell">{formatBioTimeDateValue(d.date)}</td>
                                      <td className="td-muted">{d.day}</td>
                                      <td className="td-center">{d.check_in || "\u2014"}{d.is_late ? <span className="badge badge-orange" style={{ marginLeft: 6 }}>Late</span> : ""}</td>
                                      <td className="td-center">{d.check_out || "\u2014"}{d.early_departure ? <span className="badge badge-orange" style={{ marginLeft: 6 }}>Early</span> : ""}</td>
                                      <td className="td-center">{d.total_hours ? d.total_hours.toFixed(1) : "\u2014"}</td>
                                      <td className="td-center">{d.overtime ? `${d.overtime.toFixed(1)}h` : "\u2014"}</td>
                                      <td className="td-center">{statusBadge(displayStatus)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                ))
              ) : (
                <tr><td colSpan={14} className="table-message">No data for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {employees.length > 0 && (
          <div className="table-footer">
            Showing {employees.length} employees | {workingDays} working days
            {settings.overtime_threshold_hours ? ` | Overtime counted above ${settings.overtime_threshold_hours}h/day` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
