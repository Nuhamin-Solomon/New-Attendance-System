const pool = require("../config/db");

const VALID_TYPES = [
  "field_duty", "official_travel", "client_visit", "training",
  "work_from_home", "meeting_outside", "missing_check_in",
  "missing_check_out", "forgotten_punch", "overtime", "other"
];

exports.list = async (req, res) => {
  try {
    const { status, request_type, employee_id, mine } = req.query;
    let query = `
      SELECT ar.*, e.full_name AS employee_name, e.department,
             mu.full_name AS manager_name, hu.full_name AS hr_name
      FROM attendance_requests ar
      JOIN employees e ON e.id = ar.employee_id
      LEFT JOIN users mu ON mu.id = ar.manager_id
      LEFT JOIN users hu ON hu.id = ar.hr_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (mine === "true" || req.user.role === "employee") {
      query += ` AND ar.employee_id = $${idx++}`;
      params.push(req.user.employee_id);
    } else if (employee_id) {
      query += ` AND ar.employee_id = $${idx++}`;
      params.push(employee_id);
    } else if (req.user.role === "manager" && req.user.employee_department) {
      query += ` AND e.department = $${idx++}`;
      params.push(req.user.employee_department);
    }

    if (status) { query += ` AND ar.status = $${idx++}`; params.push(status); }
    if (request_type) { query += ` AND ar.request_type = $${idx++}`; params.push(request_type); }

    query += " ORDER BY ar.created_at DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { request_type, date, start_time, end_time, location, reason, attachment_url } = req.body;
    const employee_id = req.body.employee_id || req.user.employee_id;

    if (!request_type || !date) {
      return res.status(400).json({ error: "Request type and date are required" });
    }

    const result = await pool.query(
      `INSERT INTO attendance_requests (employee_id, request_type, date, start_time, end_time, location, reason, attachment_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [employee_id, request_type, date, start_time || null, end_time || null, location || null, reason || null, attachment_url || null]
    );

    const empResult = await pool.query("SELECT manager_id FROM employees WHERE id = $1", [employee_id]);
    const managerId = empResult.rows[0]?.manager_id;
    if (managerId) {
      const mgrUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [managerId]);
      if (mgrUser.rows.length > 0) {
        const empName = await pool.query("SELECT full_name FROM employees WHERE id = $1", [employee_id]);
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [mgrUser.rows[0].id, "New Attendance Request",
           `${empName.rows[0]?.full_name || "An employee"} submitted a ${request_type.replace(/_/g, " ")} request for review.`,
           "approval", "/approvals"]
        );
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { date, start_time, end_time, location, reason, attachment_url } = req.body;
    const ar = await pool.query("SELECT * FROM attendance_requests WHERE id = $1", [req.params.id]);
    if (ar.rows.length === 0) return res.status(404).json({ error: "Request not found" });

    if (req.user.role === "employee" && ar.rows[0].employee_id !== req.user.employee_id) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (ar.rows[0].status !== "pending") {
      return res.status(400).json({ error: "Only pending requests can be edited" });
    }

    const result = await pool.query(
      `UPDATE attendance_requests SET date = $1, start_time = $2, end_time = $3,
       location = $4, reason = $5, attachment_url = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [date || ar.rows[0].date, start_time ?? ar.rows[0].start_time, end_time ?? ar.rows[0].end_time,
       location ?? ar.rows[0].location, reason ?? ar.rows[0].reason,
       attachment_url ?? ar.rows[0].attachment_url, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.cancel = async (req, res) => {
  try {
    const ar = await pool.query("SELECT * FROM attendance_requests WHERE id = $1", [req.params.id]);
    if (ar.rows.length === 0) return res.status(404).json({ error: "Request not found" });

    if (req.user.role === "employee" && ar.rows[0].employee_id !== req.user.employee_id) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (ar.rows[0].status !== "pending") {
      return res.status(400).json({ error: "Only pending requests can be cancelled" });
    }

    const result = await pool.query(
      `UPDATE attendance_requests SET status = 'rejected', cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.approveManager = async (req, res) => {
  try {
    const { status, comment } = req.body;
    const result = await pool.query(
      `UPDATE attendance_requests
       SET manager_status = $1, manager_comment = $2, manager_approved_at = NOW(),
           manager_id = $3, status = CASE WHEN $1 = 'approved' THEN 'manager_approved' ELSE 'rejected' END
       WHERE id = $4 RETURNING *`,
      [status, comment || null, req.user.id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Request not found" });

    const ar = result.rows[0];
    const empUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [ar.employee_id]);
    if (empUser.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [empUser.rows[0].id, "Request Update",
         `Your ${ar.request_type.replace(/_/g, " ")} request was ${status} by your manager.`,
         "request_update", "/requests"]
      );
    }

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.approveHR = async (req, res) => {
  try {
    const { status, comment } = req.body;
    const newStatus = status === "approved" ? "approved" : "rejected";
    const result = await pool.query(
      `UPDATE attendance_requests
       SET hr_status = $1, hr_comment = $2, hr_approved_at = NOW(),
           hr_id = $3, status = $4
       WHERE id = $5 RETURNING *`,
      [status, comment || null, req.user.id, newStatus, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Request not found" });

    const ar = result.rows[0];
    if (newStatus === "approved" && ["field_duty", "official_travel", "client_visit", "training", "work_from_home", "meeting_outside"].includes(ar.request_type)) {
      const noteText = ar.location || ar.request_type.replace(/_/g, " ");
      await pool.query(
        `INSERT INTO attendance_summary (employee_id, date, status, notes)
         VALUES ($1, $2, 'approved', $3)
         ON CONFLICT (employee_id, date) DO UPDATE SET status = 'approved', notes = $3`,
        [ar.employee_id, ar.date, noteText]
      );
    }

    const empUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [ar.employee_id]);
    if (empUser.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [empUser.rows[0].id, "Request Finalized",
         `Your ${ar.request_type.replace(/_/g, " ")} request has been ${newStatus} by HR.`,
         "request_update", "/requests"]
      );
    }

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
