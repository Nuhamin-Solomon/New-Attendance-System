const bcrypt = require("bcrypt");
const pool = require("../config/db");

const VALID_ROLES = new Set(["admin", "hr", "manager", "employee"]);
const USERNAME_RE = /^[A-Za-z0-9._-]{3,80}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeUserInput(input) {
  return {
    username: typeof input.username === "string" ? input.username.trim() : input.username,
    email: typeof input.email === "string" ? input.email.trim().toLowerCase() : input.email,
    full_name: typeof input.full_name === "string" ? input.full_name.trim() : input.full_name,
    role: input.role,
    employee_id: input.employee_id === "" || input.employee_id === undefined ? null : Number(input.employee_id),
  };
}

async function validateUserInput(input, targetId = null, password = null) {
  if (input.username !== undefined && (!USERNAME_RE.test(input.username || ""))) {
    return "Username must be 3–80 characters and contain only letters, numbers, dots, underscores, or hyphens";
  }
  if (input.email && !EMAIL_RE.test(input.email)) return "Enter a valid email address";
  if (input.role !== undefined && !VALID_ROLES.has(input.role)) return "Invalid role";
  if (password !== null && (typeof password !== "string" || password.length < 8)) {
    return "Password must be at least 8 characters";
  }
  if (input.email) {
    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND ($2::int IS NULL OR id != $2)", [input.email, targetId]);
    if (existing.rows.length) return "Email address already exists";
  }
  if (input.employee_id !== null && !Number.isInteger(input.employee_id)) return "Invalid employee record";
  if (input.employee_id !== null) {
    const employee = await pool.query("SELECT id FROM employees WHERE id = $1", [input.employee_id]);
    if (!employee.rows.length) return "Employee record not found";
    const linked = await pool.query("SELECT id FROM users WHERE employee_id = $1 AND ($2::int IS NULL OR id != $2)", [input.employee_id, targetId]);
    if (linked.rows.length) return "This employee is already linked to another user";
  }
  return null;
}

