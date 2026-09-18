const pool = require("../config/db");
const { buildEmployeeFilter, parseList, parseIdList } = require("../utils/departmentFilter");
const { computeTotalHours } = require("../services/attendanceTime");
const { getAttendanceRules, classifyAttendance } = require("../services/attendanceRules");
const { workingDayKeys, getWorkingDays, isWorkingDay } = require("../services/workingDays");
const { buildCalendar, getHoliday, getHolidayMap, holidayDisplayLabel } = require("../services/holidays");

exports.daily = async (req, res) => {
  try {
    const rules = await getAttendanceRules();
    const date = req.query.date || (await pool.query("SELECT (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS d")).rows[0].d;
    const holiday = await getHoliday(date);
    const selectedDepts = parseList(req.query.departments);
    const selectedIds = parseIdList(req.query.employee_ids);

    let whereExtra = "";
    let params = [date];
    let idx = 2;

    const deptFilter = buildEmployeeFilter(req.user, idx, selectedDepts, selectedIds);
    if (deptFilter.clause) {
      whereExtra += deptFilter.clause;
      params.push(...deptFilter.params);
      idx = deptFilter.nextIdx;
    }

    const [dailySummaryResult, dailyLogsResult] = await Promise.all([
      pool.query(
        `SELECT
          e.id AS employee_id, e.card_id, e.full_name, e.department,
          asci.date,
          asci.first_in,
          asci.last_out,
          TO_CHAR(asci.first_in, 'HH24:MI') AS first_in_time,
          TO_CHAR(asci.last_out, 'HH24:MI') AS last_out_time,
          asci.total_hours, asci.status, asci.notes
         FROM employees e
         LEFT JOIN attendance_summary asci ON asci.employee_id = e.id AND asci.date = $1
         WHERE e.status = 'active' ${whereExtra}
         ORDER BY e.department, e.full_name`,
        params
      ),
      pool.query(
        `SELECT
          al.employee_id,
          DATE(al.scan_time) AS day,
          MIN(al.scan_time) AS first_in,
          MAX(al.scan_time) AS last_out,
          TO_CHAR(MIN(al.scan_time), 'HH24:MI') AS first_in_time,
          TO_CHAR(MAX(al.scan_time), 'HH24:MI') AS last_out_time,
          COUNT(al.id) AS scan_count
         FROM attendance_logs al
         JOIN employees e ON e.id = al.employee_id
         WHERE e.status = 'active' AND DATE(al.scan_time) = $1 ${whereExtra}
         GROUP BY al.employee_id, DATE(al.scan_time)
         ORDER BY al.employee_id`,
        params
      ),
    ]);

    const dailyLogMap = new Map();
    for (const row of dailyLogsResult.rows) {
      dailyLogMap.set(`${row.employee_id}:${row.day}`, row);
    }

const result = dailySummaryResult.rows.map((r) => {
      const log = dailyLogMap.get(`${r.employee_id}:${date}`);
      const firstIn = log?.first_in || r.first_in || null;
      const lastOut = log?.last_out || r.last_out || null;
      const classification = classifyAttendance({
        firstIn, lastOut, scanCount: log?.scan_count || (firstIn ? 2 : 0), rules,
        approvedStatus: r.status, approvedType: r.notes || "",
        holiday,
      });
      const checkIn = log?.first_in_time || r.first_in_time || (firstIn ? new Date(firstIn).toTimeString().slice(0, 5) : "");
      const checkOut = log?.last_out_time || r.last_out_time || (lastOut ? new Date(lastOut).toTimeString().slice(0, 5) : "");
      const hasScan = Boolean(firstIn || lastOut);
      const isMissingCheckout = classification.status === "present_incomplete";
      const isApproved = classification.approved;
      const status = classification.status;

      return {
        ...r,
        status,
        check_in: checkIn,
        check_out: checkOut,
        total_hours: classification.totalHours || r.total_hours || 0,
        missing_checkout: isMissingCheckout,
        approved: isApproved,
        approved_type: holiday && status === "holiday" ? holidayDisplayLabel(holiday) : classification.approvedType,
        holiday: status === "holiday",
        holiday_name: holiday ? holiday.name : "",
        holiday_type: holiday ? holidayDisplayLabel(holiday) : "",
      };
    });

    let totalEmps = 0, presentCount = 0, absentCount = 0, missingCheckouts = 0, approvedCount = 0, holidayCount = 0, halfDayCount = 0, totalHours = 0;
    const employees = result.map((r) => {
      totalEmps++;
      const hasScan = r.check_in && r.check_in !== "";
      const isMissingCheckout = r.status === "present_incomplete" || (hasScan && r.missing_checkout);
      const isApproved = r.status === "approved";
      const isHoliday = r.status === "holiday";
      const isHalfDay = r.status === "half_day";

      if (isHoliday) {
        holidayCount++;
      } else if (isApproved) {
        approvedCount++;
      } else if (isMissingCheckout) {
        missingCheckouts++;
      } else if (isHalfDay) {
        halfDayCount++;
        presentCount++;
        totalHours += parseFloat(r.total_hours) || 0;
      } else if (hasScan) {
        presentCount++;
        totalHours += parseFloat(r.total_hours) || 0;
      } else {
        absentCount++;
      }

      return {
        employee_id: r.employee_id, card_id: r.card_id, full_name: r.full_name, department: r.department,
        check_in: r.check_in || "", check_out: r.check_out || "",
        total_hours: r.total_hours || 0,
        status: r.status || "",
        missing_checkout: isMissingCheckout,
        approved: isApproved,
        approved_type: isApproved ? r.notes : "",
        holiday: isHoliday,
        holiday_name: r.holiday_name || "",
        holiday_type: r.holiday_type || "",
      };
    });

    const departments = await pool.query(
      `SELECT DISTINCT department FROM employees WHERE status = 'active' AND department IS NOT NULL ORDER BY department`
    );

    res.json({
      date,
      holiday: holiday ? { name: holiday.name, type: holiday.type, label: holidayDisplayLabel(holiday) } : null,
      summary: {
        total: totalEmps, present: presentCount, absent: absentCount,
        missing_checkouts: missingCheckouts, approved: approvedCount,
        holiday: holidayCount,
        total_hours: Math.round(totalHours * 100) / 100,
      },
      departments_list: departments.rows.map((d) => d.department),
      employees,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.weekly = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const selectedDepts = parseList(req.query.departments);
    const selectedIds = parseIdList(req.query.employee_ids);

    let startDate = start_date;
    let endDate = end_date;

    if (!startDate || !endDate) {
      const today = (await pool.query("SELECT (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS d")).rows[0].d;
      if (!startDate) {
        const d = new Date(today + "T12:00:00Z");
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
        d.setUTCDate(diff);
        startDate = d.toISOString().split("T")[0];
      }
      if (!endDate) {
        const d = new Date(startDate + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() + 6);
        endDate = d.toISOString().split("T")[0];
      }
    }

    const days = [];
    const start = new Date(startDate + "T12:00:00Z");
    const end = new Date(endDate + "T12:00:00Z");
    const workingDays = await getWorkingDays();
    const holidayMap = await getHolidayMap(startDate, endDate);
    const rules = await getAttendanceRules();
    let cur = new Date(start);
    while (cur <= end) {
      const y = cur.getUTCFullYear();
      const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(cur.getUTCDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${dd}`;
      const dayName = cur.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });
      const dayLabel = cur.toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });
      const holiday = holidayMap[dateKey] || null;
      if (holiday || isWorkingDay(cur.getUTCDay(), workingDays)) {
        days.push({ key: dateKey, dayName, dayLabel, holiday: holiday ? { name: holiday.name, type: holiday.type } : null });
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const dayKeys = days.map((d) => d.key);

    let whereExtra = "";
    let params = [dayKeys];
    let idx = 2;

    const deptFilter = buildEmployeeFilter(req.user, idx, selectedDepts, selectedIds);
    if (deptFilter.clause) {
      whereExtra += deptFilter.clause;
      params.push(...deptFilter.params);
      idx = deptFilter.nextIdx;
    }

    const result = await pool.query(
      `SELECT
        e.id AS employee_id, e.card_id, e.full_name, e.department,
        TO_CHAR(wd.day, 'YYYY-MM-DD') AS day_key,
        TO_CHAR(al.first_in, 'HH24:MI') AS check_in,
        TO_CHAR(al.last_out, 'HH24:MI') AS check_out,
        al.scan_count,
        al.first_in AS first_in_raw,
        al.last_out AS last_out_raw,
        asci.status AS summary_status,
        asci.notes AS summary_notes,
        asci.total_hours AS summary_hours
       FROM employees e
       CROSS JOIN (SELECT unnest($1::text[])::date AS day) wd
       LEFT JOIN LATERAL (
         SELECT
           MIN(al2.scan_time) AS first_in,
           MAX(al2.scan_time) AS last_out,
           COUNT(al2.id) AS scan_count
         FROM attendance_logs al2
         WHERE al2.employee_id = e.id AND DATE(al2.scan_time) = wd.day
       ) al ON true
       LEFT JOIN attendance_summary asci ON asci.employee_id = e.id AND asci.date = wd.day
       WHERE e.status = 'active' ${whereExtra}
       ORDER BY e.full_name, wd.day`,
      params
    );

    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.employee_id]) {
        grouped[row.employee_id] = {
          employee_id: row.employee_id,
          card_id: row.card_id,
          full_name: row.full_name,
          department: row.department,
          days: {},
          weekly_hours: 0,
        };
      }
const hasScan = Boolean(row.first_in_raw || row.last_out_raw);
      const isApproved = row.summary_status === "approved" || row.summary_status === "on_leave" || row.summary_status === "leave";
      const holidayInfo = days.find((d) => d.key === row.day_key)?.holiday || null;
      const classification = classifyAttendance({
        firstIn: row.first_in_raw,
        lastOut: row.last_out_raw,
        scanCount: row.scan_count || (hasScan ? 2 : 0),
        rules,
        approvedStatus: isApproved ? row.summary_status : null,
        approvedType: row.summary_notes || "",
        holiday: holidayInfo,
      });
      const status = classification.status;
      const rowHours = Number(row.summary_hours ?? computeTotalHours(row.first_in_raw, row.last_out_raw));
      const isMissingCheckout = status === "present_incomplete";

      if (status === "holiday") {
        grouped[row.employee_id].days[row.day_key] = {
          check_in: "", check_out: "", total_hours: 0,
          missing_checkout: false, absent: false, approved: false, approved_type: "",
          holiday: true,
          holiday_name: holidayInfo.name,
          holiday_label: holidayDisplayLabel(holidayInfo),
        };
      } else {
        grouped[row.employee_id].days[row.day_key] = {
          check_in: row.check_in || "",
          check_out: row.check_out || "",
          total_hours: row.summary_hours ?? computeTotalHours(row.first_in_raw, row.last_out_raw),
          missing_checkout: isMissingCheckout,
          half_day: status === "half_day",
          absent: status === "absent",
          approved: isApproved,
          approved_type: isApproved ? (row.summary_notes || row.summary_status.replace(/_/g, " ")) : "",
          holiday: false,
          holiday_name: holidayInfo ? holidayInfo.name : "",
          holiday_label: holidayInfo ? holidayDisplayLabel(holidayInfo) : "",
        };
      }
      if (hasScan && !isMissingCheckout && !isApproved) {
        grouped[row.employee_id].weekly_hours += Number(row.summary_hours ?? computeTotalHours(row.first_in_raw, row.last_out_raw));
      }
    }

    res.json({ start_date: startDate, end_date: endDate, days, employees: Object.values(grouped) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.monthly = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const selectedDepts = parseList(req.query.departments);
    const selectedIds = parseIdList(req.query.employee_ids);

    let startDate = start_date;
    let endDate = end_date;

    if (!startDate || !endDate) {
      const today = (await pool.query("SELECT (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS d")).rows[0].d;
      if (!startDate) {
        const d = new Date(today + "T12:00:00Z");
        d.setUTCDate(1);
        startDate = d.toISOString().split("T")[0];
      }
      if (!endDate) {
        const d = new Date(startDate + "T12:00:00Z");
        d.setUTCMonth(d.getUTCMonth() + 1);
        d.setUTCDate(d.getUTCDate() - 1);
        endDate = d.toISOString().split("T")[0];
      }
    }

    const days = [];
    const start = new Date(startDate + "T12:00:00Z");
    const end = new Date(endDate + "T12:00:00Z");
    const workingDays = await getWorkingDays();
    const holidayMap = await getHolidayMap(startDate, endDate);
    const rules = await getAttendanceRules();
    let cur = new Date(start);
    while (cur <= end) {
      const y = cur.getUTCFullYear();
      const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(cur.getUTCDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${dd}`;
      const dayNum = cur.getUTCDate();
      const dayName = cur.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });
      const monthDay = cur.toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });
      const holiday = holidayMap[dateKey] || null;

      const weekNumber = Math.floor((days.length + new Date(startDate + "T12:00:00Z").getUTCDay()) / 7);

      if (holiday || isWorkingDay(cur.getUTCDay(), workingDays)) {
        days.push({
          key: dateKey, dayNum, dayName, monthDay, weekNumber,
          holiday: holiday ? { name: holiday.name, type: holiday.type } : null,
        });
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const dayKeys = days.map((d) => d.key);

    let whereExtra = "";
    let params = [dayKeys];
    let idx = 2;

    const deptFilter = buildEmployeeFilter(req.user, idx, selectedDepts, selectedIds);
    if (deptFilter.clause) {
      whereExtra += deptFilter.clause;
      params.push(...deptFilter.params);
      idx = deptFilter.nextIdx;
    }

    const result = await pool.query(
      `SELECT
        e.id AS employee_id, e.card_id, e.full_name, e.department,
        TO_CHAR(wd.day, 'YYYY-MM-DD') AS day_key,
        TO_CHAR(al.first_in, 'HH24:MI') AS check_in,
        TO_CHAR(al.last_out, 'HH24:MI') AS check_out,
        al.scan_count,
        al.first_in AS first_in_raw,
        al.last_out AS last_out_raw,
        asci.status AS summary_status,
        asci.notes AS summary_notes,
        asci.total_hours AS summary_hours
       FROM employees e
       CROSS JOIN (SELECT unnest($1::text[])::date AS day) wd
       LEFT JOIN LATERAL (
         SELECT
           MIN(al2.scan_time) AS first_in,
           MAX(al2.scan_time) AS last_out,
           COUNT(al2.id) AS scan_count
         FROM attendance_logs al2
         WHERE al2.employee_id = e.id AND DATE(al2.scan_time) = wd.day
       ) al ON true
       LEFT JOIN attendance_summary asci ON asci.employee_id = e.id AND asci.date = wd.day
       WHERE e.status = 'active' ${whereExtra}
       ORDER BY e.full_name, wd.day`,
      params
    );

    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.employee_id]) {
        grouped[row.employee_id] = {
          employee_id: row.employee_id,
          card_id: row.card_id,
          full_name: row.full_name,
          department: row.department,
          days: {},
          total_hours: 0,
        };
      }
const hasScan = Boolean(row.first_in_raw || row.last_out_raw);
      const isApproved = row.summary_status === "approved" || row.summary_status === "on_leave" || row.summary_status === "leave";
      const holidayInfo = days.find((d) => d.key === row.day_key)?.holiday || null;
      const classification = classifyAttendance({
        firstIn: row.first_in_raw,
        lastOut: row.last_out_raw,
        scanCount: row.scan_count || (hasScan ? 2 : 0),
        rules,
        approvedStatus: isApproved ? row.summary_status : null,
        approvedType: row.summary_notes || "",
        holiday: holidayInfo,
      });
      const status = classification.status;
      const rowHours = Number(row.summary_hours ?? computeTotalHours(row.first_in_raw, row.last_out_raw));
      const isMissingCheckout = status === "present_incomplete";

      if (status === "holiday") {
        grouped[row.employee_id].days[row.day_key] = {
          check_in: "", check_out: "", total_hours: 0,
          missing_checkout: false, absent: false, approved: false, approved_type: "",
          holiday: true,
          holiday_name: holidayInfo.name,
          holiday_label: holidayDisplayLabel(holidayInfo),
        };
      } else {
        grouped[row.employee_id].days[row.day_key] = {
          check_in: row.check_in || "",
          check_out: row.check_out || "",
          total_hours: row.summary_hours ?? computeTotalHours(row.first_in_raw, row.last_out_raw),
          missing_checkout: isMissingCheckout,
          half_day: status === "half_day",
          absent: status === "absent",
          approved: isApproved,
          approved_type: isApproved ? (row.summary_notes || row.summary_status.replace(/_/g, " ")) : "",
          holiday: false,
          holiday_name: holidayInfo ? holidayInfo.name : "",
          holiday_label: holidayInfo ? holidayDisplayLabel(holidayInfo) : "",
        };
      }
      if (hasScan && !isMissingCheckout && !isApproved) {
        grouped[row.employee_id].total_hours += Number(row.summary_hours ?? computeTotalHours(row.first_in_raw, row.last_out_raw));
      }
    }

    const weekGroups = {};
    for (const day of days) {
      if (!weekGroups[day.weekNumber]) weekGroups[day.weekNumber] = [];
      weekGroups[day.weekNumber].push(day);
    }

    res.json({
      start_date: startDate, end_date: endDate,
      days, weekGroups: Object.entries(weekGroups).map(([weekNum, weekDays]) => ({
        week: parseInt(weekNum) + 1,
        start: weekDays[0].key,
        end: weekDays[weekDays.length - 1].key,
        dayCount: weekDays.length,
      })),
      employees: Object.values(grouped),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

function dateKeyUTC(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dateKey(value) {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

async function getAttendanceSettings() {
  const res = await pool.query(
    `SELECT key, value FROM settings WHERE key = ANY($1)`,
    [["working_hours_start", "working_hours_end", "overtime_threshold_hours", "late_threshold_minutes", "standard_working_hours", "working_days"]]
  );
  const map = {};
  for (const r of res.rows) map[r.key] = r.value;
  const toMinutes = (t) => {
    const [h, m] = String(t || "00:00").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  return {
    startMinutes: toMinutes(map.working_hours_start || "08:00"),
    endMinutes: toMinutes(map.working_hours_end || "17:00"),
    lateThresholdMin: parseInt(map.late_threshold_minutes || "15", 10),
    overtimeThreshold: parseFloat(map.overtime_threshold_hours || "8"),
    working_hours_start: map.working_hours_start || "08:00",
    working_hours_end: map.working_hours_end || "17:00",
    late_threshold_minutes: map.late_threshold_minutes || "15",
    overtime_threshold_hours: map.overtime_threshold_hours || "8",
    standard_working_hours: map.standard_working_hours || "8",
    working_days: map.working_days || "1,2,3,4,5",
  };
}

const hhmm = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

function aggregateAttendance(employeeId, logMap, approvedSet, leaveSet, calendar, settings, rules) {
  const { startMinutes, endMinutes, lateThresholdMin, overtimeThreshold } = settings;
  const lateAfter = hhmm(startMinutes + lateThresholdMin);
  const endTime = hhmm(endMinutes);

  let presentDays = 0, missingCheckout = 0, approvedDays = 0, leaveDays = 0, holidayDays = 0, halfDayDays = 0;
  let totalHours = 0, overtimeHours = 0, lateArrivals = 0, earlyDepartures = 0;
  const days = [];

  for (const day of calendar.days) {
    if (!day.open && !day.holiday) continue;
    const dayKey = day.key;
    const [yd, md, dd] = dayKey.split("-").map(Number);
    const dayName = new Date(Date.UTC(yd, md - 1, dd)).toLocaleDateString("en-US", { weekday: "long" });
    const log = logMap[dayKey];
    const hasScan = Boolean(log && (Number(log.scan_count) > 0 || log.first_in || log.last_out));
    let status, checkIn = "", checkOut = "", hours = 0, overtime = 0, isLate = false, early = false;
    const dayHoliday = day.holiday || null;

    if (log) {
      const classification = classifyAttendance({
        firstIn: log.first_in,
        lastOut: log.last_out,
        scanCount: log.scan_count,
        rules,
        holiday: dayHoliday,
      });
      hours = computeTotalHours(log.first_in, log.last_out);
      totalHours += hours;
      const incomplete = classification.status === "present_incomplete";
      if (incomplete) {
        missingCheckout++;
        status = "missing_checkout";
      } else if (classification.status === "half_day") {
        halfDayDays++;
        presentDays++;
        status = "half_day";
      } else {
        presentDays++;
        status = "present";
        if (log.first_in_time && log.first_in_time > lateAfter) {
          lateArrivals++;
          isLate = true;
        }
        if (log.last_out_time && log.last_out_time < endTime) {
          earlyDepartures++;
          early = true;
        }
        if (hours > overtimeThreshold) {
          overtime = Math.round((hours - overtimeThreshold) * 100) / 100;
          overtimeHours += overtime;
        }
      }
      checkIn = log.first_in_time || "";
      checkOut = log.last_out_time || "";
    } else if (approvedSet.has(dayKey)) {
      approvedDays++;
      status = "approved";
    } else if (leaveSet.has(dayKey)) {
      leaveDays++;
      status = "leave";
    } else if (dayHoliday && dayHoliday.type === "full") {
      holidayDays++;
      status = "holiday";
    } else {
      status = "absent";
    }

    days.push({
      date: dayKey, day: dayName, check_in: checkIn, check_out: checkOut,
      total_hours: hours, overtime, status, is_late: isLate, early_departure: early,
      holiday_name: dayHoliday ? dayHoliday.name : "",
      holiday_type: dayHoliday ? holidayDisplayLabel(dayHoliday) : "",
    });
  }

  const absentDays = Math.max(calendar.openDayCount - presentDays - missingCheckout - approvedDays - leaveDays, 0);

  return {
    total_hours: Math.round(totalHours * 100) / 100,
    overtime_hours: Math.round(overtimeHours * 100) / 100,
    present_days: presentDays,
    late_arrivals: lateArrivals,
    early_departures: earlyDepartures,
    missing_checkouts: missingCheckout,
    absent_days: absentDays,
    approved_days: approvedDays,
    leave_days: leaveDays,
    holiday_days: holidayDays,
    half_day_days: halfDayDays,
    days,
  };
}

function applyStatusFilter(employees, status) {
  if (!status || status === "all") return employees;
  switch (status) {
    case "late": return employees.filter((e) => e.late_arrivals > 0);
    case "early_departure": return employees.filter((e) => e.early_departures > 0);
    case "absent": return employees.filter((e) => e.absent_days > 0);
    case "missing_checkout": return employees.filter((e) => e.missing_checkouts > 0);
    case "approved": return employees.filter((e) => e.approved_days > 0);
    case "leave": return employees.filter((e) => e.leave_days > 0);
    case "holiday": return employees.filter((e) => e.holiday_days > 0);
    case "present": return employees.filter((e) => e.present_days > 0 && e.absent_days === 0);
    default: return employees;
  }
}

exports.summaryMonthly = async (req, res) => {
  try {
    const { start_date, end_date, search, status } = req.query;
    const selectedDepts = parseList(req.query.departments);
    const selectedIds = parseIdList(req.query.employee_ids);

    let startDate = start_date;
    let endDate = end_date;
    if (!startDate || !endDate) {
      const today = (await pool.query("SELECT (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS d")).rows[0].d;
      if (!startDate) {
        const d = new Date(today + "T12:00:00Z");
        d.setUTCDate(1);
        startDate = d.toISOString().split("T")[0];
      }
      if (!endDate) {
        const d = new Date(startDate + "T12:00:00Z");
        d.setUTCMonth(d.getUTCMonth() + 1);
        d.setUTCDate(d.getUTCDate() - 1);
        endDate = d.toISOString().split("T")[0];
      }
    }
    const calendar = await buildCalendar(startDate, endDate, await getWorkingDays());

    let whereExtra = "";
    const params = [];
    let idx = 1;

    const deptFilter = buildEmployeeFilter(req.user, idx, selectedDepts, selectedIds);
    if (deptFilter.clause) {
      whereExtra += deptFilter.clause;
      params.push(...deptFilter.params);
      idx = deptFilter.nextIdx;
    }

    if (search) {
      whereExtra += ` AND (e.full_name ILIKE $${idx} OR e.card_id ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const employeesResult = await pool.query(
      `SELECT e.id AS employee_id, e.card_id, e.full_name, e.department
       FROM employees e
       WHERE e.status = 'active' ${whereExtra}
       ORDER BY e.full_name`,
      params
    );
    const employees = employeesResult.rows;
    const settings = await getAttendanceSettings();

    if (employees.length === 0) {
      return res.json({
        start_date: startDate, end_date: endDate,
        working_days: calendar.openDayCount, settings,
        holidays: calendar.days.filter((d) => d.holiday).map((d) => ({ ...d.holiday, date: d.key })),
        employees: [],
      });
    }

    const ids = employees.map((e) => e.employee_id);

    const [logsResult, approvedResult, leaveResult] = await Promise.all([
      pool.query(
        `SELECT al.employee_id, DATE(al.scan_time) AS day, COUNT(al.id) AS scan_count,
                MIN(al.scan_time) AS first_in, MAX(al.scan_time) AS last_out,
                TO_CHAR(MIN(al.scan_time), 'HH24:MI') AS first_in_time,
                TO_CHAR(MAX(al.scan_time), 'HH24:MI') AS last_out_time
         FROM attendance_logs al
         WHERE al.employee_id = ANY($1::int[])
           AND al.scan_time >= $2::date
           AND al.scan_time < ($3::date + INTERVAL '1 day')
         GROUP BY al.employee_id, DATE(al.scan_time)`,
        [ids, startDate, endDate]
      ),
      pool.query(
        `SELECT DISTINCT ar.employee_id, ar.date
         FROM attendance_requests ar
         WHERE ar.employee_id = ANY($1::int[])
           AND (ar.status = 'approved' OR (ar.manager_status = 'approved' AND ar.hr_status = 'approved'))
           AND ar.date >= $2::date AND ar.date <= $3::date`,
        [ids, startDate, endDate]
      ),
      pool.query(
        `SELECT DISTINCT asci.employee_id, asci.date
         FROM attendance_summary asci
         WHERE asci.employee_id = ANY($1::int[])
           AND asci.status IN ('on_leave', 'leave')
           AND asci.date >= $2::date AND asci.date <= $3::date`,
        [ids, startDate, endDate]
      ),
    ]);

    const logMaps = {};
    const approvedSets = {};
    const leaveSets = {};
    employees.forEach((e) => {
      logMaps[e.employee_id] = {};
      approvedSets[e.employee_id] = new Set();
      leaveSets[e.employee_id] = new Set();
    });
    for (const row of logsResult.rows) {
      if (logMaps[row.employee_id]) logMaps[row.employee_id][dateKey(row.day)] = row;
    }
    for (const row of approvedResult.rows) {
      if (approvedSets[row.employee_id]) approvedSets[row.employee_id].add(dateKey(row.date));
    }
    for (const row of leaveResult.rows) {
      if (leaveSets[row.employee_id]) leaveSets[row.employee_id].add(dateKey(row.date));
    }

    let output = employees.map((emp) => {
      const rules = {
        standardHours: parseFloat(settings.standard_working_hours),
        lateAfterMinutes: settings.startMinutes + settings.lateThresholdMin,
      };
      const agg = aggregateAttendance(
        emp.employee_id, logMaps[emp.employee_id], approvedSets[emp.employee_id],
        leaveSets[emp.employee_id], calendar, settings, rules
      );
      const { days, ...metrics } = agg;
      return {
        employee_id: emp.employee_id,
        card_id: emp.card_id,
        full_name: emp.full_name,
        department: emp.department,
        ...metrics,
        days,
      };
    });

    output = applyStatusFilter(output, status);

    res.json({
      start_date: startDate, end_date: endDate,
      working_days: calendar.openDayCount, settings,
      holidays: calendar.days.filter((d) => d.holiday).map((d) => ({ ...d.holiday, date: d.key })),
      employees: output,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.employeeDaily = async (req, res) => {
  try {
    const { employee_id, start_date, end_date, month } = req.query;
    if (!employee_id) return res.status(400).json({ error: "employee_id is required" });

    const employeeResult = await pool.query(
      `SELECT id AS employee_id, card_id, full_name, department FROM employees WHERE id = $1`,
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

    const calendar = await buildCalendar(startKey, endKey, await getWorkingDays());
    const settings = await getAttendanceSettings();

    const [logsResult, approvedResult, leaveResult] = await Promise.all([
      pool.query(
        `SELECT DATE(al.scan_time) AS day, COUNT(al.id) AS scan_count,
                MIN(al.scan_time) AS first_in, MAX(al.scan_time) AS last_out,
                TO_CHAR(MIN(al.scan_time), 'HH24:MI') AS first_in_time,
                TO_CHAR(MAX(al.scan_time), 'HH24:MI') AS last_out_time
         FROM attendance_logs al
         WHERE al.employee_id = $1
           AND al.scan_time >= $2::date
           AND al.scan_time < ($3::date + INTERVAL '1 day')
         GROUP BY DATE(al.scan_time)`,
        [employee_id, startKey, endKey]
      ),
      pool.query(
        `SELECT DISTINCT date FROM attendance_requests
         WHERE employee_id = $1
           AND (status = 'approved' OR (manager_status = 'approved' AND hr_status = 'approved'))
           AND date >= $2::date AND date <= $3::date`,
        [employee_id, startKey, endKey]
      ),
      pool.query(
        `SELECT DISTINCT date FROM attendance_summary
         WHERE employee_id = $1 AND status IN ('on_leave', 'leave')
           AND date >= $2::date AND date <= $3::date`,
        [employee_id, startKey, endKey]
      ),
    ]);

    const logMap = {};
    for (const row of logsResult.rows) logMap[dateKey(row.day)] = row;
    const approvedSet = new Set(approvedResult.rows.map((r) => dateKey(r.date)));
    const leaveSet = new Set(leaveResult.rows.map((r) => dateKey(r.date)));

    const agg = aggregateAttendance(employee_id, logMap, approvedSet, leaveSet, calendar, settings, {
      standardHours: parseFloat(settings.standard_working_hours),
      lateAfterMinutes: settings.startMinutes + settings.lateThresholdMin,
    });
    const { days, ...metrics } = agg;

    res.json({
      employee,
      period,
      start_date: startKey,
      end_date: endKey,
      working_days: calendar.openDayCount,
      settings,
      ...metrics,
      days,
      holidays: calendar.days.filter((d) => d.holiday).map((d) => ({ ...d.holiday, date: d.key })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.department = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const selectedDepts = parseList(req.query.departments);
    const selectedIds = parseIdList(req.query.employee_ids);
    const todayResult = await pool.query("SELECT (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS today");
    const today = todayResult.rows[0].today;
    const start = start_date || today;
    const end = end_date || today;

    if (req.user.role !== "admin" && req.user.assigned_departments && req.user.assigned_departments.length > 0) {
      const assignedNames = req.user.assigned_departments.map((d) => d.department_name);
      const remaining = selectedDepts.filter((d) => assignedNames.includes(d));
      if (remaining.length === 0 && selectedDepts.length > 0) {
        selectedDepts.splice(0, selectedDepts.length);
        selectedDepts.push("__no_access__");
      }
    }

    if (selectedDepts.length === 0 && selectedIds.length === 0) {
      const departments = await pool.query(
        `SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND department != '' ORDER BY department`
      );
      let deptList = departments.rows.map((d) => d.department);
      if (req.user.role !== "admin") {
        const assignedNames = (req.user.assigned_departments || []).map((d) => d.department_name);
        deptList = deptList.filter((d) => assignedNames.includes(d));
      }
      return res.json({ departments: deptList });
    }

    const workingDays = await getWorkingDays();
    const rules = await getAttendanceRules();
    const calendar = await buildCalendar(start, end, workingDays);
    const calHolidayMap = {};
    for (const d of calendar.days) if (d.holiday) calHolidayMap[d.key] = d.holiday;
    const specialDateKeys = calendar.days.filter((d) => d.holiday && d.holiday.type === "special").map((d) => d.key);

    let whereExtra = "";
    const params = [start, end];
    let idx = 3;

    const deptFilter = buildEmployeeFilter(req.user, idx, selectedDepts, selectedIds);
    if (deptFilter.clause) {
      whereExtra += deptFilter.clause;
      params.push(...deptFilter.params);
      idx = deptFilter.nextIdx;
    }

    const result = await pool.query(
      `SELECT
        e.id AS employee_id, e.card_id, e.full_name, e.department,
        TO_CHAR(gs.day, 'YYYY-MM-DD') AS date_key,
        TO_CHAR(al.first_in, 'HH24:MI') AS check_in,
        TO_CHAR(al.last_out, 'HH24:MI') AS check_out,
        al.scan_count,
        al.first_in AS first_in_raw,
        al.last_out AS last_out_raw
       FROM employees e
       CROSS JOIN generate_series($1::date, $2::date, interval '1 day') AS gs(day)
       LEFT JOIN LATERAL (
         SELECT
           MIN(al2.scan_time) AS first_in,
           MAX(al2.scan_time) AS last_out,
           COUNT(al2.id) AS scan_count
         FROM attendance_logs al2
         WHERE al2.employee_id = e.id AND DATE(al2.scan_time) = gs.day
       ) al ON true
       WHERE e.status = 'active' ${whereExtra}
         AND (EXTRACT(DOW FROM gs.day) = ANY($${idx}::int[]) OR gs.day = ANY($${idx + 1}::date[]))
       ORDER BY e.full_name, gs.day`,
      [...params, workingDays, specialDateKeys]
    );

    const empMap = {};
    for (const row of result.rows) {
      if (!empMap[row.employee_id]) {
        empMap[row.employee_id] = {
          employee_id: row.employee_id,
          card_id: row.card_id,
          full_name: row.full_name,
          department: row.department,
          records: [],
          total_hours: 0,
          days_with_scan: 0,
        };
      }
      if (row.date_key) {
        const holidayInfo = calHolidayMap[row.date_key];
        const hasScan = Boolean(row.first_in_raw || row.last_out_raw);
        const classification = classifyAttendance({
          firstIn: row.first_in_raw,
          lastOut: row.last_out_raw,
          scanCount: row.scan_count || (hasScan ? 2 : 0),
          rules,
          holiday: holidayInfo,
        });
        const status = classification.status;
        const isMissingCheckout = status === "present_incomplete";
        const isHoliday = status === "holiday";
        const isHalfDay = status === "half_day";
        empMap[row.employee_id].records.push({
          date: row.date_key,
          check_in: row.check_in || "",
          check_out: row.check_out || "",
          total_hours: computeTotalHours(row.first_in_raw, row.last_out_raw),
          status: isHoliday ? "holiday" : isHalfDay ? "half_day" : hasScan ? (isMissingCheckout ? "present_incomplete" : "present") : "absent",
          missing_checkout: isMissingCheckout,
          absent: status === "absent",
          approved: false,
          approved_type: "",
          holiday: isHoliday,
          holiday_name: holidayInfo ? holidayInfo.name : "",
          holiday_label: holidayInfo ? holidayDisplayLabel(holidayInfo) : "",
        });
        if (hasScan && !isMissingCheckout) {
          empMap[row.employee_id].total_hours += computeTotalHours(row.first_in_raw, row.last_out_raw);
          empMap[row.employee_id].days_with_scan++;
        }
      }
    }

    const employees = Object.values(empMap);
    const totalDays = calendar.openDayCount || 1;
    const totalWithHours = employees.reduce((s, e) => s + e.days_with_scan, 0);
    const attendanceRate = employees.length > 0 ? Math.round((totalWithHours / (employees.length * totalDays)) * 100) : 0;

    res.json({
      departments: selectedDepts, start, end,
      employee_count: employees.length,
      attendance_rate: attendanceRate,
      employees,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.employeeOptions = async (req, res) => {
  try {
    const deptFilter = buildEmployeeFilter(req.user, 1);
    const employeesResult = await pool.query(
      `SELECT e.id AS employee_id, e.card_id, e.full_name, e.department
       FROM employees e
       WHERE e.status = 'active' ${deptFilter.clause}
       ORDER BY e.department, e.full_name`,
      deptFilter.params
    );

    const departmentsResult = await pool.query(
      `SELECT DISTINCT department FROM employees WHERE status = 'active' AND department IS NOT NULL AND department != '' ORDER BY department`
    );
    let departments = departmentsResult.rows.map((d) => d.department);
    if (req.user.role !== "admin") {
      const assignedNames = (req.user.assigned_departments || []).map((d) => d.department_name);
      departments = departments.filter((d) => assignedNames.includes(d));
    }

    res.json({ employees: employeesResult.rows, departments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.dashboardStats = async (req, res) => {
  try {
    const todayResult = await pool.query("SELECT (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS today");
    const today = todayResult.rows[0].today;
    const todayKey = String(today).slice(0, 10);
    const workingDays = await getWorkingDays();
    const todayIsWorkingDay = workingDays.includes(new Date(todayKey + "T12:00:00Z").getUTCDay());

    const isAdmin = req.user.role === "admin";
    const assignedDepts = req.user.assigned_departments || [];
    const hasDeptFilter = !isAdmin && assignedDepts.length > 0;
    const deptNames = assignedDepts.map((d) => d.department_name);

    const attendanceRules = await getAttendanceRules();

    let empScope = "";
    let empParams = [];
    if (hasDeptFilter) {
      empScope = " AND e.department = ANY($1)";
      empParams = [deptNames];
    }

    const empResult = await pool.query(
      `SELECT e.id AS employee_id, e.card_id, e.full_name, e.department
       FROM employees e
       WHERE e.status = 'active'${empScope}
       ORDER BY e.full_name`,
      isAdmin ? [] : empParams
    );
    const employees = empResult.rows;
    const totalEmps = employees.length;

    const windowStart = new Date(Date.now() - 60 * 86400000);
    const windowStartKey = dateKeyUTC(windowStart);
    const calendar = await buildCalendar(windowStartKey, todayKey, workingDays);
    const todayHoliday = calendar.days.find((d) => d.key === todayKey && d.holiday)?.holiday || null;
    const todayIsHoliday = Boolean(todayHoliday && todayHoliday.type === "full");
    const dayKeys = calendar.days
      .filter((d) => d.open || (d.key === todayKey && todayIsHoliday))
      .map((d) => d.key);

    const rollups = {};
    for (const dk of dayKeys) {
      rollups[dk] = { date_key: dk, present: 0, absent: 0, missing_checkout: 0, late: 0, approved: 0, holiday: 0, half_day: 0 };
    }

    const todayRowMap = new Map();
    let todayAttendance = [];

    if (totalEmps > 0 && dayKeys.length > 0) {
      const ids = employees.map((e) => e.employee_id);
      const [logsRes, sumRes] = await Promise.all([
        pool.query(
          `SELECT al.employee_id, DATE(al.scan_time) AS day, COUNT(al.id) AS scan_count,
                  MIN(al.scan_time) AS first_in, MAX(al.scan_time) AS last_out,
                  TO_CHAR(MIN(al.scan_time), 'HH24:MI') AS first_in_time,
                  TO_CHAR(MAX(al.scan_time), 'HH24:MI') AS last_out_time
           FROM attendance_logs al
           WHERE al.employee_id = ANY($1::int[])
             AND DATE(al.scan_time) >= $2::date AND DATE(al.scan_time) <= $3::date
           GROUP BY al.employee_id, DATE(al.scan_time)`,
          [ids, windowStartKey, today]
        ),
        pool.query(
          `SELECT employee_id, date, status, notes, first_in, last_out, total_hours,
                  TO_CHAR(first_in, 'HH24:MI') AS first_in_time,
                  TO_CHAR(last_out, 'HH24:MI') AS last_out_time
           FROM attendance_summary
           WHERE employee_id = ANY($1::int[])
             AND date >= $2::date AND date <= $3::date`,
          [ids, windowStartKey, today]
        )
      ]);

      const logMap = new Map(logsRes.rows.map((r) => [`${r.employee_id}:${dateKey(r.day)}`, r]));
      const summaryMap = new Map(sumRes.rows.map((r) => [`${r.employee_id}:${dateKey(r.date)}`, r]));

for (const emp of employees) {
        let todayComputed = null;
        for (const dk of dayKeys) {
          const s = summaryMap.get(`${emp.employee_id}:${dk}`);
          const log = logMap.get(`${emp.employee_id}:${dk}`);
          const status = s ? s.status : null;
          const firstIn = log ? log.first_in : s ? s.first_in : "";
          const lastOut = log ? log.last_out : s ? s.last_out : "";
          const firstInTime = (log ? log.first_in_time : s ? s.first_in_time : "") || "";
          const lastOutTime = (log ? log.last_out_time : s ? s.last_out_time : "") || "";
          const dkHoliday = calendar.days.find((d) => d.key === dk)?.holiday || null;
          const classification = classifyAttendance({
            firstIn,
            lastOut,
            scanCount: log?.scan_count || (firstIn ? 2 : 0),
            rules: attendanceRules,
            approvedStatus: status,
            approvedType: s?.notes || "",
            holiday: dkHoliday,
          });
          const hasScan = Boolean(firstIn || log?.scan_count);
          const computed = classification.status === "present_incomplete"
            ? "missing_checkout"
            : classification.status === "on_leave" || classification.status === "leave"
              ? "approved"
              : classification.status === "present" && classification.isLate ? "late" : classification.status;

          const rollup = rollups[dk];
          if (computed === "holiday") rollup.holiday++;
          else if (computed === "approved") rollup.approved++;
          else if (computed === "missing_checkout") rollup.missing_checkout++;
          else if (computed === "half_day") { rollup.present++; rollup.half_day++; }
          else if (computed === "late") { rollup.present++; rollup.late++; }
          else if (computed === "present") rollup.present++;
          else rollup.absent++;

          if (dk === todayKey) {
            todayComputed = {
              employee_id: emp.employee_id,
              card_id: emp.card_id,
              full_name: emp.full_name,
              department: emp.department,
              first_in: firstInTime,
              last_out: lastOutTime,
              total_hours: classification.totalHours || s?.total_hours || 0,
              status: computed,
              holiday: computed === "holiday",
              holiday_name: dkHoliday ? dkHoliday.name : "",
              holiday_label: computed === "holiday" && dkHoliday ? holidayDisplayLabel(dkHoliday) : "",
            };
          }
        }
        if (todayComputed) {
          todayRowMap.set(emp.employee_id, todayComputed);
          todayAttendance.push(todayComputed);
        }
      }
    }

const todayOpen = calendar.days.find((d) => d.key === todayKey)?.open || false;
    const todayRollup = rollups[todayKey] || null;

    const deptAgg = {};
    for (const emp of employees) {
      const dept = emp.department || "Unclassified";
      if (!deptAgg[dept]) deptAgg[dept] = { name: dept, total: 0, present: 0, missing: 0, absent: 0, late: 0, approved: 0 };
      const row = todayRowMap.get(emp.employee_id);
      const status = row ? row.status : todayOpen ? "absent" : null;
      if (status === null || status === "holiday") continue;
      deptAgg[dept].total++;
      const d = deptAgg[dept];
      if (status === "present" || status === "late" || status === "half_day") { d.present++; if (status === "late") d.late++; }
      else if (status === "missing_checkout") d.missing++;
      else if (status === "approved") d.approved = (d.approved || 0) + 1;
      else if (status === "absent") d.absent++;
    }

    let recentRequests;
    if (isAdmin) {
      recentRequests = await pool.query(
        `SELECT ar.*, e.full_name AS employee_name
         FROM attendance_requests ar
         JOIN employees e ON e.id = ar.employee_id
         ORDER BY ar.created_at DESC LIMIT 5`
      );
    } else if (hasDeptFilter) {
      recentRequests = await pool.query(
        `SELECT ar.*, e.full_name AS employee_name
         FROM attendance_requests ar
         JOIN employees e ON e.id = ar.employee_id
         WHERE e.department = ANY($1)
         ORDER BY ar.created_at DESC LIMIT 5`,
        [deptNames]
      );
    } else {
      recentRequests = { rows: [] };
    }

res.json({
      total_employees: totalEmps,
      date: todayKey,
      today: {
        present: todayRollup ? todayRollup.present : 0,
        absent: todayRollup ? todayRollup.absent : 0,
        missing_checkout: todayRollup ? todayRollup.missing_checkout : 0,
        late: todayRollup ? todayRollup.late : 0,
        approved: todayRollup ? todayRollup.approved : 0,
        holiday: todayRollup ? todayRollup.holiday : 0,
        half_day: todayRollup ? todayRollup.half_day : 0,
        leave: 0,
        holiday_label: todayHoliday ? holidayDisplayLabel(todayHoliday) : null,
      },
      today_attendance: todayAttendance,
      departments: Object.values(deptAgg)
        .map((d) => ({
          name: d.name,
          total: d.total,
          present: d.present,
          missing: d.missing,
          absent: d.absent,
          late: d.late,
          approved: d.approved || 0,
          rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total),
      trend: dayKeys.map((dk) => rollups[dk]),
      recent_requests: recentRequests.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
