/*
 * Opt-in non-production QA account bootstrap.
 * It only creates/updates users and never creates, updates, imports, or syncs
 * attendance data. Every password and employee mapping must be supplied by the
 * operator, preventing universal credentials from entering source control.
 */
require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("../src/config/db");

const roles = ["admin", "hr", "manager", "employee"];

async function run() {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_QA_BOOTSTRAP !== "true") {
    throw new Error("Set ALLOW_QA_BOOTSTRAP=true in a non-production environment to run this script.");
  }
  for (const role of roles) {
    const prefix = `QA_${role.toUpperCase()}`;
    const username = process.env[`${prefix}_USERNAME`];
    const password = process.env[`${prefix}_PASSWORD`];
    const employeeId = process.env[`${prefix}_EMPLOYEE_ID`] || null;
    if (!username || !password) throw new Error(`${prefix}_USERNAME and ${prefix}_PASSWORD are required.`);
    if (role !== "admin" && !employeeId) throw new Error(`${prefix}_EMPLOYEE_ID must reference an existing employee.`);
    if (employeeId) {
      const employee = await pool.query("SELECT id FROM employees WHERE id = $1", [employeeId]);
      if (!employee.rows.length) throw new Error(`${prefix}_EMPLOYEE_ID does not exist.`);
    }
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, employee_id, is_active, must_change_password)
       VALUES ($1, $2, $3, $4, $5, true, false)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
       employee_id = EXCLUDED.employee_id, is_active = true, must_change_password = false, updated_at = NOW()`,
      [username, hash, `QA ${role}`, role, employeeId]
    );
  }
  console.log("QA users created/updated. No attendance records were changed.");
}

run().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
