const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const { generateToken } = require("../middleware/auth");

const RESET_TTL_MINUTES = parseInt(process.env.PASSWORD_RESET_TTL_MINUTES || "60", 10);
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const rateLimits = new Map();

function rateLimit(key, limit) {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

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

    const deptResult = await pool.query(
      `SELECT da.assignment_type, d.name AS department_name, d.id AS department_id
       FROM department_assignments da
       JOIN departments d ON d.id = da.department_id
       WHERE da.user_id = $1`,
      [req.user.id]
    );

    res.json({
      ...result.rows[0],
      assigned_departments: deptResult.rows,
    });
  } catch (e) {
    console.error("Me error:", e.message);
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

exports.forgotPassword = async (req, res) => {
  try {
    const { username, email } = req.body || {};
    const identifier = (username || email || "").trim();
    if (!identifier) {
      return res.status(400).json({ error: "Username or email is required" });
    }

    const ip = clientIp(req);
    if (!rateLimit(`fp:${ip}:${identifier.toLowerCase()}`, 5)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const result = await pool.query(
      `SELECT id, is_active FROM users
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)`,
      [identifier]
    );

    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.json({ message: "Password reset request accepted." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL",
        [user.id]
      );
      await client.query(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        [user.id, tokenHash, expiresAt]
      );
      await client.query(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
        [user.id, "forgot_password_requested", "user", user.id, JSON.stringify({ expires_at: expiresAt.toISOString() })]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.json({
      message: "Password reset request accepted. A one-time reset token has been issued.",
      reset_token: token,
      expires_in_minutes: RESET_TTL_MINUTES,
    });
  } catch (e) {
    console.error("Forgot password error:", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const ip = clientIp(req);
    if (!rateLimit(`rp:${ip}`, 5)) {
      return res.status(429).json({ error: "Too many attempts. Please try again later." });
    }

    const tokenHash = sha256(token);
    const result = await pool.query(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const record = result.rows[0];
    if (record.used_at) {
      return res.status(400).json({ error: "This reset token has already been used" });
    }
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "This reset token has expired" });
    }

    const userResult = await pool.query(
      "SELECT id, is_active FROM users WHERE id = $1",
      [record.user_id]
    );
    const resetUser = userResult.rows[0];
    if (!resetUser || !resetUser.is_active) {
      return res.status(400).json({ error: "Account is no longer available" });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2",
        [hash, resetUser.id]
      );
      await client.query(
        "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1 AND used_at IS NULL",
        [record.id]
      );
      await client.query(
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)",
        [resetUser.id, "password_reset", "user", resetUser.id]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (e) {
    console.error("Reset password error:", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
