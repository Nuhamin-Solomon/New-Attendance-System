const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");

router.get("/", authenticate, async (req, res) => {
  try {
    const { department, employee_id, start_date, end_date, search } = req.query;
    const page = req.query.page ? parseInt(req.query.page, 10) : null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
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

    // Role-based data scoping:
    // - Admin: all attendance records
    // - HR / Line Manager: attendance of employees under their assigned departments
    // - Employee: only their own attendance
    if (req.user.role !== "admin") {
      if (req.user.role === "employee") {
        if (!req.user.employee_id) return res.json([]);
        conditions.push(`attendance_logs.employee_id = $${params.length + 1}`);
        params.push(req.user.employee_id);
      } else {
        const deptNames = (req.user.assigned_departments || []).map((d) => d.department_name);
        if (deptNames.length === 0) return res.json([]);
        conditions.push(`employees.department = ANY($${params.length + 1})`);
        params.push(deptNames);
      }
    }

    if (department) { conditions.push(`employees.department = $${params.length + 1}`); params.push(department); }
    if (employee_id) { conditions.push(`attendance_logs.employee_id = $${params.length + 1}`); params.push(employee_id); }
    if (start_date) { conditions.push(`attendance_logs.scan_time >= $${params.length + 1}::date`); params.push(start_date); }
    if (end_date) { conditions.push(`attendance_logs.scan_time < ($${params.length + 1}::date + INTERVAL '1 day')`); params.push(end_date); }
    if (search) {
      conditions.push(
        `(employees.full_name ILIKE $${params.length + 1} OR employees.card_id ILIKE $${params.length + 1} ` +
        `OR COALESCE(employees.department, '') ILIKE $${params.length + 1} ` +
        `OR COALESCE(attendance_logs.source, '') ILIKE $${params.length + 1})`
      );
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY attendance_logs.scan_time DESC";

    if (page && page > 0 && limit && limit > 0) {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM attendance_logs JOIN employees ON employees.id = attendance_logs.employee_id${conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : ""}`, params);
      const total = countRes.rows[0].total;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * limit;
      const dataRes = await pool.query(
        `${query} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );
      return res.json({ data: dataRes.rows, total, page: safePage, limit, totalPages });
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