exports.list = async (req, res) => {
  try {
    const { search, role, is_active } = req.query;
    const page = req.query.page ? parseInt(req.query.page, 10) : null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

    const params = [];
    const conditions = [];

    if (role) { conditions.push(`u.role = $${params.length + 1}`); params.push(role); }
    if (is_active !== undefined && is_active !== "") { conditions.push(`u.is_active = $${params.length + 1}`); params.push(is_active === "true" || is_active === "1"); }
    if (search) {
      conditions.push(
        `(u.username ILIKE $${params.length + 1} OR u.full_name ILIKE $${params.length + 1} ` +
        `OR COALESCE(u.email, '') ILIKE $${params.length + 1} ` +
        `OR COALESCE(e.full_name, '') ILIKE $${params.length + 1} OR COALESCE(e.department, '') ILIKE $${params.length + 1})`
      );
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
    const select = `SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.employee_id, u.last_login, u.created_at, e.full_name AS employee_name, e.department`;
    const base = `FROM users u LEFT JOIN employees e ON e.id = u.employee_id${whereClause}`;

    if (page && page > 0 && limit && limit > 0) {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS total ${base}`, params);
      const total = countRes.rows[0].total;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * limit;
      const dataRes = await pool.query(
        `${select} ${base} ORDER BY u.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );
      return res.json({ data: dataRes.rows, total, page: safePage, limit, totalPages });
    }

    const result = await pool.query(`${select} ${base} ORDER BY u.id`, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.get = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.employee_id, u.last_login, u.created_at,
              e.full_name AS employee_name, e.department
       FROM users u
       LEFT JOIN employees e ON e.id = u.employee_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { password } = req.body;
    const { username, email, full_name, role, employee_id } = normalizeUserInput(req.body);
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const validationError = await validateUserInput({ username, email, full_name, role, employee_id }, null, password);
    if (validationError) return res.status(400).json({ error: validationError });
    const existing = await pool.query("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, email, full_name, role, employee_id, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [username, hash, email || null, full_name || username, role || "employee", employee_id || null]
    );

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "create_user", "user", result.rows[0].id, JSON.stringify({ username, role })]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { is_active } = req.body;
    const { username, email, full_name, role, employee_id } = normalizeUserInput(req.body);
    const targetId = req.params.id;

    if (parseInt(targetId) === req.user.id && role !== undefined && role !== req.user.role) {
      return res.status(400).json({ error: "Cannot change your own role" });
    }
    if (parseInt(targetId) === req.user.id && is_active === false) {
      return res.status(400).json({ error: "Cannot deactivate your own account" });
    }

    const validationError = await validateUserInput({ username, email, full_name, role, employee_id }, targetId);
    if (validationError) return res.status(400).json({ error: validationError });

    if (username !== undefined) {
      const dup = await pool.query(
        "SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2",
        [username, targetId]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: "Username already exists" });
      }
    }

    const result = await pool.query(
      `UPDATE users SET
         username = COALESCE($1, username),
         email = COALESCE($2, email),
         full_name = COALESCE($3, full_name),
         role = COALESCE($4, role),
         is_active = COALESCE($5, is_active),
         employee_id = $6,
         updated_at = NOW()
       WHERE id = $7
       RETURNING id, username, email, full_name, role, is_active, employee_id`,
      [username || null, email, full_name, role, is_active, employee_id, targetId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "update_user", "user", targetId, JSON.stringify(req.body)]
    );

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const pw = newPassword;
    const hash = await bcrypt.hash(pw, 10);
    const result = await pool.query(
      "UPDATE users SET password_hash = $1, must_change_password = true, updated_at = NOW() WHERE id = $2 RETURNING id, username",
      [hash, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)",
      [req.user.id, "reset_password", "user", req.params.id]
    );

    res.json({ message: "Password reset successfully", temporary_password: pw });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.permanentRemove = async (req, res) => {
  const targetId = req.params.id;
  if (parseInt(targetId) === req.user.id) {
    return res.status(400).json({ error: "Cannot permanently delete your own account" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const user = await client.query("SELECT id, username, employee_id FROM users WHERE id = $1 FOR UPDATE", [targetId]);
    if (user.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }
    const { username, employee_id } = user.rows[0];

    // Clear references to this user from other tables so the NO ACTION
    // foreign keys on manager/hr/approver columns do not block deletion.
    await client.query("UPDATE attendance_requests SET manager_id = NULL WHERE manager_id = $1", [targetId]);
    await client.query("UPDATE attendance_requests SET hr_id = NULL WHERE hr_id = $1", [targetId]);
    await client.query("UPDATE leave_requests SET approved_by = NULL WHERE approved_by = $1", [targetId]);
    await client.query("UPDATE leave_requests SET manager_id = NULL WHERE manager_id = $1", [targetId]);
    await client.query("UPDATE leave_requests SET hr_id = NULL WHERE hr_id = $1", [targetId]);

    // User-owned rows that must be removed with the account.
    await client.query("DELETE FROM notifications WHERE user_id = $1", [targetId]);

    if (employee_id) {
      await client.query("UPDATE employees SET manager_id = NULL WHERE manager_id = $1", [employee_id]);
      await client.query("UPDATE employees SET hr_id = NULL WHERE hr_id = $1", [employee_id]);
      await client.query("UPDATE departments SET manager_id = NULL WHERE manager_id = $1", [employee_id]);

      await client.query("DELETE FROM attendance_logs WHERE employee_id = $1", [employee_id]);
      await client.query("DELETE FROM attendance_sessions WHERE employee_id = $1", [employee_id]);
      await client.query("DELETE FROM attendance_summary WHERE employee_id = $1", [employee_id]);
      await client.query("DELETE FROM attendance_requests WHERE employee_id = $1", [employee_id]);
      await client.query("DELETE FROM leave_balances WHERE employee_id = $1", [employee_id]);
      await client.query("DELETE FROM leave_requests WHERE employee_id = $1", [employee_id]);
      await client.query("DELETE FROM pending_attendance_logs WHERE employee_id = $1", [employee_id]);

      await client.query("DELETE FROM employees WHERE id = $1", [employee_id]);
    }

    await client.query("DELETE FROM users WHERE id = $1", [targetId]);

    await client.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "delete_user_permanent", "user", targetId, JSON.stringify({ username, employee_id: employee_id || null })]
    );

    await client.query("COMMIT");
    res.json({ message: "Employee permanently deleted along with all related records" });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
};

exports.remove = async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const result = await pool.query(
      "UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, username",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "delete_user", "user", req.params.id, JSON.stringify({ username: result.rows[0].username })]
    );

    res.json({ message: "User deactivated; historical records were preserved" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
