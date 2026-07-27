const bcrypt = require("bcrypt");
const pool = require("../config/db");
const { generateToken } = require("../middleware/auth");

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const result = await pool.query(
      "SELECT id, username, password_hash, role, full_name, email, employee_id, is_active, must_change_password FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "Account is disabled" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);

    const token = generateToken(user);

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)",
      [user.id, "login", "user", user.id]
    );

    res.json({
      token,
      must_change_password: user.must_change_password,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        email: user.email,
        employee_id: user.employee_id,
        must_change_password: user.must_change_password,
      },
    });
  } catch (e) {
    console.error("Login error:", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.me = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, role, full_name, email, employee_id, is_active, must_change_password, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2", [hash, req.user.id]);

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)",
      [req.user.id, "change_password", "user", req.user.id]
    );

    res.json({ message: "Password updated successfully" });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.forceChangePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2", [hash, req.user.id]);

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)",
      [req.user.id, "force_change_password", "user", req.user.id]
    );

    res.json({ message: "Password changed successfully" });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.register = async (req, res) => {
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
      `INSERT INTO users (username, password_hash, email, full_name, role, employee_id, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id, username, role, full_name, email`,
      [username, hash, email || null, full_name || username, role || "employee", employee_id || null]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, "create_user", "user", user.id, JSON.stringify({ username: user.username, role: user.role })]
    );

    res.status(201).json({ token, user });
  } catch (e) {
    console.error("Register error:", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
