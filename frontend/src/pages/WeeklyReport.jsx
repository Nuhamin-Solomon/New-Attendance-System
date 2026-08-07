import { useEffect, useState, Fragment, useMemo } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import ReportHeader from "../components/ReportHeader";
import SearchBar from "../components/SearchBar";
import { matchesSearch } from "../utils/search";

function getWeekStart(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().split("T")[0];
}

function getWeekEnd(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? 0 : 6);
  d.setUTCDate(diff);
  return d.toISOString().split("T")[0];
}

export default function WeeklyReport() {
  const [data, setData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState(() => getWeekStart(new Date().toISOString().split("T")[0]));
  const [endDate, setEndDate] = useState(() => getWeekEnd(new Date().toISOString().split("T")[0]));
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    API.get("/reports/department").then((r) => setDepartments(r.data.departments || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { start_date: startDate, end_date: endDate };
    if (department) params.department = department;
    API.get("/reports/weekly", { params })
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [startDate, endDate, department]);

  const handleStartChange = (val) => {
    setStartDate(val);
    setEndDate(getWeekEnd(val));
  };

  const days = data?.days || [];
  const employees = data?.employees || [];
  const filteredEmployees = useMemo(() => employees.filter((e) => matchesSearch(e, query, ["full_name", "card_id", "department"])), [employees, query]);

  const handleExport = async () => {
    if (!data) return;
    try {
      const XLSX = await import("xlsx");

      const headerRow = ["#", "Employee ID", "Full Name", "Department"];
      days.forEach((d) => { headerRow.push(`${d.dayName} ${d.dayLabel} In`, `${d.dayName} ${d.dayLabel} Out`, `${d.dayName} Hrs`); });
      headerRow.push("Total Weekly Hours");

      const rows = [
        ["Kifiya Financial Technology plc"],
        ["Weekly Attendance Report"],
        [`Reporting Period: ${startDate} to ${endDate}`],
        [`Generated: ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} | By: System`],
        [],
        headerRow,
      ];

      (filteredEmployees || []).forEach((emp, i) => {
        const row = [i + 1, emp.card_id || emp.employee_id, emp.full_name, emp.department || ""];
        days.forEach((d) => {
          const day = emp.days[d.key];
          let inTime = day?.check_in || "";
          let outTime = day?.check_out || "";
          let hrs = day?.total_hours ? parseFloat(day.total_hours).toFixed(1) : "";
          if (day?.absent) { inTime = "Absent"; outTime = ""; hrs = ""; }
          if (day?.missing_checkout) outTime = "Missed Clock-Out";
          if (day?.approved) { inTime = day.approved_type || "Approved"; outTime = ""; hrs = ""; }
          row.push(inTime, outTime, hrs);
        });
        row.push(emp.weekly_hours?.toFixed(1) || "0");
        rows.push(row);
      });

      const colSpec = [{ wch: 5 }, { wch: 12 }, { wch: 24 }, { wch: 20 }];
      days.forEach(() => { colSpec.push({ wch: 12 }, { wch: 12 }, { wch: 8 }); });
      colSpec.push({ wch: 18 });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = colSpec;
      ws["!freeze"] = { xSplit: 0, ySplit: 5 };
      ws["!props"] = [{ orientation: "landscape" }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Weekly Report");
      XLSX.writeFile(wb, `weekly-report-${startDate}-to-${endDate}.xlsx`);
    } catch (e) { alert("Export failed: " + e.message); }
  };

  const handlePrint = () => window.print();

  return (
    <div className="page-container">
      <ReportHeader
        title="Weekly Attendance Report"
        subtitle={`Reporting Period: ${startDate} to ${endDate}`}
        dateRange={department ? `Department: ${department}` : "All Departments"}
      >
        <button className="btn btn-ghost no-print" onClick={handlePrint}><Icon name="eye" size={14} /> Print</button>
        <button className="btn btn-primary no-print" onClick={handleExport}><Icon name="download" size={14} /> Export Excel</button>
      </ReportHeader>

      <div className="panel-actions-row no-print">
        <label className="form-label" style={{ margin: 0 }}>Start Date</label>
        <input type="date" className="form-input form-input-sm" value={startDate} onChange={(e) => handleStartChange(e.target.value)} />
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
                    <div className="day-header-date">{d.dayLabel}</div>
                  </th>
                ))}
                <th className="th-total">Weekly Hrs</th>
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
                      if (day.absent) return <Fragment key={`${d.key}-abs`}><td className="td-center td-absent" colSpan={3}>Absent</td></Fragment>;
                      return (
                        <Fragment key={d.key}>
                          <td className="td-center">{day.check_in || "\u2014"}</td>
                          <td className={`td-center${day.missing_checkout ? " td-warning" : ""}`}>{day.missing_checkout ? <span className="td-mco">Missed Clock-Out</span> : (day.check_out || "\u2014")}</td>
                          <td className="td-center td-muted">{day.total_hours ? `${parseFloat(day.total_hours).toFixed(1)}` : "\u2014"}</td>
                        </Fragment>
                      );
                    })}
                    <td className="td-center td-total"><strong>{emp.weekly_hours?.toFixed(1) || "0"}h</strong></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4 + days.length * 3 + 1} className="table-message">No data for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredEmployees.length > 0 && (
          <div className="table-footer">Showing {filteredEmployees.length} of {employees.length} employees | {days.length} days</div>
        )}
      </div>
    </div>
  );
}
