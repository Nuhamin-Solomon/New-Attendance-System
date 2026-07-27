const pool = require("../config/db");
const { getEmployees, getAttendance } = require("./biotime.service");

const syncEmployees = async () => {
  const response = await getEmployees();
  const employees = response.data;
  if (!employees || !Array.isArray(employees)) {
    throw new Error("Invalid employee response from BioTime");
  }

  let synced = 0;
  for (const emp of employees) {
    await pool.query(
      `INSERT INTO employees (full_name, card_id, department)
       VALUES($1, $2, $3)
       ON CONFLICT(card_id)
       DO UPDATE SET full_name = EXCLUDED.full_name, department = EXCLUDED.department`,
      [`${emp.first_name} ${emp.last_name}`.trim(), emp.emp_code, emp.department || "Unknown"]
    );
    synced++;
  }
  console.log(`Employees synced: ${synced}`);
  return synced;
};

const syncAttendance = async () => {
  const employees = await pool.query(`SELECT id, card_id FROM employees WHERE card_id IS NOT NULL`);
  let inserted = 0;

  for (const emp of employees.rows) {
    let response;
    try {
      response = await getAttendance(emp.card_id);
    } catch (err) {
      continue;
    }

    const records = (response && response.data) ? response.data : [];
    for (const record of records) {
      if (!record.punch_time) continue;

      const exists = await pool.query(
        `SELECT id FROM attendance_logs WHERE employee_id=$1 AND scan_time=$2`,
        [emp.id, record.punch_time]
      );
      if (exists.rows.length > 0) continue;

      await pool.query(
        `INSERT INTO attendance_logs (employee_id, scan_time, source, raw_data)
         VALUES($1, $2, $3, $4)`,
        [emp.id, record.punch_time, "biotime", JSON.stringify(record)]
      );
      inserted++;
    }
  }

  console.log(`Attendance logs inserted: ${inserted}`);
  return inserted;
};

const REQUIRED_WORKING_HOURS = 9;

const computeAttendanceSummary = async () => {
  const result = await pool.query(`
    SELECT
      al.employee_id,
      DATE(al.scan_time AT TIME ZONE 'Africa/Addis_Ababa') AS work_date,
      MIN(al.scan_time) AS first_in,
      MAX(al.scan_time) AS last_out,
      COUNT(al.id) AS scan_count
    FROM attendance_logs al
    GROUP BY al.employee_id, DATE(al.scan_time AT TIME ZONE 'Africa/Addis_Ababa')
  `);

  const approvedRequestsResult = await pool.query(`
    SELECT employee_id, date, request_type
    FROM attendance_requests
    WHERE status = 'approved' OR (manager_status = 'approved' AND hr_status = 'approved')
  `);
  const approvedMap = {};
  for (const row of approvedRequestsResult.rows) {
    const dateKey = typeof row.date === "string" ? row.date : new Date(row.date).toISOString().split("T")[0];
    const key = `${row.employee_id}_${dateKey}`;
    approvedMap[key] = row.request_type;
  }

  let computed = 0;
  for (const row of result.rows) {
    const firstIn = new Date(row.first_in);
    const lastOut = new Date(row.last_out);
    const diffMs = lastOut - firstIn;
    const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

    const hasMultipleScans = parseInt(row.scan_count) > 1;
    const missingCheckout = !hasMultipleScans;

    let status;
    if (missingCheckout) {
      status = "present_incomplete";
    } else if (totalHours >= REQUIRED_WORKING_HOURS) {
      status = "present";
    } else if (totalHours >= 1) {
      status = "present_partial";
    } else {
      status = "present_incomplete";
    }

    await pool.query(`
      INSERT INTO attendance_summary (employee_id, date, first_in, last_out, total_hours, status, is_late, late_minutes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (employee_id, date)
      DO UPDATE SET
        first_in = EXCLUDED.first_in,
        last_out = EXCLUDED.last_out,
        total_hours = EXCLUDED.total_hours,
        status = EXCLUDED.status,
        is_late = EXCLUDED.is_late,
        late_minutes = EXCLUDED.late_minutes
    `, [row.employee_id, row.work_date, firstIn, lastOut, totalHours, status, false, 0]);
    computed++;
  }

  const activeEmps = await pool.query(`SELECT id FROM employees WHERE status = 'active'`);
  const summaryDates = await pool.query(`
    SELECT DISTINCT date FROM attendance_summary WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  `);

  for (const d of summaryDates.rows) {
    for (const emp of activeEmps.rows) {
      const existing = await pool.query(
        `SELECT id FROM attendance_summary WHERE employee_id = $1 AND date = $2`,
        [emp.id, d.date]
      );
      if (existing.rows.length === 0) {
        const dateKey = typeof d.date === "string" ? d.date : new Date(d.date).toISOString().split("T")[0];
        const approvedKey = `${emp.id}_${dateKey}`;
        const approvedType = approvedMap[approvedKey];

        if (approvedType) {
          const typeLabels = {
            field_duty: "Field Duty",
            official_travel: "Official Travel",
            training: "Training",
            client_visit: "Client Visit",
            remote_work: "Remote Work",
            overtime: "Overtime",
          };
          await pool.query(
            `INSERT INTO attendance_summary (employee_id, date, status, notes) VALUES ($1, $2, 'approved', $3)`,
            [emp.id, d.date, typeLabels[approvedType] || approvedType]
          );
        } else {
          await pool.query(
            `INSERT INTO attendance_summary (employee_id, date, status) VALUES ($1, $2, 'absent')`,
            [emp.id, d.date]
          );
        }
      }
    }
  }

  console.log(`Attendance summary computed: ${computed} day-employee records`);
  return computed;
};

const fullSync = async () => {
  console.log("Starting full BioTime sync...");
  try {
    await syncEmployees();
  } catch (e) {
    console.error("Employee sync failed:", e.message);
  }
  let inserted = 0;
  try {
    inserted = await syncAttendance();
  } catch (e) {
    console.error("Attendance sync failed:", e.message);
  }
  try {
    await computeAttendanceSummary();
  } catch (e) {
    console.error("Summary computation failed:", e.message);
  }
  console.log("Full sync complete.");
  return inserted;
};

module.exports = { syncEmployees, syncAttendance, computeAttendanceSummary, fullSync };
