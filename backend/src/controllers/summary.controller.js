const pool = require("../config/db");
const { buildEmployeeFilter } = require("../utils/departmentFilter");
const { computeTotalHours } = require("../services/attendanceTime");
const { getAttendanceRules, classifyAttendance } = require("../services/attendanceRules");
const { getWorkingDays } = require("../services/workingDays");
const { buildCalendar, getHolidayMap, holidayDisplayLabel } = require("../services/holidays");

function dateKey(value) {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

exports.list = async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;
    const selectedDepts = Array.isArray(req.query.departments)
      ? req.query.departments.map((d) => String(d).trim()).filter(Boolean)
      : String(req.query.departments || "").split(",").map((d) => d.trim()).filter(Boolean);
    const selectedIds = String(req.query.employee_ids || "").split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" });
    const start = start_date || today;
    const end = end_date || today;
    const workingDays = await getWorkingDays();
    const holidayMap = await getHolidayMap(start, end);
    const specialDateKeys = Object.entries(holidayMap).filter(([, h]) => h.type === "special").map(([k]) => k);

    let query = `
      SELECT
        e.id AS employee_id, e.card_id, e.full_name, e.department,
        asci.date, asci.first_in, asci.last_out,
        asci.total_hours, asci.status, asci.is_late, asci.late_minutes
      FROM employees e
      LEFT JOIN attendance_summary asci ON asci.employee_id = e.id AND asci.date BETWEEN $1 AND $2 AND (EXTRACT(DOW FROM asci.date) = ANY($3::int[]) OR asci.date = ANY($4::date[]))
      WHERE e.status = 'active'
    `;
    const params = [start, end, workingDays, specialDateKeys];
    let idx = 5;

    const deptFilter = buildEmployeeFilter(req.user, idx, selectedDepts, selectedIds);
    if (deptFilter.clause) {
      query += deptFilter.clause;
      params.push(...deptFilter.params);
      idx = deptFilter.nextIdx;
    }

    if (status) { query += ` AND asci.status = $${idx++}`; params.push(status); }

    query += " ORDER BY e.full_name, asci.date";
    const result = await pool.query(query, params);

    res.json(result.rows.map((row) => {
      const holiday = holidayMap[dateKey(row.date)] || null;
      return {
        ...row,
        holiday_name: holiday ? holiday.name : "",
        holiday_label: holiday ? holidayDisplayLabel(holiday) : "",
      };
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.myAttendance = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let employeeId = req.user.employee_id;

    if (!employeeId) {
      const fallback = await pool.query(
        `SELECT e.id FROM employees e
         WHERE LOWER(e.full_name) = LOWER($1)
         LIMIT 1`,
        [req.user.full_name || req.user.username]
      );
      if (fallback.rows.length > 0) {
        employeeId = fallback.rows[0].id;
      }
    }

    if (!employeeId) {
      return res.json([]);
    }

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" });
    const start = start_date || new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" });
    const end = end_date || today;
    const workingDays = await getWorkingDays();
    const holidayMap = await getHolidayMap(start, end);
    const specialDateKeys = Object.entries(holidayMap).filter(([, h]) => h.type === "special").map(([k]) => k);

    const result = await pool.query(
      `SELECT * FROM attendance_summary
       WHERE employee_id = $1 AND date BETWEEN $2 AND $3
         AND (EXTRACT(DOW FROM date) = ANY($4::int[]) OR date = ANY($5::date[]))
       ORDER BY date DESC`,
      [employeeId, start, end, workingDays, specialDateKeys]
    );

    res.json(result.rows.map((row) => {
      const holiday = holidayMap[dateKey(row.date)] || null;
      return {
        ...row,
        holiday_name: holiday ? holiday.name : "",
        holiday_label: holiday ? holidayDisplayLabel(holiday) : "",
      };
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.myTeam = async (req, res) => {
  try {
    const manager_id = req.user.employee_id;
    const assignedDepts = req.user.assigned_departments || [];
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" });

    const deptNames = assignedDepts.map((d) => d.department_name);

    let team = { rows: [] };
    if (deptNames.length > 0) {
      team = await pool.query(
        `SELECT e.id, e.card_id, e.full_name, e.department, e.position,
                asci.first_in, asci.last_out, asci.total_hours, asci.status, asci.is_late, asci.late_minutes
         FROM employees e
         LEFT JOIN attendance_summary asci ON asci.employee_id = e.id AND asci.date = $1
         WHERE e.department = ANY($2) AND e.status = 'active' AND e.id != $3
         ORDER BY e.department, e.full_name`,
        [today, deptNames, manager_id || 0]
      );
    }

    let pending = { rows: [] };
    if (deptNames.length > 0) {
      pending = await pool.query(
        `SELECT ar.*, e.full_name AS employee_name, e.department AS employee_department
         FROM attendance_requests ar
         JOIN employees e ON e.id = ar.employee_id
         WHERE ar.status = 'pending'
           AND e.department = ANY($1)
         ORDER BY ar.created_at DESC`,
        [deptNames]
      );
    }

    res.json({ team: team.rows, pending_requests: pending.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.searchEmployees = async (req, res) => {
  try {
    const { search, department } = req.query;
    const assigned = (req.user.assigned_departments || []).map((d) => d.department_name);

    let query = `SELECT id, card_id, full_name, department FROM employees WHERE status = 'active'`;
    const params = [];
    const conditions = [];

    // Admin: all employees. HR / Line Manager: only employees under their assigned departments.
    if (req.user.role !== "admin") {
      if (assigned.length === 0) return res.json([]);
      conditions.push(`department = ANY($${params.length + 1})`);
      params.push(assigned);
    }
    if (department) {
      conditions.push(`department = $${params.length + 1}`);
      params.push(department);
    }
    if (search) {
      conditions.push(`(full_name ILIKE $${params.length + 1} OR card_id ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) query += " AND " + conditions.join(" AND ");
    query += " ORDER BY full_name LIMIT 50";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

async function computeEmployeeSummary(employee, startKey, endKey) {
  const rules = await getAttendanceRules();
  const calendar = await buildCalendar(startKey, endKey, await getWorkingDays());
  const totalWorkingDays = calendar.openDayCount;

  const [logsResult, approvedResult, leaveResult] = await Promise.all([
    pool.query(
      `SELECT DATE(scan_time) AS day, COUNT(*) AS scan_count,
              MIN(scan_time) AS first_in, MAX(scan_time) AS last_out
       FROM attendance_logs
       WHERE employee_id = $1 AND scan_time >= $2::date AND scan_time < ($3::date + INTERVAL '1 day')
       GROUP BY DATE(scan_time)`,
      [employee.id, startKey, endKey]
    ),
    pool.query(
      `SELECT DISTINCT date FROM attendance_requests
       WHERE employee_id = $1
         AND (status = 'approved' OR (manager_status = 'approved' AND hr_status = 'approved'))
         AND date >= $2::date AND date <= $3::date`,
      [employee.id, startKey, endKey]
    ),
    pool.query(
      `SELECT DISTINCT date FROM attendance_summary
       WHERE employee_id = $1 AND status IN ('on_leave', 'leave')
         AND date >= $2::date AND date <= $3::date`,
      [employee.id, startKey, endKey]
    ),
  ]);

  const logMap = {};
  for (const row of logsResult.rows) {
    logMap[dateKey(row.day)] = row;
  }
  const approvedSet = new Set(approvedResult.rows.map((r) => dateKey(r.date)));
  const leaveSet = new Set(leaveResult.rows.map((r) => dateKey(r.date)));

let presentDays = 0, missingCheckout = 0, approvedDays = 0, leaveDays = 0, holidayDays = 0, halfDayDays = 0, lateArrivals = 0, totalHours = 0;
  const days = [];

  for (const day of calendar.days) {
    if (!day.open && !day.holiday) continue;
    const dayKey = day.key;
    const [yd, md, dd] = dayKey.split("-").map(Number);
    const dayName = new Date(Date.UTC(yd, md - 1, dd)).toLocaleDateString("en-US", { weekday: "long" });
    const log = logMap[dayKey];
    const hasScan = Boolean(log && (Number(log.scan_count) > 0 || log.first_in || log.last_out));
    const approvedStatus = !log && (approvedSet.has(dayKey) ? "approved" : leaveSet.has(dayKey) ? "leave" : null);

    let status;
    if (day.holiday && day.holiday.type === "full" && !hasScan && !approvedStatus) {
      status = "holiday";
      holidayDays++;
    } else {
      const classification = classifyAttendance({
        firstIn: log?.first_in,
        lastOut: log?.last_out,
        scanCount: log?.scan_count || 0,
        rules,
        approvedStatus,
        approvedType: "",
        holiday: day.holiday,
      });
      status = classification.status === "present_incomplete" ? "missing_checkout" : classification.status;
      totalHours += classification.totalHours;
      if (status === "present" || status === "half_day") {
        presentDays++;
        if (status === "half_day") halfDayDays++;
      } else if (status === "missing_checkout") missingCheckout++;
      else if (status === "approved" || status === "on_leave") approvedDays++;
      else if (status === "leave") leaveDays++;
      if (classification.isLate) lateArrivals++;
    }
    days.push({
      date: dayKey, day: dayName, status,
      holiday_name: day.holiday ? day.holiday.name : "",
      holiday_type: day.holiday ? holidayDisplayLabel(day.holiday) : "",
    });
  }

  const absentDays = Math.max(totalWorkingDays - presentDays - missingCheckout - approvedDays - leaveDays, 0);

  return {
    employee,
    start_date: startKey,
    end_date: endKey,
    days,
    total_working_days: totalWorkingDays,
    present_days: presentDays,
    absent_days: absentDays,
missing_checkout: missingCheckout,
    approved_days: approvedDays,
    leave_days: leaveDays,
    holiday_days: holidayDays,
    half_day_days: halfDayDays,
    late_arrivals: lateArrivals,
    total_hours: Math.round(totalHours * 100) / 100,
    holidays: calendar.days.filter((d) => d.holiday).map((d) => ({ ...d.holiday, date: d.key })),
  };
}

exports.employeeMonthly = async (req, res) => {
  try {
    const { employee_id, month, start_date, end_date } = req.query;
    if (!employee_id) return res.status(400).json({ error: "employee_id is required" });

    const employeeResult = await pool.query(
      `SELECT id, card_id, full_name, department FROM employees WHERE id = $1`,
      [employee_id]
    );
    if (employeeResult.rows.length === 0) return res.status(404).json({ error: "Employee not found" });
    const employee = employeeResult.rows[0];

    if (req.user.role !== "admin") {
      const assigned = (req.user.assigned_departments || []).map((d) => d.department_name);
      if (assigned.length === 0 || !assigned.includes(employee.department)) {
        return res.status(403).json({ error: "Not authorized to view this employee's attendance" });
      }
    }

    let startKey, endKey, period;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      startKey = `${month}-01`;
      endKey = `${month}-${String(daysInMonth).padStart(2, "0")}`;
      period = month;
    } else if (start_date && end_date && /^\d{4}-\d{2}-\d{2}$/.test(start_date) && /^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      if (start_date > end_date) return res.status(400).json({ error: "start_date must be before end_date" });
      startKey = start_date;
      endKey = end_date;
      period = `${startKey} / ${endKey}`;
    } else {
      return res.status(400).json({ error: "Provide month (YYYY-MM) or start_date & end_date (YYYY-MM-DD)" });
    }

    const summary = await computeEmployeeSummary(employee, startKey, endKey);
    res.json({ ...summary, period });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
