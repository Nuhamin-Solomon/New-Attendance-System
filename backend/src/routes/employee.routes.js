const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");

const EMP_LIST_SELECT = `
  e.id, e.full_name, e.card_id, e.department, e.status, e.email, e.phone,
  e.position, e.manager_id, e.hr_id, e.hire_date,
  mgr.full_name AS manager_name,
  hr_emp.full_name AS hr_name
`;

const EMP_LIST_JOINS = `
  LEFT JOIN employees mgr ON mgr.id = e.manager_id
  LEFT JOIN employees hr_emp ON hr_emp.id = e.hr_id
`;

router.get("/", authenticate, async (req, res) => {
  try {
    const { department, search } = req.query;
    let query = `SELECT ${EMP_LIST_SELECT} FROM employees e ${EMP_LIST_JOINS}`;
    const params = [];
    const conditions = [];

    if (department) { conditions.push(`e.department = $${params.length + 1}`); params.push(department); }
    if (search) { conditions.push(`(e.full_name ILIKE $${params.length + 1} OR e.card_id ILIKE $${params.length + 1})`); params.push(`%${search}%`); }

    if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY e.id";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/departments", authenticate, async (req, res) => {
  try {
    const result = await pool.query("SELECT DISTINCT department FROM employees WHERE department IS NOT NULL ORDER BY department");
    res.json(result.rows.map((r) => r.department));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/managers-for-dept", authenticate, async (req, res) => {
  try {
    const { department } = req.query;
    if (!department) return res.json([]);

    const result = await pool.query(`
      SELECT DISTINCT u.id AS user_id, u.username, u.full_name, e.id AS employee_id, e.full_name AS employee_name
      FROM department_assignments da
      JOIN users u ON u.id = da.user_id
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE da.assignment_type = 'manager'
        AND da.department_id = (SELECT id FROM departments WHERE name = $1)
    `, [department]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/hr-for-dept", authenticate, async (req, res) => {
  try {
    const { department } = req.query;
    if (!department) return res.json([]);

    const result = await pool.query(`
      SELECT DISTINCT u.id AS user_id, u.username, u.full_name, e.id AS employee_id, e.full_name AS employee_name
      FROM department_assignments da
      JOIN users u ON u.id = da.user_id
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE da.assignment_type = 'hr'
        AND da.department_id = (SELECT id FROM departments WHERE name = $1)
    `, [department]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${EMP_LIST_SELECT} FROM employees e ${EMP_LIST_JOINS} WHERE e.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Employee not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { manager_id, hr_id, department, position, email, phone } = req.body;
    const result = await pool.query(
      `UPDATE employees
       SET manager_id = $1, hr_id = $2,
           department = COALESCE($3, department),
           position = COALESCE($4, position),
           email = COALESCE($5, email),
           phone = COALESCE($6, phone),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, full_name, department, manager_id, hr_id, position, email, phone`,
      [manager_id || null, hr_id || null, department, position, email, phone, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Employee not found" });

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "update_employee", "employee", req.params.id, JSON.stringify(req.body)]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
