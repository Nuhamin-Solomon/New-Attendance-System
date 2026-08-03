const pool = require("../config/db");
const { getDepartmentFilter } = require("../utils/departmentFilter");
const { computeTotalHours, formatTimeHHMM } = require("../services/attendanceTime");

exports.daily = async (req, res) => {
  try {
    const date = req.query.date || (await pool.query("SELECT (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS d")).rows[0].d;
    const department = req.query.department;

    let whereExtra = "";
    let params = [date];
    let idx = 2;

    const deptFilter = getDepartmentFilter(req.user, idx);
    if (deptFilter.clause) {
      whereExtra += deptFilter.clause;
      params.push(deptFilter.value);
      idx = deptFilter.nextIdx;
    } else if (department) {
      whereExtra += ` AND e.department = $${idx}`;
      params.push(department);
      idx++;
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
         WHERE e.status = 'active' AND DATE(al.scan_time) = $1 ${whereExtra.replace(/AND e\.department = \$\d+/g, "").replace(/AND e\.department = ANY\(\$\d+\)/g, "")}
         GROUP BY al.employee_id, DATE(al.scan_time)
         ORDER BY al.employee_id`,
        [date]
      ),
    ]);

    const dailyLogMap = new Map();
    for (const row of dailyLogsResult.rows) {
      dailyLogMap.set(`${row.employee_id}:${row.day}`, row);
    }

    const result = dailySummaryResult.rows.map((r) => {
      const log = dailyLogMap.get(`${r.employee_id}:${r.date}`);
      const firstIn = log?.first_in || r.first_in || null;
      const lastOut = log?.last_out || r.last_out || null;
      const totalHours = computeTotalHours(firstIn, lastOut);
      const checkIn = log?.first_in_time || r.first_in_time || formatTimeHHMM(firstIn);
      const checkOut = log?.last_out_time || r.last_out_time || formatTimeHHMM(lastOut);
      const hasScan = Boolean(firstIn || lastOut);
      const isMissingCheckout = r.status === "present_incomplete" || (hasScan && (!lastOut || firstIn === lastOut));
      const isApproved = r.status === "approved";

      return {
        ...r,
        check_in: checkIn,
        check_out: checkOut,
        total_hours: totalHours || r.total_hours || 0,
        missing_checkout: isMissingCheckout,
        approved: isApproved,
        approved_type: isApproved ? r.notes : "",
      };
    });

    let totalEmps = 0, presentCount = 0, absentCount = 0, missingCheckouts = 0, approvedCount = 0, totalHours = 0;
    const employees = result.map((r) => {
      totalEmps++;
      const hasScan = r.check_in && r.check_in !== "";
      const isMissingCheckout = r.status === "present_incomplete" || (hasScan && r.missing_checkout);
      const isApproved = r.status === "approved";

      if (isApproved) {
        approvedCount++;
      } else if (isMissingCheckout) {
        missingCheckouts++;
      } else if (hasScan) {
        presentCount++;
        totalHours += parseFloat(r.total_hours) || 0;
      } else if (r.status !== "absent") {
        presentCount++;
      } else {
        absentCount++;
      }

      return {
        employee_id: r.employee_id, card_id: r.card_id, full_name: r.full_name, department: r.department,
        check_in: r.check_in || "", check_out: r.check_out || "",
        total_hours: r.total_hours || 0,
        missing_checkout: isMissingCheckout,
        approved: isApproved,
        approved_type: isApproved ? r.notes : "",
      };
    });

    const departments = await pool.query(
      `SELECT DISTINCT department FROM employees WHERE status = 'active' AND department IS NOT NULL ORDER BY department`
    );

    res.json({
      date,
      summary: {
        total: totalEmps, present: presentCount, absent: absentCount,
        missing_checkouts: missingCheckouts, approved: approvedCount,
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
    const { start_date, end_date, department } = req.query;

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
    let cur = new Date(start);
    while (cur <= end) {
      const y = cur.getUTCFullYear();
      const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(cur.getUTCDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${dd}`;
      const dayName = cur.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });
      const dayLabel = cur.toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });
      days.push({ key: dateKey, dayName, dayLabel });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const dayKeys = days.map((d) => d.key);

    let whereExtra = "";
    let params = [dayKeys];
    let idx = 2;

    const deptFilter = getDepartmentFilter(req.user, idx);
    if (deptFilter.clause) {
      whereExtra += deptFilter.clause;
      params.push(deptFilter.value);
      idx = deptFilter.nextIdx;
    } else if (department) {
      whereExtra += ` AND e.department = $${idx}`;
      params.push(department);
      idx++;
    }

    const result = await pool.query(
      `SELECT
        e.id AS employee_id, e.card_id, e.full_name, e.department,
        TO_CHAR(wd.day, 'YYYY-MM-DD') AS day_key,
        TO_CHAR(al.first_in, 'HH24:MI') AS check_in,
        TO_CHAR(al.last_out, 'HH24:MI') AS check_out,
        al.scan_count,
        al.first_in AS first_in_raw,
        al.last_out AS last_out_raw
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
      const isMissingCheckout = hasScan && (!row.last_out_raw || row.scan_count <= 1);

      grouped[row.employee_id].days[row.day_key] = {
        check_in: row.check_in || "",
        check_out: row.check_out || "",
        total_hours: computeTotalHours(row.first_in_raw, row.last_out_raw),
        missing_checkout: isMissingCheckout,
        approved: false,
        approved_type: "",
      };
      if (hasScan && !isMissingCheckout) {
        grouped[row.employee_id].weekly_hours += computeTotalHours(row.first_in_raw, row.last_out_raw);
      }
    }

    res.json({ start_date: startDate, end_date: endDate, days, employees: Object.values(grouped) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.monthly = async (req, res) => {
  try {
    const { start_date, end_date, department } = req.query;

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
    let cur = new Date(start);
    while (cur <= end) {
      const y = cur.getUTCFullYear();
      const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(cur.getUTCDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${dd}`;
      const dayNum = cur.getUTCDate();
      const dayName = cur.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });
      const monthDay = cur.toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });

      const weekNumber = Math.floor((days.length + new Date(startDate + "T12:00:00Z").getUTCDay()) / 7);

      days.push({ key: dateKey, dayNum, dayName, monthDay, weekNumber });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const dayKeys = days.map((d) => d.key);

    let whereExtra = "";
    let params = [dayKeys];
    let idx = 2;

    const deptFilter = getDepartmentFilter(req.user, idx);
    if (deptFilter.clause) {
      whereExtra += deptFilter.clause;
      params.push(deptFilter.value);
      idx = deptFilter.nextIdx;
    } else if (department) {
      whereExtra += ` AND e.department = $${idx}`;
      params.push(department);
      idx++;
    }

    const result = await pool.query(
      `SELECT
        e.id AS employee_id, e.card_id, e.full_name, e.department,
        TO_CHAR(wd.day, 'YYYY-MM-DD') AS day_key,
        TO_CHAR(al.first_in, 'HH24:MI') AS check_in,
        TO_CHAR(al.last_out, 'HH24:MI') AS check_out,
        al.scan_count,
        al.first_in AS first_in_raw,
        al.last_out AS last_out_raw
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
      const isMissingCheckout = hasScan && (!row.last_out_raw || row.scan_count <= 1);

      grouped[row.employee_id].days[row.day_key] = {
        check_in: row.check_in || "",
        check_out: row.check_out || "",
        total_hours: computeTotalHours(row.first_in_raw, row.last_out_raw),
        missing_checkout: isMissingCheckout,
        approved: false,
        approved_type: "",
      };
      if (hasScan && !isMissingCheckout) {
        grouped[row.employee_id].total_hours += computeTotalHours(row.first_in_raw, row.last_out_raw);
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

exports.department = async (req, res) => {
  try {
    const { department, start_date, end_date } = req.query;
    const todayResult = await pool.query("SELECT (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS today");
    const today = todayResult.rows[0].today;
    const start = start_date || today;
    const end = end_date || today;

    let effectiveDept = department;

    if (req.user.role !== "admin" && req.user.assigned_departments && req.user.assigned_departments.length > 0) {
      const assignedNames = req.user.assigned_departments.map((d) => d.department_name);
      if (!effectiveDept || !assignedNames.includes(effectiveDept)) {
        effectiveDept = assignedNames[0];
      }
    }

    if (!effectiveDept) {
      const departments = await pool.query(
        `SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND department != '' ORDER BY department`
      );
      return res.json({ departments: departments.rows.map((d) => d.department) });
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
       WHERE e.department = $3 AND e.status = 'active'
       ORDER BY e.full_name, gs.day`,
      [start, end, effectiveDept]
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
        const hasScan = Boolean(row.first_in_raw || row.last_out_raw);
        const isMissingCheckout = hasScan && (!row.last_out_raw || row.scan_count <= 1);
        empMap[row.employee_id].records.push({
          date: row.date_key,
          check_in: row.check_in || "",
          check_out: row.check_out || "",
          total_hours: computeTotalHours(row.first_in_raw, row.last_out_raw),
          status: hasScan ? (isMissingCheckout ? "present_incomplete" : "present") : "absent",
          missing_checkout: isMissingCheckout,
          approved: false,
          approved_type: "",
        });
        if (hasScan && !isMissingCheckout) {
          empMap[row.employee_id].total_hours += computeTotalHours(row.first_in_raw, row.last_out_raw);
          empMap[row.employee_id].days_with_scan++;
        }
      }
    }

    const employees = Object.values(empMap);
    const totalDays = employees.length > 0 ? employees[0].records.length || 1 : 1;
    const totalWithHours = employees.reduce((s, e) => s + e.days_with_scan, 0);
    const attendanceRate = employees.length > 0 ? Math.round((totalWithHours / (employees.length * totalDays)) * 100) : 0;

    res.json({
      department: effectiveDept, start, end,
      employee_count: employees.length,
      attendance_rate: attendanceRate,
      employees,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.dashboardStats = async (req, res) => {
  try {
    const todayResult = await pool.query("SELECT (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS today");
    const today = todayResult.rows[0].today;

    const isAdmin = req.user.role === "admin";
    const assignedDepts = req.user.assigned_departments || [];
    const hasDeptFilter = !isAdmin && assignedDepts.length > 0;
    const deptNames = assignedDepts.map((d) => d.department_name);

    let totalEmps;
    if (isAdmin) {
      totalEmps = parseInt((await pool.query(`SELECT COUNT(*) FROM employees WHERE status = 'active'`)).rows[0].count);
    } else if (hasDeptFilter) {
      totalEmps = parseInt((await pool.query(`SELECT COUNT(*) FROM employees WHERE status = 'active' AND department = ANY($1)`, [deptNames])).rows[0].count);
    } else {
      totalEmps = 0;
    }

    let todaySummary;
    if (isAdmin) {
      todaySummary = await pool.query(`SELECT status, COUNT(*) AS count FROM attendance_summary WHERE date = $1 GROUP BY status`, [today]);
    } else if (hasDeptFilter) {
      todaySummary = await pool.query(
        `SELECT asci.status, COUNT(*) AS count
         FROM attendance_summary asci
         JOIN employees e ON e.id = asci.employee_id
         WHERE asci.date = $1 AND e.department = ANY($2) AND e.status = 'active'
         GROUP BY asci.status`,
        [today, deptNames]
      );
    } else {
      todaySummary = { rows: [] };
    }

    const statusCounts = {};
    for (const row of todaySummary.rows) {
      statusCounts[row.status] = parseInt(row.count);
    }

    const totalAccounted = Object.values(statusCounts).reduce((s, v) => s + v, 0);
    if (totalAccounted < totalEmps) {
      statusCounts.absent = (statusCounts.absent || 0) + (totalEmps - totalAccounted);
    }

    let deptStats;
    if (isAdmin) {
      deptStats = await pool.query(
        `SELECT e.department,
                COUNT(*) AS total,
                SUM(CASE WHEN asci.status NOT IN ('absent', 'approved') THEN 1 ELSE 0 END) AS present
         FROM employees e
         LEFT JOIN attendance_summary asci ON asci.employee_id = e.id AND asci.date = $1
         WHERE e.department IS NOT NULL AND e.status = 'active'
         GROUP BY e.department ORDER BY total DESC`,
        [today]
      );
    } else if (hasDeptFilter) {
      deptStats = await pool.query(
        `SELECT e.department,
                COUNT(*) AS total,
                SUM(CASE WHEN asci.status NOT IN ('absent', 'approved') THEN 1 ELSE 0 END) AS present
         FROM employees e
         LEFT JOIN attendance_summary asci ON asci.employee_id = e.id AND asci.date = $1
         WHERE e.department = ANY($2) AND e.status = 'active'
         GROUP BY e.department ORDER BY total DESC`,
        [today, deptNames]
      );
    } else {
      deptStats = { rows: [] };
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    let trend;
    if (isAdmin) {
      trend = await pool.query(
        `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date_key, status, COUNT(*) AS count
         FROM attendance_summary WHERE date >= $1 GROUP BY date, status ORDER BY date`,
        [thirtyDaysAgo]
      );
    } else if (hasDeptFilter) {
      trend = await pool.query(
        `SELECT TO_CHAR(t.date, 'YYYY-MM-DD') AS date_key, t.status, COUNT(*) AS count
         FROM attendance_summary t
         JOIN employees e ON e.id = t.employee_id
         WHERE t.date >= $1 AND e.department = ANY($2) AND e.status = 'active'
         GROUP BY t.date, t.status ORDER BY t.date`,
        [thirtyDaysAgo, deptNames]
      );
    } else {
      trend = { rows: [] };
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
      today: {
        present: (statusCounts.present || 0) + (statusCounts.present_partial || 0),
        absent: statusCounts.absent || 0,
        missing_checkout: statusCounts.present_incomplete || 0,
        approved: statusCounts.approved || 0,
        leave: statusCounts.leave || 0,
      },
      departments: deptStats.rows.map((d) => ({
        name: d.department,
        total: parseInt(d.total),
        present: parseInt(d.present),
        rate: parseInt(d.total) > 0 ? Math.round((parseInt(d.present) / parseInt(d.total)) * 100) : 0,
      })),
      trend: trend.rows,
      recent_requests: recentRequests.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
