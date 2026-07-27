const pool = require("../config/db");

exports.listTypes = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM leave_types WHERE is_active = true ORDER BY id");
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.list = async (req, res) => {
  try {
    const { employee_id, status, start_date, end_date, mine } = req.query;
    let query = `
      SELECT lr.*, lt.name AS leave_type_name, e.full_name AS employee_name, e.department
      FROM leave_requests lr
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      JOIN employees e ON e.id = lr.employee_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (mine === "true" || req.user.role === "employee") {
      query += ` AND lr.employee_id = $${idx++}`;
      params.push(req.user.employee_id);
    } else if (employee_id) {
      query += ` AND lr.employee_id = $${idx++}`;
      params.push(employee_id);
    } else if (req.user.role === "manager" && req.user.employee_department) {
      query += ` AND e.department = $${idx++}`;
      params.push(req.user.employee_department);
    }

    if (status) { query += ` AND lr.status = $${idx++}`; params.push(status); }
    if (start_date) { query += ` AND lr.start_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { query += ` AND lr.end_date <= $${idx++}`; params.push(end_date); }

    query += " ORDER BY lr.created_at DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { leave_type_id, start_date, end_date, reason, supporting_doc_url } = req.body;
    const employee_id = req.body.employee_id || req.user.employee_id;

    if (!leave_type_id || !start_date || !end_date) {
      return res.status(400).json({ error: "Leave type, start date, and end date are required" });
    }

    const result = await pool.query(
      `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, reason, supporting_doc_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [employee_id, leave_type_id, start_date, end_date, reason || null, supporting_doc_url || null]
    );

    const managers = await pool.query("SELECT id FROM users WHERE role IN ('hr', 'admin')");
    for (const m of managers.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [m.id, "New Leave Request", `A leave request requires your review.`, "approval", "/leave"]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const lr = await pool.query("SELECT * FROM leave_requests WHERE id = $1", [req.params.id]);
    if (lr.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    if (req.user.role === "employee" && lr.rows[0].employee_id !== req.user.employee_id) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (lr.rows[0].status !== "pending") {
      return res.status(400).json({ error: "Only pending requests can be edited" });
    }

    const { leave_type_id, start_date, end_date, reason, supporting_doc_url } = req.body;
    const result = await pool.query(
      `UPDATE leave_requests SET leave_type_id = $1, start_date = $2, end_date = $3, reason = $4, supporting_doc_url = $5
       WHERE id = $6 RETURNING *`,
      [leave_type_id || lr.rows[0].leave_type_id, start_date || lr.rows[0].start_date,
       end_date || lr.rows[0].end_date, reason ?? lr.rows[0].reason,
       supporting_doc_url ?? lr.rows[0].supporting_doc_url, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.cancel = async (req, res) => {
  try {
    const lr = await pool.query("SELECT * FROM leave_requests WHERE id = $1", [req.params.id]);
    if (lr.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    if (req.user.role === "employee" && lr.rows[0].employee_id !== req.user.employee_id) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (lr.rows[0].status !== "pending") {
      return res.status(400).json({ error: "Only pending requests can be cancelled" });
    }

    const result = await pool.query(
      `UPDATE leave_requests SET status = 'rejected', approved_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.approve = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE leave_requests SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Request not found" });

    const lr = result.rows[0];
    const empResult = await pool.query("SELECT id FROM users WHERE employee_id = $1", [lr.employee_id]);
    if (empResult.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [empResult.rows[0].id, "Leave Approved", "Your leave request has been approved.", "leave", "/leave"]
      );
    }

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.reject = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE leave_requests SET status = 'rejected', approved_by = $1, approved_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.balances = async (req, res) => {
  try {
    const empId = req.params.employeeId || req.user.employee_id;
    const year = req.query.year || new Date().getFullYear();

    const result = await pool.query(
      `SELECT lb.*, lt.name AS leave_type_name
       FROM leave_balances lb
       JOIN leave_types lt ON lt.id = lb.leave_type_id
       WHERE lb.employee_id = $1 AND lb.year = $2
       ORDER BY lt.id`,
      [empId, year]
    );

    if (result.rows.length === 0) {
      const types = await pool.query("SELECT * FROM leave_types WHERE is_active = true");
      const created = [];
      for (const t of types.rows) {
        const r = await pool.query(
          `INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, used_days, remaining_days)
           VALUES ($1, $2, $3, $4, 0, $4) RETURNING *`,
          [empId, t.id, year, t.days_allowed]
        );
        created.push({ ...r.rows[0], leave_type_name: t.name });
      }
      return res.json(created);
    }

    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
