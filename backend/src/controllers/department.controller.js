const pool = require("../config/db");
const bcrypt = require("bcrypt");

exports.list = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.name, d.is_active, d.created_at,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'assignment_id', da.id,
            'user_id', da.user_id,
            'username', u.username,
            'full_name', u.full_name,
            'assignment_type', da.assignment_type,
            'employee_id', e.id,
            'employee_name', e.full_name,
            'employee_department', e.department
          ))
           FROM department_assignments da
           JOIN users u ON u.id = da.user_id
           LEFT JOIN employees e ON e.id = u.employee_id
           WHERE da.department_id = d.id),
          '[]'
        ) AS assignments,
        (SELECT COUNT(*) FROM employees e WHERE e.department = d.name AND e.status = 'active') AS employee_count
      FROM departments d
      ORDER BY d.name
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.get = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.name, d.is_active, d.created_at,
        COALESCE(
          (SELECT json_agg(json_build_object('id', da.id, 'user_id', da.user_id, 'username', u.username, 'full_name', u.full_name, 'assignment_type', da.assignment_type))
           FROM department_assignments da
           JOIN users u ON u.id = da.user_id
           WHERE da.department_id = d.id),
          '[]'
        ) AS assignments
      FROM departments d
      WHERE d.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Department not found" });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Department name is required" });

    const existing = await pool.query("SELECT id FROM departments WHERE LOWER(name) = LOWER($1)", [name]);
    if (existing.rows.length > 0) return res.status(409).json({ error: "Department already exists" });

    const result = await pool.query(
      "INSERT INTO departments (name) VALUES ($1) RETURNING id, name, is_active, created_at",
      [name]
    );

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "create_department", "department", result.rows[0].id, JSON.stringify({ name })]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, is_active } = req.body;
    const result = await pool.query(
      `UPDATE departments
       SET name = COALESCE($1, name), is_active = COALESCE($2, is_active)
       WHERE id = $3
       RETURNING id, name, is_active, created_at`,
      [name, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Department not found" });

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "update_department", "department", req.params.id, JSON.stringify(req.body)]
    );

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const empCheck = await pool.query(
      "SELECT COUNT(*) FROM employees WHERE department = (SELECT name FROM departments WHERE id = $1) AND status = 'active'",
      [req.params.id]
    );
    if (parseInt(empCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: "Cannot delete department with active employees. Reassign employees first." });
    }

    const result = await pool.query("DELETE FROM departments WHERE id = $1 RETURNING id, name", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Department not found" });

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "delete_department", "department", req.params.id, JSON.stringify({ name: result.rows[0].name })]
    );

    res.json({ message: "Department deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.assignUser = async (req, res) => {
  try {
    const { employee_id, user_id, assignment_type } = req.body;
    const department_id = parseInt(req.params.id);

    if (!assignment_type) {
      return res.status(400).json({ error: "assignment_type (manager/hr) is required" });
    }
    if (!["manager", "hr"].includes(assignment_type)) {
      return res.status(400).json({ error: "assignment_type must be 'manager' or 'hr'" });
    }
    if (!employee_id && !user_id) {
      return res.status(400).json({ error: "employee_id or user_id is required" });
    }

    const dept = await pool.query("SELECT id, name FROM departments WHERE id = $1", [department_id]);
    if (dept.rows.length === 0) return res.status(404).json({ error: "Department not found" });

    let resolvedUserId = null;
    let resolvedEmployeeName = "";

    if (employee_id) {
      const emp = await pool.query("SELECT id, full_name, department FROM employees WHERE id = $1", [employee_id]);
      if (emp.rows.length === 0) return res.status(404).json({ error: "Employee not found in BioTime data" });
      resolvedEmployeeName = emp.rows[0].full_name;

      const existingUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [employee_id]);
      if (existingUser.rows.length > 0) {
        resolvedUserId = existingUser.rows[0].id;
      } else {
        const username = emp.rows[0].full_name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");
        const defaultPassword = await bcrypt.hash("Kifiya@123", 10);
        const newUser = await pool.query(
          `INSERT INTO users (username, password_hash, full_name, role, employee_id, must_change_password)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING id`,
          [username, defaultPassword, emp.rows[0].full_name, assignment_type === "manager" ? "manager" : "hr", employee_id]
        );
        resolvedUserId = newUser.rows[0].id;
      }
    } else {
      const user = await pool.query("SELECT id, full_name FROM users WHERE id = $1", [user_id]);
      if (user.rows.length === 0) return res.status(404).json({ error: "User not found" });
      resolvedUserId = user_id;
      resolvedEmployeeName = user.rows[0].full_name;
    }

    const existing = await pool.query(
      "SELECT id FROM department_assignments WHERE department_id = $1 AND user_id = $2 AND assignment_type = $3",
      [department_id, resolvedUserId, assignment_type]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Already assigned to this department with this role" });
    }

    const result = await pool.query(
      `INSERT INTO department_assignments (department_id, user_id, assignment_type)
       VALUES ($1, $2, $3)
       RETURNING id, department_id, user_id, assignment_type, created_at`,
      [department_id, resolvedUserId, assignment_type]
    );

    if (assignment_type === "manager" && employee_id) {
      const empResult = await pool.query("SELECT id FROM employees WHERE id = $1", [employee_id]);
      if (empResult.rows.length > 0) {
        await pool.query(
          `UPDATE employees SET manager_id = $1, updated_at = NOW()
           WHERE department = $2 AND id != $1 AND status = 'active'`,
          [employee_id, dept.rows[0].name]
        );
      }
    }

    if (assignment_type === "hr" && employee_id) {
      await pool.query(
        `UPDATE employees SET hr_id = $1, updated_at = NOW()
         WHERE department = $2 AND id != $1 AND status = 'active'`,
        [employee_id, dept.rows[0].name]
      );
    }

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "assign_department_user", "department_assignment", result.rows[0].id,
       JSON.stringify({ department: dept.rows[0].name, employee: resolvedEmployeeName, assignment_type })]
    );

    res.status(201).json({ ...result.rows[0], employee_name: resolvedEmployeeName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.removeAssignment = async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM department_assignments WHERE id = $1 AND department_id = $2 RETURNING id, user_id, assignment_type",
      [req.params.assignmentId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Assignment not found" });

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "remove_department_user", "department_assignment", req.params.assignmentId, JSON.stringify(result.rows[0])]
    );

    res.json({ message: "Assignment removed" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { manager_id, department, position, email, phone } = req.body;
    const result = await pool.query(
      `UPDATE employees
       SET manager_id = COALESCE($1, manager_id),
           department = COALESCE($2, department),
           position = COALESCE($3, position),
           email = COALESCE($4, email),
           phone = COALESCE($5, phone),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, full_name, department, manager_id, position, email, phone`,
      [manager_id, department, position, email, phone, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Employee not found" });

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "update_employee", "employee", req.params.id, JSON.stringify(req.body)]
    );

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
