const pool = require("../config/db");

exports.list = async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page, 10) : null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

    if (page && page > 0 && limit && limit > 0) {
      const countRes = await pool.query(
        "SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1",
        [req.user.id]
      );
      const total = countRes.rows[0].total;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * limit;
      const dataRes = await pool.query(
        `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
      );
      return res.json({ data: dataRes.rows, total, page: safePage, limit, totalPages });
    }

    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.unreadCount = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false",
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]);
    res.json({ message: "Marked as read" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read = true WHERE user_id = $1", [req.user.id]);
    res.json({ message: "All marked as read" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
