import { useEffect, useState } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import ReportHeader from "../components/ReportHeader";

function getLastWorkingDay() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function DailyReport() {
  const [data, setData] = useState(null);
  const [date, setDate] = useState(getLastWorkingDay);
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = { date };
    if (department) params.department = department;
    API.get("/reports/daily", { params })
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date, department]);

  const handleExport = async () => {
    if (!data) return;
    try {
      const XLSX = await import("xlsx");

      const rows = [
        ["Kifiya Financial Technology plc"],
        ["Daily Attendance Report"],
        [`Reporting Period: ${date}`],
        [`Generated: ${new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} | By: System`],
        [],
        ["#", "Employee ID", "Full Name", "Department", "First Check-In", "Last Check-Out", "Total Working Hours", "Remarks"],
      ];

      const filtered = data?.employees || [];
      filtered.forEach((emp, i) => {
        let remarks = "";
        if (emp.approved) remarks = emp.approved_type || "Approved";
        else if (emp.missing_checkout) remarks = "Missing Check-Out";
        else if (!emp.check_in) remarks = "No Scan";

        rows.push([
          i + 1,
          emp.card_id || emp.employee_id,
          emp.full_name,
          emp.department || "",
          emp.check_in || "",
          emp.check_out || "",
          emp.total_hours || "",
          remarks,
        ]);
      });

      rows.push([]);
      rows.push(["Total Employees", data?.summary?.total || 0]);
      rows.push(["Present", data?.summary?.present || 0]);
      rows.push(["Missing Check-Out", data?.summary?.missing_checkouts || 0]);
      rows.push(["Approved (Field Duty/Travel/etc.)", data?.summary?.approved || 0]);
      rows.push(["Absent", data?.summary?.absent || 0]);
      rows.push(["Total Working Hours", data?.summary?.total_hours || 0]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 22 }];
      ws["!freeze"] = { xSplit: 0, ySplit: 5 };
      ws["!props"] = [{ orientation: "landscape" }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Daily Report");
      XLSX.writeFile(wb, `daily-attendance-${date}.xlsx`);
    } catch (e) { alert("Export failed: " + e.message); }
  };

  const handlePrint = () => window.print();

  const summary = data?.summary || {};

  return (
    <div className="page-container">
      <ReportHeader
        title="Daily Attendance Report"
        subtitle={`Reporting Period: ${date}`}
        dateRange={department ? `Department: ${department}` : "All Departments"}
      >
        <button className="btn btn-ghost no-print" onClick={handlePrint}><Icon name="eye" size={14} /> Print</button>
        <button className="btn btn-primary no-print" onClick={handleExport}><Icon name="download" size={14} /> Export Excel</button>
      </ReportHeader>

      <div className="panel-actions-row no-print">
        <label className="form-label" style={{ margin: 0 }}>Date</label>
        <input type="date" className="form-input form-input-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        <select className="form-input form-input-sm form-select-sm" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All Departments</option>
          {(data?.departments_list || []).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="stats-grid stats-grid-5 no-print">
        <div className="stat-card blue"><div className="stat-icon"><Icon name="users" size={18} /></div><div><p className="stat-label">Total Employees</p><p className="stat-value">{summary.total || 0}</p></div></div>
        <div className="stat-card green"><div className="stat-icon"><Icon name="check-circle" size={18} /></div><div><p className="stat-label">Present</p><p className="stat-value">{summary.present || 0}</p></div></div>
        <div className="stat-card orange"><div className="stat-icon"><Icon name="clock" size={18} /></div><div><p className="stat-label">Missing Check-Out</p><p className="stat-value">{summary.missing_checkouts || 0}</p></div></div>
        <div className="stat-card purple"><div className="stat-icon"><Icon name="calendar" size={18} /></div><div><p className="stat-label">Approved</p><p className="stat-value">{summary.approved || 0}</p></div></div>
        <div className="stat-card teal"><div className="stat-icon"><Icon name="clock" size={18} /></div><div><p className="stat-label">Total Hours</p><p className="stat-value">{summary.total_hours || 0}h</p></div></div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Employee ID</th><th>Full Name</th><th>Department</th><th>First Check-In</th><th>Last Check-Out</th><th>Total Working Hours</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="table-message">Loading...</td></tr>
              ) : data?.employees?.length ? (
                data.employees.map((emp, i) => {
                  let remarks = "";
                  if (emp.approved) remarks = emp.approved_type || "Approved";
                  else if (emp.missing_checkout) remarks = "Missing Check-Out";
                  else if (!emp.check_in) remarks = "No Scan";
                  return (
                    <tr key={emp.employee_id}>
                      <td className="td-muted">{i + 1}</td>
                      <td className="td-center">{emp.card_id || emp.employee_id}</td>
                      <td className="strong-cell">{emp.full_name}</td>
                      <td><span className="badge badge-blue">{emp.department || "\u2014"}</span></td>
                      <td className="td-center">{emp.check_in || "\u2014"}</td>
                      <td className="td-center">{emp.check_out || "\u2014"}</td>
                      <td className="td-center">{emp.total_hours ? `${emp.total_hours}h` : "\u2014"}</td>
                      <td className="td-center">
                        {emp.missing_checkout && <span className="badge badge-orange">Missing Check-Out</span>}
                        {emp.approved && <span className="badge badge-purple">{emp.approved_type}</span>}
                        {!emp.missing_checkout && !emp.approved && !emp.check_in && <span className="badge badge-red">No Scan</span>}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={8} className="table-message">No attendance data for this date.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {data?.employees?.length > 0 && (
          <div className="table-footer">Showing {data.employees.length} employees</div>
        )}
      </div>
    </div>
  );
}
