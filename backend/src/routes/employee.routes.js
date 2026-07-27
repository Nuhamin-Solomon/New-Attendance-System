const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");

router.get("/", authenticate, async (req, res) => {
  try {
    const { department, search } = req.query;
    let query = "SELECT id, full_name, card_id, department, status, email, phone, position, manager_id, hire_date FROM employees";
    const params = [];
    const conditions = [];

    if (department) { conditions.push(`department = $${params.length + 1}`); params.push(department); }
    if (search) { conditions.push(`(full_name ILIKE $${params.length + 1} OR card_id ILIKE $${params.length + 1})`); params.push(`%${search}%`); }

    if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY id";

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

router.get("/:id", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM employees WHERE id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Employee not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
