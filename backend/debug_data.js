require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function check() {
  try {
    const logs = await pool.query(`
      SELECT al.id, al.employee_id, e.full_name, e.card_id, e.department,
             al.scan_time, al.source, al.raw_data
      FROM attendance_logs al
      JOIN employees e ON e.id = al.employee_id
      ORDER BY e.full_name, al.scan_time
      LIMIT 30
    `);
    console.log("Sample attendance_logs (first 30):");
    for (const r of logs.rows) {
      console.log(`  ${r.full_name} | ${r.scan_time} | ${r.source} | raw: ${JSON.stringify(r.raw_data).slice(0, 80)}`);
    }

    const empLogs = await pool.query(`
      SELECT employee_id, e.full_name, COUNT(*) as scans,
             MIN(scan_time) as first_scan, MAX(scan_time) as last_scan
      FROM attendance_logs al
      JOIN employees e ON e.id = al.employee_id
      GROUP BY employee_id, e.full_name
      HAVING COUNT(*) >= 2
      ORDER BY e.full_name
      LIMIT 20
    `);
    console.log("\nEmployees with 2+ scans:");
    for (const r of empLogs.rows) {
      console.log(`  ${r.full_name}: ${r.scans} scans, first: ${r.first_scan}, last: ${r.last_scan}`);
    }

    const dates = await pool.query(`
      SELECT DISTINCT DATE(scan_time) as d, COUNT(*) as cnt
      FROM attendance_logs
      GROUP BY DATE(scan_time)
      ORDER BY d DESC
      LIMIT 10
    `);
    console.log("\nDates with data:");
    for (const r of dates.rows) {
      console.log(`  ${r.d}: ${r.cnt} records`);
    }

    const summaryCount = await pool.query("SELECT COUNT(*) FROM attendance_summary");
    console.log("\nAttendance summary rows:", summaryCount.rows[0].count);

    const sessionCount = await pool.query("SELECT COUNT(*) FROM attendance_sessions");
    console.log("Attendance session rows:", sessionCount.rows[0].count);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    pool.end();
  }
}
check();
