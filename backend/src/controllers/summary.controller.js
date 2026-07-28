const pool = require("../config/db");
const { getDepartmentFilter } = require("../utils/departmentFilter");

exports.list = async (req, res) => {
  try {
    const { department, start_date, end_date, status } = req.query;
    const today = new Date().toISOString().split("T")[0];
    const start = start_date || today;
    const end = end_date || today;

    let query = `
      SELECT
        e.id AS employee_id, e.full_name, e.department,
        asci.date, asci.first_in, asci.last_out,
        asci.total_hours, asci.status, asci.is_late, asci.late_minutes
      FROM employees e
      LEFT JOIN attendance_summary asci ON asci.employee_id = e.id AND asci.date BETWEEN $1 AND $2
      WHERE e.status = 'active'
    `;
    const params = [start, end];
    let idx = 3;

    const deptFilter = getDepartmentFilter(req.user, idx);
    if (deptFilter.clause) {
      query += deptFilter.clause;
      params.push(deptFilter.value);
      idx = deptFilter.nextIdx;
    } else if (department) {
      query += ` AND e.department = $${idx++}`;
      params.push(department);
    }

    if (status) { query += ` AND asci.status = $${idx++}`; params.push(status); }

    query += " ORDER BY e.full_name, asci.date";
    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.myAttendance = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let employeeId = req.user.employee_id;

    if (!employeeId) {
      const fallback = await pool.query(
        `SELECT e.id FROM employees e
         WHERE LOWER(e.full_name) = LOWER($1)
         LIMIT 1`,
        [req.user.full_name || req.user.username]
      );
      if (fallback.rows.length > 0) {
        employeeId = fallback.rows[0].id;
      }
    }

    if (!employeeId) {
      return res.json([]);
    }

    const today = new Date().toISOString().split("T")[0];
    const start = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const end = end_date || today;

    const result = await pool.query(
      `SELECT * FROM attendance_summary
       WHERE employee_id = $1 AND date BETWEEN $2 AND $3
       ORDER BY date DESC`,
      [employeeId, start, end]
    );

    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.myTeam = async (req, res) => {
  try {
    const manager_id = req.user.employee_id;
    const assignedDepts = req.user.assigned_departments || [];
    const today = new Date().toISOString().split("T")[0];

    const deptNames = assignedDepts.map((d) => d.department_name);

    let team = { rows: [] };
    if (deptNames.length > 0) {
      team = await pool.query(
        `SELECT e.id, e.full_name, e.department, e.position,
                asci.first_in, asci.last_out, asci.total_hours, asci.status, asci.is_late, asci.late_minutes
         FROM employees e
         LEFT JOIN attendance_summary asci ON asci.employee_id = e.id AND asci.date = $1
         WHERE e.department = ANY($2) AND e.status = 'active' AND e.id != $3
         ORDER BY e.department, e.full_name`,
        [today, deptNames, manager_id || 0]
      );
    }

    let pending = { rows: [] };
    if (deptNames.length > 0) {
      pending = await pool.query(
        `SELECT ar.*, e.full_name AS employee_name, e.department AS employee_department
         FROM attendance_requests ar
         JOIN employees e ON e.id = ar.employee_id
         WHERE ar.status = 'pending'
           AND e.department = ANY($1)
         ORDER BY ar.created_at DESC`,
        [deptNames]
      );
    }

    res.json({ team: team.rows, pending_requests: pending.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
