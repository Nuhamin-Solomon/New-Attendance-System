const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");

router.get("/", authenticate, async (req, res) => {
  try {
    const { department, employee_id, start_date, end_date } = req.query;
    let query = `
      SELECT
        attendance_logs.id,
        employees.full_name,
        employees.department,
        employees.card_id,
        attendance_logs.scan_time,
        attendance_logs.source
      FROM attendance_logs
      JOIN employees ON employees.id = attendance_logs.employee_id
    `;
    const params = [];
    const conditions = [];

    if (department) { conditions.push(`employees.department = $${params.length + 1}`); params.push(department); }
    if (employee_id) { conditions.push(`attendance_logs.employee_id = $${params.length + 1}`); params.push(employee_id); }
    if (start_date) { conditions.push(`attendance_logs.scan_time >= $${params.length + 1}`); params.push(start_date); }
    if (end_date) { conditions.push(`attendance_logs.scan_time <= $${params.length + 1}`); params.push(end_date); }

    if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY attendance_logs.scan_time DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
