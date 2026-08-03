const pool = require("../config/db");
const { getDepartmentFilter } = require("../utils/departmentFilter");
const { computeAttendanceSummary } = require("../services/syncService");

const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "");

function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) out[normKey(k)] = v;
  return out;
}

function firstMatch(row, aliases) {
  for (const a of aliases) {
    if (row[a] !== undefined && row[a] !== null) {
      const s = String(row[a]).trim();
      if (s) return s;
    }
  }
  return "";
}

const CARD_ALIASES = [
  "cardid", "cardno", "cardnumber", "empno", "employeenumber", "employeeno",
  "empcode", "employeeid", "badge", "badgenumber", "employeecode", "empcode",
];
const NAME_ALIASES = ["fullname", "name", "employeename", "employeenames"];
const DEPT_ALIASES = ["department", "dept", "deptname", "departmentname"];
const POSITION_ALIASES = ["position", "jobtitle", "title", "role"];
const EMAIL_ALIASES = ["email", "emailaddress", "mail"];
const PHONE_ALIASES = ["phone", "phonenumber", "mobile", "contact", "telephone"];
const STATUS_ALIASES = ["status", "employeestatus"];

function pad2(n) { return String(n).padStart(2, "0"); }

function normalizeDateTime(v) {
  if (v === undefined || v === null) return "";
  const s = String(v).trim();
  if (!s) return "";
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (iso) {
    return `${iso[1]}-${pad2(iso[2])}-${pad2(iso[3])} ${pad2(iso[4])}:${iso[5]}:${pad2(iso[6] || "00")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }
  return "";
}

function normalizeTime(v) {
  if (v === undefined || v === null) return "";
  const s = String(v).trim();
  if (!s) return "";
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(s);
  if (m) {
    let h = parseInt(m[1], 10);
    if (m[4] && /pm/i.test(m[4]) && h < 12) h += 12;
    if (m[4] && /am/i.test(m[4]) && h === 12) h = 0;
    return `${pad2(h)}:${m[2]}:${pad2(m[3] || "00")}`;
  }
  return "";
}

function deriveScanTimes(row) {
  const times = [];
  const dt = firstMatch(row, [
    "scantime", "datetime", "timestamp", "checktime", "punchtime",
    "recordtime", "punch", "punchdatetime", "attdatetime", "time",
  ]);
  if (dt) {
    const iso = normalizeDateTime(dt);
    if (iso) times.push(iso);
  }
  const dateVal = firstMatch(row, ["date", "attendancedate", "workdate", "attdate"]);
  if (dateVal) {
    const day = normalizeDateTime(dateVal).slice(0, 10);
    if (day) {
      const ci = firstMatch(row, ["checkin", "intime", "checkintime", "in"]);
      const co = firstMatch(row, ["checkout", "outtime", "checkouttime", "out"]);
      if (ci) { const t2 = normalizeTime(ci); if (t2) times.push(`${day} ${t2}`); }
      if (co) { const t2 = normalizeTime(co); if (t2) times.push(`${day} ${t2}`); }
      if (!ci && !co) { const t = firstMatch(row, ["clocktime", "time"]); if (t) { const t2 = normalizeTime(t); if (t2) times.push(`${day} ${t2}`); } }
    }
  }
  return [...new Set(times)];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

exports.importEmployees = async (req, res) => {
  try {
    const rows = req.body.rows;
    if (!Array.isArray(rows)) return res.status(400).json({ error: "rows array is required" });
    if (rows.length === 0) return res.json({ inserted: 0, updated: 0, errors: [] });

    let inserted = 0, updated = 0;
    const errors = [];

    for (const batch of chunk(rows, 500)) {
      const params = [];
      const placeholders = [];
      let idx = 1;
      for (const raw of batch) {
        const row = normalizeRow(raw);
        const card_id = firstMatch(row, CARD_ALIASES);
        if (!card_id) { errors.push({ row: raw, error: "Missing employee number / card ID" }); continue; }
        const full_name = firstMatch(row, NAME_ALIASES) || card_id;
        const department = firstMatch(row, DEPT_ALIASES) || null;
        const position = firstMatch(row, POSITION_ALIASES) || null;
        const email = firstMatch(row, EMAIL_ALIASES) || null;
        const phone = firstMatch(row, PHONE_ALIASES) || null;
        const status = /inactive/i.test(firstMatch(row, STATUS_ALIASES)) ? "inactive" : "active";
        params.push(full_name, card_id, department, position, email, phone, status);
        placeholders.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`);
      }
      if (placeholders.length === 0) continue;
      const result = await pool.query(
        `INSERT INTO employees (full_name, card_id, department, position, email, phone, status)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (card_id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           department = EXCLUDED.department,
           position = COALESCE(EXCLUDED.position, employees.position),
           email = COALESCE(EXCLUDED.email, employees.email),
           phone = COALESCE(EXCLUDED.phone, employees.phone),
           status = EXCLUDED.status,
           updated_at = NOW()
         RETURNING (xmax = 0) AS inserted`,
        params
      );
      for (const r of result.rows) { if (r.inserted) inserted++; else updated++; }
    }

    res.json({ inserted, updated, errors });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.importAttendance = async (req, res) => {
  try {
    const rows = req.body.rows;
    if (!Array.isArray(rows)) return res.status(400).json({ error: "rows array is required" });
    if (rows.length === 0) return res.json({ inserted: 0, skipped: 0, errors: [] });

    const employeeCache = {};
    const logs = [];
    const errors = [];

    const resolveEmployee = async (row) => {
      const card_id = firstMatch(row, CARD_ALIASES);
      if (!card_id) return null;
      if (employeeCache[card_id]) return employeeCache[card_id];
      const full_name = firstMatch(row, NAME_ALIASES) || card_id;
      const department = firstMatch(row, DEPT_ALIASES) || null;
      const result = await pool.query(
        `INSERT INTO employees (full_name, card_id, department)
         VALUES ($1, $2, $3)
         ON CONFLICT (card_id) DO UPDATE SET
           full_name = COALESCE(NULLIF(EXCLUDED.full_name, employees.full_name), employees.full_name),
           department = COALESCE(NULLIF(EXCLUDED.department, ''), employees.department)
         RETURNING id`,
        [full_name, card_id, department]
      );
      employeeCache[card_id] = result.rows[0].id;
      return employeeCache[card_id];
    };

    for (const raw of rows) {
      const row = normalizeRow(raw);
      const card_id = firstMatch(row, CARD_ALIASES);
      if (!card_id) { errors.push({ row: raw, error: "Missing employee number / card ID" }); continue; }
      const times = deriveScanTimes(row);
      if (times.length === 0) { errors.push({ row: raw, error: "No valid date/time found (use a DateTime column or Date + Check In/Check Out)" }); continue; }
      const employee_id = await resolveEmployee(row);
      if (employee_id) for (const t of times) logs.push([employee_id, t]);
    }

    let inserted = 0;
    for (const batch of chunk(logs, 500)) {
      const params = [];
      const placeholders = [];
      let idx = 1;
      for (const [employee_id, scan_time] of batch) {
        params.push(employee_id, scan_time, "import");
        placeholders.push(`($${idx++},$${idx++},$${idx++})`);
      }
      const result = await pool.query(
        `INSERT INTO attendance_logs (employee_id, scan_time, source)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (employee_id, scan_time) DO NOTHING`,
        params
      );
      inserted += result.rowCount;
    }

    let summaryComputed = 0;
    try {
      summaryComputed = await computeAttendanceSummary();
    } catch (e) {
      // summary will be refreshed on the next auto-sync
    }

    res.json({ inserted, skipped: logs.length - inserted, errors, summary_computed: summaryComputed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.exportEmployees = async (req, res) => {
  try {
    let sql = `SELECT e.full_name, e.card_id, e.department, e.position, e.email, e.phone, e.status
               FROM employees e WHERE 1 = 1`;
    const params = [];
    const deptFilter = getDepartmentFilter(req.user, 1);
    if (deptFilter.clause) {
      sql += deptFilter.clause;
      params.push(deptFilter.value);
    }
    sql += " ORDER BY e.full_name";
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.exportAttendance = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let sql = `SELECT e.full_name, e.card_id, e.department, al.scan_time, al.source
               FROM attendance_logs al
               JOIN employees e ON e.id = al.employee_id
               WHERE 1 = 1`;
    const params = [];
    let idx = 1;
    if (start_date && end_date) {
      sql += ` AND al.scan_time >= $${idx++}::date AND al.scan_time < ($${idx++}::date + INTERVAL '1 day')`;
      params.push(start_date, end_date);
    }
    const deptFilter = getDepartmentFilter(req.user, idx);
    if (deptFilter.clause) {
      sql += deptFilter.clause;
      params.push(deptFilter.value);
    }
    sql += " ORDER BY al.scan_time DESC";
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
