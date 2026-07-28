const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "kifiya-attendance-secret-2026";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "24h";

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    const result = await pool.query(
      `SELECT u.id, u.username, u.role, u.full_name, u.employee_id, u.email,
              e.department AS employee_department, e.full_name AS employee_name
       FROM users u
       LEFT JOIN employees e ON e.id = u.employee_id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      req.user.employee_id = req.user.employee_id || row.employee_id;
      req.user.full_name = row.full_name || row.employee_name || row.username;
      req.user.email = row.email;
      req.user.employee_department = row.employee_department;
    }

    const deptAssignments = await pool.query(
      `SELECT da.id AS assignment_id, da.assignment_type, d.id AS department_id, d.name AS department_name
       FROM department_assignments da
       JOIN departments d ON d.id = da.department_id
       WHERE da.user_id = $1`,
      [decoded.id]
    );
    req.user.assigned_departments = deptAssignments.rows;

    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

module.exports = { generateToken, authenticate, authorize, JWT_SECRET };
