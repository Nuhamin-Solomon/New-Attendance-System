const pool = require("../config/db");

exports.list = async (req, res) => {
  try {
    const { user_id, action, start_date, end_date } = req.query;
    let query = `
      SELECT al.*, u.username, u.full_name AS user_full_name
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (user_id) { query += ` AND al.user_id = $${idx++}`; params.push(user_id); }
    if (action) { query += ` AND al.action ILIKE $${idx++}`; params.push(`%${action}%`); }
    if (start_date) { query += ` AND al.created_at >= $${idx++}`; params.push(start_date); }
    if (end_date) { query += ` AND al.created_at <= $${idx++}`; params.push(end_date); }

    query += " ORDER BY al.created_at DESC LIMIT 200";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
