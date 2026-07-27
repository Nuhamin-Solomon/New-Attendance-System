const pool = require("../config/db");

exports.list = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM settings ORDER BY category, key");
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }
    res.json(grouped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: "Settings must be an array" });
    }

    for (const s of settings) {
      await pool.query(
        `INSERT INTO settings (key, value, category) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [s.key, s.value, s.category || "general"]
      );
    }

    await pool.query(
      "INSERT INTO audit_log (user_id, action, entity_type, details) VALUES ($1, $2, $3, $4)",
      [req.user.id, "update_settings", "settings", JSON.stringify({ keys: settings.map((s) => s.key) })]
    );

    res.json({ message: "Settings updated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
