const pool = require("../config/db");

exports.list = async (req, res) => {
  try {
    const { user_id, action, start_date, end_date, search } = req.query;
    const page = req.query.page ? parseInt(req.query.page, 10) : null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

    let where = " WHERE 1=1";
    const params = [];
    let idx = 1;

    if (user_id) { where += ` AND al.user_id = $${idx++}`; params.push(user_id); }
    if (action) { where += ` AND al.action ILIKE $${idx++}`; params.push(`%${action}%`); }
    if (start_date) { where += ` AND al.created_at >= $${idx++}`; params.push(start_date); }
    if (end_date) { where += ` AND al.created_at <= $${idx++}`; params.push(end_date); }
    if (search) {
      where += ` AND (u.username ILIKE $${idx++} OR u.full_name ILIKE $${idx++} OR al.action ILIKE $${idx++} OR COALESCE(al.details, '') ILIKE $${idx++})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const select = `SELECT al.*, u.username, u.full_name AS user_full_name FROM audit_log al LEFT JOIN users u ON u.id = al.user_id`;

    if (page && page > 0 && limit && limit > 0) {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM audit_log al LEFT JOIN users u ON u.id = al.user_id${where}`, params);
      const total = countRes.rows[0].total;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * limit;
      const dataRes = await pool.query(
        `${select}${where} ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );
      return res.json({ data: dataRes.rows, total, page: safePage, limit, totalPages });
    }

    query = `${select}${where} ORDER BY al.created_at DESC LIMIT 200`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
