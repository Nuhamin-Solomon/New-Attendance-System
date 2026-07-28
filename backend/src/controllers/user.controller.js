const bcrypt = require("bcrypt");
const pool = require("../config/db");

exports.list = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.employee_id, u.last_login, u.created_at,
              e.full_name AS employee_name, e.department
       FROM users u
       LEFT JOIN employees e ON e.id = u.employee_id
       ORDER BY u.id`
    );
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
    const { username, password, email, full_name, role, employee_id } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, email, full_name, role, employee_id)
       VALUES ($1, $2, $3, $4, $5, $6)
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
    const { username, email, full_name, role, is_active, employee_id } = req.body;
    const targetId = req.params.id;

    if (parseInt(targetId) === req.user.id && role !== undefined && role !== req.user.role) {
      return res.status(400).json({ error: "Cannot change your own role" });
    }

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
         employee_id = COALESCE($6, employee_id),
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
    const pw = newPassword || "changeme123";
    const hash = await bcrypt.hash(pw, 10);
    const result = await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username",
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

exports.remove = async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id, username", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "delete_user", "user", req.params.id, JSON.stringify({ username: result.rows[0].username })]
    );

    res.json({ message: "User deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
