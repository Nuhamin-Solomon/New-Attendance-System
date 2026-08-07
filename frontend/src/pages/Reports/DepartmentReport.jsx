import { useEffect, useState, Fragment, useMemo } from "react";
import API from "../../services/api";
import Icon from "../../components/Icon";
import ReportHeader from "../../components/ReportHeader";
import SearchBar from "../../components/SearchBar";
import { matchesSearch } from "../../utils/search";

export default function DepartmentReport() {
  const [data, setData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    API.get("/reports/department").then((r) => setDepartments(r.data.departments || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDept) { setLoading(false); setData(null); return; }
    setLoading(true);
    API.get("/reports/department", { params: { department: selectedDept, start_date: startDate, end_date: endDate } })
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedDept, startDate, endDate]);

  const days = [];
  if (data?.employees?.length) {
    const daySet = new Set();
    for (const emp of data.employees) {
      for (const rec of (emp.records || [])) {
        if (rec.date) daySet.add(rec.date);
      }
    }
    [...daySet].sort().forEach((d) => {
      const dt = new Date(d + "T12:00:00Z");
      days.push({
        key: d,
        dayName: dt.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }),
        dayNum: dt.getUTCDate(),
      });
    });
  }

  const empCount = data?.employee_count || 0;
  const attRate = data?.attendance_rate || 0;
  const totalHours = (data?.employees || []).reduce((s, e) => s + (e.total_hours || 0), 0);
  const avgHours = empCount > 0 ? (totalHours / empCount) : 0;
  const totalMissingCO = (data?.employees || []).reduce((s, e) => s + e.records.filter((r) => r.missing_checkout).length, 0);
  const totalApproved = (data?.employees || []).reduce((s, e) => s + e.records.filter((r) => r.approved).length, 0);

  const employees = data?.employees || [];
  const filteredEmployees = useMemo(() => employees.filter((e) => matchesSearch(e, query, ["full_name", "card_id", "department"])), [employees, query]);

  const handleExport = async () => {
    if (!data) return;
    try {
      const XLSX = await import("xlsx");
      const headerRow = ["#", "Employee ID", "Full Name"];
      days.forEach((d) => { headerRow.push(`${d.dayName} ${d.dayNum} In`, `${d.dayName} ${d.dayNum} Out`, `${d.dayName} Hrs`); });
      headerRow.push("Total Hours");

      const rows = [
        ["Kifiya Financial Technology plc"],
        ["Department Attendance Report"],
        [`Department: ${data.department}`],
        [`Period: ${data.start} to ${data.end}`],
        [`Employees: ${empCount} | Attendance Rate: ${attRate}% | Avg Hours: ${avgHours.toFixed(1)}h`],
        [`Generated: ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} | By: System`],
        [],
        headerRow,
      ];

      for (const emp of filteredEmployees) {
        const row = [emp.card_id || emp.employee_id, emp.card_id || emp.employee_id, emp.full_name];
        const recMap = {};
        for (const rec of (emp.records || [])) recMap[rec.date] = rec;
        days.forEach((d) => {
          const rec = recMap[d.key];
          let inTime = rec?.check_in || "";
          let outTime = rec?.check_out || "";
          let hrs = rec?.total_hours ? parseFloat(rec.total_hours).toFixed(1) : "";
          if (rec?.absent) { inTime = "Absent"; outTime = ""; hrs = ""; }
          if (rec?.missing_checkout) outTime = "Missed Clock-Out";
          if (rec?.approved) { inTime = rec.approved_type || "Approved"; outTime = ""; hrs = ""; }
          row.push(inTime, outTime, hrs);
        });
        row.push(emp.total_hours?.toFixed(1) || "0");
        rows.push(row);
      }

      const colSpec = [{ wch: 5 }, { wch: 12 }, { wch: 24 }];
      days.forEach(() => { colSpec.push({ wch: 10 }, { wch: 10 }, { wch: 7 }); });
      colSpec.push({ wch: 12 });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = colSpec;
      ws["!freeze"] = { xSplit: 0, ySplit: 7 };
      ws["!props"] = [{ orientation: "landscape" }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Department Report");
      XLSX.writeFile(wb, `department-report-${data.department.replace(/\s+/g, "-")}-${startDate}-to-${endDate}.xlsx`);
    } catch (e) { alert("Export failed: " + e.message); }
  };

  return (
    <div className="page-container">
      <ReportHeader title="Department Attendance Report" subtitle={selectedDept ? `${data?.department || ""}` : "Select a Department"} dateRange={selectedDept ? `Period: ${startDate} to ${endDate}` : ""}>
        {selectedDept && <button className="btn btn-ghost no-print" onClick={() => window.print()}><Icon name="eye" size={14} /> Print</button>}
        {selectedDept && <button className="btn btn-primary no-print" onClick={handleExport}><Icon name="download" size={14} /> Export Excel</button>}
      </ReportHeader>

      <div className="panel-actions-row no-print">
        <select className="form-input form-input-sm form-select-sm" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
          <option value="">Select Department</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label className="form-label" style={{ margin: 0 }}>From</label>
        <input type="date" className="form-input form-input-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label className="form-label" style={{ margin: 0 }}>To</label>
        <input type="date" className="form-input form-input-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {selectedDept && (
        <>
          <div className="stats-grid stats-grid-6 no-print">
            <div className="stat-card blue"><div className="stat-icon"><Icon name="users" size={18} /></div><div><p className="stat-label">Employees</p><p className="stat-value">{empCount}</p></div></div>
            <div className="stat-card teal"><div className="stat-icon"><Icon name="check-circle" size={18} /></div><div><p className="stat-label">Attendance Rate</p><p className="stat-value">{attRate}%</p></div></div>
            <div className="stat-card orange"><div className="stat-icon"><Icon name="clock" size={18} /></div><div><p className="stat-label">Total Hours</p><p className="stat-value">{totalHours.toFixed(0)}h</p></div></div>
            <div className="stat-card green"><div className="stat-icon"><Icon name="trending-up" size={18} /></div><div><p className="stat-label">Avg Hours/Employee</p><p className="stat-value">{avgHours.toFixed(1)}h</p></div></div>
            <div className="stat-card red"><div className="stat-icon"><Icon name="alert-triangle" size={18} /></div><div><p className="stat-label">Missing CO</p><p className="stat-value">{totalMissingCO}</p></div></div>
            <div className="stat-card purple"><div className="stat-icon"><Icon name="calendar" size={18} /></div><div><p className="stat-label">Approved Days</p><p className="stat-value">{totalApproved}</p></div></div>
          </div>

          <div className="panel report-panel">
            <div className="table-wrap report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th className="sticky-col">#</th>
                    <th className="sticky-col-2">Employee ID</th>
                    <th className="sticky-col-3">Employee</th>
                    {days.map((d) => (
                      <th key={d.key} colSpan={3} className="th-center th-day-header">
                        <div className="day-header-name">{d.dayName}</div>
                        <div className="day-header-date">{d.dayNum}</div>
                      </th>
                    ))}
                    <th className="th-total">Total Hrs</th>
                  </tr>
                  <tr className="tr-subheader">
                    <th /><th /><th />
                    {days.map((d) => (
                      <Fragment key={d.key + "-sub"}>
                        <th className="th-center th-sub">In</th>
                        <th className="th-center th-sub">Out</th>
                        <th className="th-center th-sub">Hrs</th>
                      </Fragment>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3 + days.length * 3 + 1} className="table-message">Loading...</td></tr>
                  ) : filteredEmployees.length ? (
                    filteredEmployees.map((emp, i) => {
                      const recMap = {};
                      for (const rec of (emp.records || [])) recMap[rec.date] = rec;
                      return (
                        <tr key={emp.employee_id}>
                          <td className="sticky-col td-muted">{i + 1}</td>
                          <td className="sticky-col-2 td-center">{emp.card_id || emp.employee_id}</td>
                          <td className="sticky-col-3 strong-cell">{emp.full_name}</td>
                          {days.map((d) => {
                            const rec = recMap[d.key];
                            if (!rec) return <Fragment key={d.key}><td className="td-center"></td><td className="td-center"></td><td className="td-center"></td></Fragment>;
                            if (rec.approved) return <Fragment key={d.key}><td className="td-center td-approved" colSpan={3}>{rec.approved_type || "Approved"}</td></Fragment>;
                            if (rec.absent) return <Fragment key={d.key}><td className="td-center td-absent" colSpan={3}>Absent</td></Fragment>;
                            return (
                              <Fragment key={d.key}>
                                <td className="td-center">{rec.check_in || "\u2014"}</td>
                                <td className={`td-center${rec.missing_checkout ? " td-warning" : ""}`}>{rec.missing_checkout ? <span className="td-mco">Missed Clock-Out</span> : (rec.check_out || "\u2014")}</td>
                                <td className="td-center td-muted">{rec.total_hours ? parseFloat(rec.total_hours).toFixed(1) : "\u2014"}</td>
                              </Fragment>
                            );
                          })}
                          <td className="td-center td-total"><strong>{emp.total_hours?.toFixed(1) || "0"}h</strong></td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={3 + days.length * 3 + 1} className="table-message">No data for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredEmployees.length > 0 && (
              <div className="table-footer">Showing {filteredEmployees.length} of {employees.length} employees | {days.length} days | Attendance Rate: {attRate}%</div>
            )}
          </div>
        </>
      )}

      {!selectedDept && (
        <div className="panel">
          <div className="panel-body" style={{ textAlign: "center", padding: "60px 20px" }}>
            <Icon name="building" size={40} />
            <p style={{ marginTop: 16, color: "var(--text-muted)" }}>Select a department to view the attendance report</p>
          </div>
        </div>
      )}
    </div>
  );
}
