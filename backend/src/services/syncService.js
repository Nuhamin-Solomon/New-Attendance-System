const pool = require("../config/db");
const { getEmployees, getAttendance } = require("./biotime.service");
const { getAttendanceRules, classifyAttendance } = require("./attendanceRules");

let schemaReady = null;

/**
 * Ensures the employees table has a `source` column so the sync can distinguish
 * BioTime-sourced employees (eligible for auto-deactivation) from employees that
 * were imported or created manually. Idempotent and safe to rerun.
 */
function ensureSyncSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual'`
      );
      await pool.query(
        `UPDATE employees SET source = 'biotime' WHERE source = 'manual' AND card_id IS NOT NULL`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_employees_source_status ON employees(source, status)`
      );
    })().catch((err) => {
      schemaReady = null;
      console.error("Failed to ensure sync schema:", err.message);
    });
  }
  return schemaReady;
}

const syncEmployees = async () => {
  const response = await getEmployees();
  const employees = response.data;
  if (!employees || !Array.isArray(employees) || employees.length === 0) {
    throw new Error("Invalid or empty employee response from BioTime; sync aborted to avoid mass deactivation");
  }

  await ensureSyncSchema();

  let synced = 0;
  const seenCardIds = [];
  for (const emp of employees) {
    const cardId = String(emp.emp_code || "").trim();
    if (!cardId) continue;
    seenCardIds.push(cardId);
    await pool.query(
      `INSERT INTO employees (full_name, card_id, department, source, status)
       VALUES($1, $2, $3, 'biotime', 'active')
       ON CONFLICT(card_id)
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         department = EXCLUDED.department,
         source = 'biotime',
         status = 'active',
         updated_at = NOW()`,
      [`${emp.first_name} ${emp.last_name}`.trim(), cardId, emp.department || "Unknown"]
    );
    synced++;
  }

  // Deactivate employees previously sourced from BioTime that are no longer in
  // the current BioTime roster (resigned / removed / disabled). This keeps the
  // new system consistent with BioTime: a deactivated employee stops appearing
  // as active in every report and filter.
  const uniqueCardIds = [...new Set(seenCardIds)];
  let deactivated = 0;
  if (uniqueCardIds.length > 0) {
    const result = await pool.query(
      `UPDATE employees
       SET status = 'inactive', updated_at = NOW()
       WHERE source = 'biotime'
         AND status = 'active'
         AND card_id IS NOT NULL
         AND NOT (card_id = ANY($1::text[]))`,
      [uniqueCardIds]
    );
    deactivated = result.rowCount || 0;
  }

  console.log(`Employees synced: ${synced}, deactivated against BioTime: ${deactivated}`);
  return { synced, deactivated };
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

const computeAttendanceSummary = async () => {
  const rules = await getAttendanceRules();
  const result = await pool.query(`
    SELECT
      al.employee_id,
      DATE(al.scan_time) AS work_date,
      MIN(al.scan_time) AS first_in,
      MAX(al.scan_time) AS last_out,
      COUNT(al.id) AS scan_count
    FROM attendance_logs al
    GROUP BY al.employee_id, DATE(al.scan_time)
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
    const firstIn = row.first_in;
    const lastOut = row.last_out;
    const classification = classifyAttendance({
      firstIn, lastOut, scanCount: row.scan_count, rules,
    });

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
    `, [row.employee_id, row.work_date, firstIn, lastOut, classification.totalHours,
      classification.status, classification.isLate, classification.lateMinutes]);
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
  let deactivated = 0;
  try {
    const result = await syncEmployees();
    deactivated = (result && result.deactivated) || 0;
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
  console.log(`Full sync complete. Employees deactivated: ${deactivated}`);
  return inserted;
};

module.exports = { syncEmployees, syncAttendance, computeAttendanceSummary, fullSync };
