import { useEffect, useState, useMemo, Fragment } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import ReportHeader from "../components/ReportHeader";
import SearchBar from "../components/SearchBar";
import { formatBioTimeTimeValue } from "../utils/time";
import { matchesSearch } from "../utils/search";

function getMonthStart() {
  const d = new Date(); d.setUTCDate(1);
  return d.toISOString().split("T")[0];
}
function getMonthEnd() {
  const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
  return d.toISOString().split("T")[0];
}

export default function MonthlyReport() {
  const [data, setData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getMonthEnd);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => { API.get("/reports/department").then((r) => setDepartments(r.data.departments || [])).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    const params = { start_date: startDate, end_date: endDate };
    if (department) params.department = department;
    API.get("/reports/monthly", { params }).then((r) => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [startDate, endDate, department]);

  const days = data?.days || [];
  const weekGroups = data?.weekGroups || [];
  const employees = data?.employees || [];
  const filteredEmployees = useMemo(() => employees.filter((e) => matchesSearch(e, query, ["full_name", "card_id", "department"])), [employees, query]);

  const handleExport = async () => {
    if (!data) return;
    try {
      const XLSX = await import("xlsx");
      const headerRow = ["#", "Employee ID", "Full Name", "Department"];
      days.forEach((d) => { headerRow.push(`${d.dayName} ${d.monthDay} In`, `${d.dayName} ${d.monthDay} Out`, `${d.dayName} Hrs`); });
      headerRow.push("Total Monthly Hours");
      const rows = [
        ["Kifiya Financial Technology plc"],
        ["Monthly Attendance Report"],
        [`Reporting Period: ${startDate} to ${endDate}`],
        [`Generated: ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} | By: System`],
        [], headerRow,
      ];
      filteredEmployees.forEach((emp, i) => {
        const row = [i + 1, emp.card_id || emp.employee_id, emp.full_name, emp.department || ""];
        days.forEach((d) => {
          const day = emp.days[d.key];
          let inTime = day?.check_in || "";
          let outTime = day?.check_out || "";
          let hrs = day?.total_hours ? parseFloat(day.total_hours).toFixed(1) : "";
          if (day?.missing_checkout) outTime = "Missing CO";
          if (day?.approved) { inTime = day.approved_type || "Approved"; outTime = ""; hrs = ""; }
          row.push(inTime, outTime, hrs);
        });
        row.push(emp.total_hours?.toFixed(1) || "0");
        rows.push(row);
      });
      if (weekGroups.length > 0) {
        rows.push([]);
        weekGroups.forEach((wg) => {
          const empWeekHours = filteredEmployees.map((emp) => {
            let h = 0;
            days.forEach((d) => { if (d.weekNumber === wg.week - 1) { const dd = emp.days[d.key]; if (dd?.check_in && !dd?.missing_checkout && !dd?.approved) h += parseFloat(dd.total_hours) || 0; } });
            return h;
          });
          rows.push([`Week ${wg.week} (${wg.start} to ${wg.end}) - Total Hours`, ...empWeekHours.map((h) => h.toFixed(1)).join(",").split(","), "", ""]);
        });
      }
      const colSpec = [{ wch: 5 }, { wch: 12 }, { wch: 24 }, { wch: 20 }];
      days.forEach(() => { colSpec.push({ wch: 12 }, { wch: 12 }, { wch: 8 }); });
      colSpec.push({ wch: 18 });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = colSpec;
      ws["!freeze"] = { xSplit: 0, ySplit: 5 };
      ws["!props"] = [{ orientation: "landscape" }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Monthly Report");
      XLSX.writeFile(wb, `monthly-report-${startDate}-to-${endDate}.xlsx`);
    } catch (e) { alert("Export failed: " + e.message); }
  };

  return (
    <div className="page-container">
      <ReportHeader title="Monthly Attendance Report" subtitle={`Reporting Period: ${startDate} to ${endDate}`} dateRange={department ? `Department: ${department}` : "All Departments"}>
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
        <SearchBar value={query} onChange={setQuery} />
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
                {days.map((d) => (
                  <th key={d.key} colSpan={3} className="th-center th-day-header">
                    <div className="day-header-name">{d.dayName}</div>
                    <div className="day-header-date">{d.monthDay}</div>
                  </th>
                ))}
                <th className="th-total">Monthly Hrs</th>
              </tr>
              <tr className="tr-subheader">
                <th /><th /><th /><th />
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
                <tr><td colSpan={4 + days.length * 3 + 1} className="table-message">Loading...</td></tr>
              ) : filteredEmployees.length ? (
                filteredEmployees.map((emp, i) => (
                  <tr key={emp.employee_id}>
                    <td className="sticky-col td-muted">{i + 1}</td>
                    <td className="sticky-col-2 td-center">{emp.card_id || emp.employee_id}</td>
                    <td className="sticky-col-3 strong-cell">{emp.full_name}</td>
                    <td className="sticky-col-4"><span className="badge badge-blue">{emp.department || "\u2014"}</span></td>
                    {days.map((d) => {
                      const day = emp.days[d.key];
                      if (!day) return <Fragment key={`${d.key}-empty`}><td className="td-center"></td><td className="td-center"></td><td className="td-center"></td></Fragment>;
                      if (day.approved) return <Fragment key={`${d.key}-app`}><td className="td-center td-approved" colSpan={3}>{day.approved_type || "Approved"}</td></Fragment>;
                      return (
                        <Fragment key={d.key}>
                          <td className="td-center">{formatBioTimeTimeValue(day.check_in) || "\u2014"}</td>
                          <td className={`td-center${day.missing_checkout ? " td-warning" : ""}`}>{day.missing_checkout ? "MCO" : (formatBioTimeTimeValue(day.check_out) || "\u2014")}</td>
                          <td className="td-center td-muted">{day.total_hours ? `${parseFloat(day.total_hours).toFixed(1)}` : "\u2014"}</td>
                        </Fragment>
                      );
                    })}
                    <td className="td-center td-total"><strong>{emp.total_hours?.toFixed(1) || "0"}h</strong></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4 + days.length * 3 + 1} className="table-message">No data for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredEmployees.length > 0 && (
          <div className="table-footer">Showing {filteredEmployees.length} of {employees.length} employees | {days.length} days | {weekGroups.length} week{weekGroups.length !== 1 ? "s" : ""}</div>
        )}
      </div>
    </div>
  );
}
