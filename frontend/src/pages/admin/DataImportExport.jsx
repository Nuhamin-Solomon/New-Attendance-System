import { useState } from "react";
import API from "../../services/api";
import Icon from "../../components/Icon";

async function parseSheet(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: false, dateNF: "yyyy-mm-dd hh:mm:ss" });
}

async function downloadWorkbook(sheetName, rows, fileName) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

const todayKey = () => new Date().toISOString().split("T")[0];

export default function DataImportExport() {
  const [empFile, setEmpFile] = useState(null);
  const [empRows, setEmpRows] = useState([]);
  const [empPreview, setEmpPreview] = useState([]);
  const [empError, setEmpError] = useState("");
  const [empBusy, setEmpBusy] = useState(false);
  const [empResult, setEmpResult] = useState(null);

  const [attFile, setAttFile] = useState(null);
  const [attRows, setAttRows] = useState([]);
  const [attPreview, setAttPreview] = useState([]);
  const [attError, setAttError] = useState("");
  const [attBusy, setAttBusy] = useState(false);
  const [attResult, setAttResult] = useState(null);

  const [expFrom, setExpFrom] = useState("");
  const [expTo, setExpTo] = useState("");
  const [exporting, setExporting] = useState("");

  const handleEmpFile = async (file) => {
    setEmpFile(file);
    setEmpResult(null);
    setEmpError("");
    try {
      const rows = await parseSheet(file);
      if (rows.length === 0) { setEmpError("No rows found in the file."); setEmpRows([]); setEmpPreview([]); return; }
      setEmpRows(rows);
      setEmpPreview(rows.slice(0, 5));
    } catch (e) {
      setEmpError("Could not parse file: " + e.message);
      setEmpRows([]);
      setEmpPreview([]);
    }
  };

  const handleAttFile = async (file) => {
    setAttFile(file);
    setAttResult(null);
    setAttError("");
    try {
      const rows = await parseSheet(file);
      if (rows.length === 0) { setAttError("No rows found in the file."); setAttRows([]); setAttPreview([]); return; }
      setAttRows(rows);
      setAttPreview(rows.slice(0, 5));
    } catch (e) {
      setAttError("Could not parse file: " + e.message);
      setAttRows([]);
      setAttPreview([]);
    }
  };

  const importEmployees = async () => {
    if (!empRows.length) return;
    setEmpBusy(true);
    setEmpResult(null);
    try {
      const r = await API.post("/data/import/employees", { rows: empRows });
      setEmpResult(r.data);
    } catch (e) {
      setEmpError("Import failed: " + (e.response?.data?.error || e.message));
    } finally {
      setEmpBusy(false);
    }
  };

  const importAttendance = async () => {
    if (!attRows.length) return;
    setAttBusy(true);
    setAttResult(null);
    try {
      const r = await API.post("/data/import/attendance", { rows: attRows });
      setAttResult(r.data);
    } catch (e) {
      setAttError("Import failed: " + (e.response?.data?.error || e.message));
    } finally {
      setAttBusy(false);
    }
  };

  const exportEmployees = async () => {
    setExporting("employees");
    try {
      const r = await API.get("/data/export/employees");
      await downloadWorkbook("Employees", r.data, `employees-export-${todayKey()}.xlsx`);
    } catch (e) {
      alert("Export failed: " + (e.response?.data?.error || e.message));
    } finally {
      setExporting("");
    }
  };

  const exportAttendance = async () => {
    setExporting("attendance");
    try {
      const params = {};
      if (expFrom) params.start_date = expFrom;
      if (expTo) params.end_date = expTo;
      const r = await API.get("/data/export/attendance", { params });
      await downloadWorkbook("Attendance", r.data, `attendance-export-${todayKey()}.xlsx`);
    } catch (e) {
      alert("Export failed: " + (e.response?.data?.error || e.message));
    } finally {
      setExporting("");
    }
  };

  const ResultBadge = ({ result, type }) => (
    <div className="panel-body" style={{ borderTop: "1px solid #edf0f5", background: "#fbfcfe" }}>
      {type === "employees" ? (
        <span className="badge badge-green"><Icon name="check-circle" size={14} /> {result.inserted} new · {result.updated} updated · {result.errors.length} errors</span>
      ) : (
        <span className="badge badge-green"><Icon name="check-circle" size={14} /> {result.inserted} added · {result.skipped} skipped (already exist) · {result.errors.length} errors</span>
      )}
      {result.errors.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 160, overflow: "auto", fontSize: 12, color: "var(--danger)" }}>
          {result.errors.slice(0, 20).map((er, i) => <div key={i}>• {er.error}</div>)}
        </div>
      )}
    </div>
  );

  const PreviewTable = ({ rows }) => {
    if (!rows.length) return null;
    const cols = Object.keys(rows[0]);
    return (
      <div className="table-wrap" style={{ maxHeight: 220 }}>
        <table>
          <thead><tr>{cols.slice(0, 8).map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.slice(0, 8).map((c) => <td key={c} className="td-muted">{String(r[c] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const FilePicker = ({ onFile, label }) => (
    <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
      <Icon name="upload" size={14} /> {label}
      <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </label>
  );

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Data Import &amp; Export</h1>
          <p>Import employee and attendance data from Excel/CSV without creating duplicates, or export current data.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Import Employees</div>
            <div className="panel-subtitle">Existing employees (matched by card ID / employee number) are updated, not duplicated. Required column: card ID.</div>
          </div>
          <div className="panel-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => downloadWorkbook("Employees", [{ full_name: "", card_id: "", department: "", position: "", email: "", phone: "", status: "active" }], "employees-template.xlsx")}>
              <Icon name="download" size={14} /> Template
            </button>
            <FilePicker onFile={handleEmpFile} label="Choose file" />
            <button className="btn btn-primary btn-sm" disabled={!empRows.length || empBusy} onClick={importEmployees}>
              <Icon name="upload" size={14} /> {empBusy ? "Importing..." : `Import (${empRows.length})`}
            </button>
          </div>
        </div>
        {empFile && <div className="panel-body" style={{ fontSize: 13, color: "var(--text-muted)", borderBottom: "1px solid #edf0f5" }}>{empFile.name} · {empRows.length} rows parsed</div>}
        <PreviewTable rows={empPreview} />
        {empError && <div className="panel-body" style={{ color: "var(--danger)", fontSize: 13 }}>{empError}</div>}
        {empResult && <ResultBadge result={empResult} type="employees" />}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Import Attendance</div>
            <div className="panel-subtitle">Punches already in the system are skipped; only new records are added. Accepted: a Date/Time column, or a Date column with Check In / Check Out. Employees are matched or created by card ID.</div>
          </div>
          <div className="panel-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => downloadWorkbook("Attendance", [{ card_id: "", full_name: "", department: "", date: "2026-02-03", check_in: "08:30", check_out: "17:00" }], "attendance-template.xlsx")}>
              <Icon name="download" size={14} /> Template
            </button>
            <FilePicker onFile={handleAttFile} label="Choose file" />
            <button className="btn btn-primary btn-sm" disabled={!attRows.length || attBusy} onClick={importAttendance}>
              <Icon name="upload" size={14} /> {attBusy ? "Importing..." : `Import (${attRows.length})`}
            </button>
          </div>
        </div>
        {attFile && <div className="panel-body" style={{ fontSize: 13, color: "var(--text-muted)", borderBottom: "1px solid #edf0f5" }}>{attFile.name} · {attRows.length} rows parsed</div>}
        <PreviewTable rows={attPreview} />
        {attError && <div className="panel-body" style={{ color: "var(--danger)", fontSize: 13 }}>{attError}</div>}
        {attResult && <ResultBadge result={attResult} type="attendance" />}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Export</div>
            <div className="panel-subtitle">Download current data as Excel files.</div>
          </div>
          <div className="panel-actions">
            <button className="btn btn-ghost btn-sm" disabled={exporting === "employees"} onClick={exportEmployees}>
              <Icon name="download" size={14} /> {exporting === "employees" ? "Exporting..." : "Export Employees"}
            </button>
            <input type="date" className="form-input form-input-sm" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} aria-label="From date" />
            <input type="date" className="form-input form-input-sm" value={expTo} onChange={(e) => setExpTo(e.target.value)} aria-label="To date" />
            <button className="btn btn-ghost btn-sm" disabled={exporting === "attendance"} onClick={exportAttendance}>
              <Icon name="download" size={14} /> {exporting === "attendance" ? "Exporting..." : "Export Attendance"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
