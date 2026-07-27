import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import ReportHeader from "../components/ReportHeader";

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

  useEffect(() => { API.get("/reports/department").then((r) => setDepartments(r.data.departments || [])).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    const params = { start_date: startDate, end_date: endDate };
    if (department) params.department = department;
    API.get("/reports/monthly", { params }).then((r) => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [startDate, endDate, department]);

  const days = data?.days || [];
  const weekGroups = data?.weekGroups || [];

  const handleExport = async () => {
    if (!data) return;
    try {
      const XLSX = await import("xlsx");
      const headerRow = ["#", "Employee ID", "Full Name", "Department"];
      days.forEach((d) => { headerRow.push(`${d.dayNum} ${d.dayName}`, ""); });
      headerRow.push("Total Monthly Hours");
      const rows = [
        ["Kifiya Financial Technology plc"],
        ["Monthly Attendance Report"],
        [`Reporting Period: ${startDate} to ${endDate}`],
        [`Generated: ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} | By: System`],
        [], headerRow,
      ];
      for (const emp of (data?.employees || [])) {
        const row = [emp.employee_id, emp.employee_id, emp.full_name, emp.department || ""];
        days.forEach((d) => {
          const day = emp.days[d.key];
          let inTime = day?.check_in || "";
          let outTime = day?.check_out || "";
          if (day?.missing_checkout) outTime = "Missing CO";
          if (day?.approved) { inTime = day.approved_type || "Approved"; outTime = ""; }
          row.push(inTime, outTime);
        });
        row.push(emp.total_hours?.toFixed(1) || "0");
        rows.push(row);
      }
      if (weekGroups.length > 0) {
        rows.push([]);
        weekGroups.forEach((wg) => {
          const empWeekHours = (data?.employees || []).map((emp) => {
            let h = 0;
            days.forEach((d) => { if (d.weekNumber === wg.week - 1) { const dd = emp.days[d.key]; if (dd?.check_in && !dd?.missing_checkout && !dd?.approved) h += parseFloat(dd.total_hours) || 0; } });
            return h;
          });
          rows.push([`Week ${wg.week} (${wg.start} to ${wg.end}) - Total Hours`, ...empWeekHours.map((h) => h.toFixed(1)).join(",").split(","), "", ""]);
        });
      }
      const colSpec = [{ wch: 5 }, { wch: 12 }, { wch: 24 }, { wch: 20 }];
      days.forEach(() => { colSpec.push({ wch: 10 }, { wch: 10 }); });
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

  const weekSubtotals = useMemo(() => {
    if (!data) return {};
    const result = {};
    for (const emp of data.employees) {
      result[emp.employee_id] = {};
      for (const wg of weekGroups) {
        let h = 0;
        days.forEach((d) => { if (d.weekNumber === wg.week - 1) { const dd = emp.days[d.key]; if (dd?.check_in && !dd?.missing_checkout && !dd?.approved) h += parseFloat(dd.total_hours) || 0; } });
        result[emp.employee_id][wg.week] = h;
      }
    }
    return result;
  }, [data, days, weekGroups]);

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
      </div>
      <div className="panel report-panel">
        <div className="table-wrap report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th className="sticky-col">#</th><th className="sticky-col-2">Employee</th><th className="sticky-col-3">Dept</th>
                {days.map((d) => <th key={d.key} className="th-center"><div>{d.dayNum}</div><div className="th-sub">{d.dayName}</div></th>)}
                <th className="th-total">Total</th>
              </tr>
              <tr className="tr-subheader">
                <th /><th /><th />
                {days.map((d) => <th key={d.key + "-sub"} className="th-center th-sub">In/Out</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4 + days.length} className="table-message">Loading...</td></tr>
              ) : data?.employees?.length ? (
                data.employees.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td className="sticky-col td-muted">{emp.employee_id}</td>
                    <td className="sticky-col-2 strong-cell">{emp.full_name}</td>
                    <td className="sticky-col-3"><span className="badge badge-blue">{emp.department || "\u2014"}</span></td>
                    {days.map((d) => {
                      const day = emp.days[d.key];
                      if (day?.approved) return <td key={d.key} className="td-center td-approved">{day.approved_type || "Appr"}</td>;
                      if (!day?.check_in && !day?.status) return <td key={d.key} className="td-center"></td>;
                      if (day?.missing_checkout) return <td key={d.key} className="td-center td-warning">{day.check_in || ""} / MCO</td>;
                      return <td key={d.key} className="td-center">{day?.check_in || ""} / {day?.check_out || ""}</td>;
                    })}
                    <td className="td-center td-total"><strong>{emp.total_hours?.toFixed(1) || "0"}h</strong></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4 + days.length} className="table-message">No data for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {data?.employees?.length > 0 && (
          <div className="table-footer">Showing {data.employees.length} employees | {days.length} days | {weekGroups.length} week{weekGroups.length !== 1 ? "s" : ""}</div>
        )}
      </div>
    </div>
  );
}
