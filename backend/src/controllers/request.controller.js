const pool = require("../config/db");
const { getDepartmentFilter } = require("../utils/departmentFilter");

const VALID_TYPES = [
  "field_duty", "official_travel", "client_visit", "training",
  "work_from_home", "meeting_outside", "missing_check_in",
  "missing_check_out", "forgotten_punch", "overtime", "other"
];

const TYPE_LABELS = {
  field_duty: "Field Duty", official_travel: "Official Travel",
  client_visit: "Client Visit", training: "Training",
  work_from_home: "Remote Work", meeting_outside: "Meeting Outside",
  missing_check_in: "Missing Check-in", missing_check_out: "Missing Check-out",
  forgotten_punch: "Forgotten Punch", overtime: "Overtime", other: "Other",
};

async function logAudit(userId, action, entityId, details) {
  await pool.query(
    "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, 'attendance_request', $3, $4)",
    [userId, action, entityId, details ? JSON.stringify(details) : null]
  );
}

async function revertAttendanceSummary(employeeId, date) {
  const logs = await pool.query(
    `SELECT MIN(scan_time) AS first_in, MAX(scan_time) AS last_out, COUNT(*) AS scan_count
     FROM attendance_logs
     WHERE employee_id = $1 AND DATE(scan_time) = $2`,
    [employeeId, date]
  );
  const l = logs.rows[0];
  if (l && parseInt(l.scan_count) > 0) {
    const diffMs = new Date(l.last_out) - new Date(l.first_in);
    const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
    const status = parseInt(l.scan_count) <= 1 ? "present_incomplete"
      : totalHours >= 9 ? "present"
      : totalHours >= 1 ? "present_partial" : "present_incomplete";
    await pool.query(
      `INSERT INTO attendance_summary (employee_id, date, first_in, last_out, total_hours, status, is_late, late_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, false, 0)
       ON CONFLICT (employee_id, date) DO UPDATE SET
         first_in = $3, last_out = $4, total_hours = $5, status = $6, notes = NULL, is_late = false, late_minutes = 0`,
      [employeeId, date, l.first_in, l.last_out, totalHours, status]
    );
  } else {
    await pool.query(
      `INSERT INTO attendance_summary (employee_id, date, status)
       VALUES ($1, $2, 'absent')
       ON CONFLICT (employee_id, date) DO UPDATE SET status = 'absent', notes = NULL`,
      [employeeId, date]
    );
  }
}

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
    } else {
      const deptFilter = getDepartmentFilter(req.user, idx);
      if (deptFilter.clause) {
        query += deptFilter.clause;
        params.push(deptFilter.value);
        idx = deptFilter.nextIdx;
      }
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
    if (!VALID_TYPES.includes(request_type)) {
      return res.status(400).json({ error: "Invalid request type" });
    }

    const result = await pool.query(
      `INSERT INTO attendance_requests (employee_id, request_type, date, start_time, end_time, location, reason, attachment_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [employee_id, request_type, date, start_time || null, end_time || null, location || null, reason || null, attachment_url || null]
    );

    const created = result.rows[0];

    const empResult = await pool.query("SELECT manager_id, full_name FROM employees WHERE id = $1", [employee_id]);
    const managerId = empResult.rows[0]?.manager_id;
    const empName = empResult.rows[0]?.full_name || "An employee";
    if (managerId) {
      const mgrUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [managerId]);
      if (mgrUser.rows.length > 0) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)`,
          [mgrUser.rows[0].id, "New Attendance Request",
           `${empName} submitted a ${TYPE_LABELS[request_type] || request_type} request for your approval.`,
           "approval", "/approvals"]
        );
      }
    }

    await logAudit(req.user.id, "create_request", created.id, { request_type, date, employee_id });

    res.status(201).json(created);
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

    await logAudit(req.user.id, "update_request", req.params.id, req.body);

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.cancel = async (req, res) => {
  try {
    const ar = await pool.query("SELECT * FROM attendance_requests WHERE id = $1", [req.params.id]);
    if (ar.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    const request = ar.rows[0];

    if (req.user.role === "employee" && request.employee_id !== req.user.employee_id) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!["pending", "manager_approved"].includes(request.status)) {
      return res.status(400).json({ error: "Only pending or manager-approved requests can be cancelled" });
    }

    const result = await pool.query(
      `UPDATE attendance_requests SET status = 'rejected', cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logAudit(req.user.id, "cancel_request", req.params.id, { previous_status: request.status });

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.recall = async (req, res) => {
  try {
    const ar = await pool.query("SELECT * FROM attendance_requests WHERE id = $1", [req.params.id]);
    if (ar.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    const request = ar.rows[0];

    if (req.user.role === "employee" && request.employee_id !== req.user.employee_id) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (request.status !== "approved") {
      return res.status(400).json({ error: "Only approved requests can be recalled" });
    }

    const result = await pool.query(
      `UPDATE attendance_requests SET status = 'recalled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (request.date) {
      await revertAttendanceSummary(request.employee_id, request.date);
    }

    await logAudit(req.user.id, "recall_request", req.params.id, { request_type: request.request_type, date: request.date });

    const empUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [request.employee_id]);
    if (empUser.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)`,
        [empUser.rows[0].id, "Request Recalled",
         `Your ${TYPE_LABELS[request.request_type] || request.request_type} request for ${request.date} has been recalled.`,
         "request_update", "/requests"]
      );
    }

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.approveManager = async (req, res) => {
  try {
    const { status, comment } = req.body;
    const ar = await pool.query("SELECT * FROM attendance_requests WHERE id = $1", [req.params.id]);
    if (ar.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    const request = ar.rows[0];

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Only pending requests can be reviewed by manager" });
    }

    const newStatus = status === "approved" ? "manager_approved" : "rejected";
    const result = await pool.query(
      `UPDATE attendance_requests
       SET manager_status = $1, manager_comment = $2, manager_approved_at = NOW(),
           manager_id = $3, status = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status, comment || null, req.user.id, newStatus, req.params.id]
    );

    const updated = result.rows[0];

    const empUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [request.employee_id]);
    if (empUser.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)`,
        [empUser.rows[0].id, "Request Update",
         `Your ${TYPE_LABELS[request.request_type] || request.request_type} request was ${status} by your manager.`,
         "request_update", "/requests"]
      );
    }

    if (status === "approved") {
      const emp = await pool.query("SELECT hr_id FROM employees WHERE id = $1", [request.employee_id]);
      const hrEmpId = emp.rows[0]?.hr_id;
      if (hrEmpId) {
        const hrUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [hrEmpId]);
        if (hrUser.rows.length > 0) {
          const empName = await pool.query("SELECT full_name FROM employees WHERE id = $1", [request.employee_id]);
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)`,
            [hrUser.rows[0].id, "Request Needs HR Approval",
             `${empName.rows[0]?.full_name || "An employee"}'s ${TYPE_LABELS[request.request_type] || request.request_type} request has been approved by the manager and needs your review.`,
             "approval", "/approvals"]
          );
        }
      }
    }

    await logAudit(req.user.id, `${status === "approved" ? "manager_approve" : "manager_reject"}_request`, req.params.id, { status, comment });

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.approveHR = async (req, res) => {
  try {
    const { status, comment } = req.body;
    const ar = await pool.query("SELECT * FROM attendance_requests WHERE id = $1", [req.params.id]);
    if (ar.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    const request = ar.rows[0];

    if (request.status !== "manager_approved") {
      return res.status(400).json({ error: "Only manager-approved requests can be reviewed by HR" });
    }

    const newStatus = status === "approved" ? "approved" : "rejected";
    const result = await pool.query(
      `UPDATE attendance_requests
       SET hr_status = $1, hr_comment = $2, hr_approved_at = NOW(),
           hr_id = $3, status = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status, comment || null, req.user.id, newStatus, req.params.id]
    );

    const updated = result.rows[0];

    if (newStatus === "approved" && request.date) {
      const noteText = request.location || TYPE_LABELS[request.request_type] || request.request_type;
      if (["missing_check_in", "missing_check_out", "forgotten_punch"].includes(request.request_type)) {
        await revertAttendanceSummary(request.employee_id, request.date);
        await pool.query(
          `UPDATE attendance_summary SET status = 'present', notes = $3
           WHERE employee_id = $1 AND date = $2`,
          [request.employee_id, request.date, noteText]
        );
      } else if (request.request_type === "overtime") {
        await pool.query(
          `INSERT INTO attendance_summary (employee_id, date, status, notes)
           VALUES ($1, $2, 'approved', $3)
           ON CONFLICT (employee_id, date) DO UPDATE SET status = 'approved', notes = $3`,
          [request.employee_id, request.date, "Overtime"]
        );
      } else {
        await pool.query(
          `INSERT INTO attendance_summary (employee_id, date, status, notes)
           VALUES ($1, $2, 'approved', $3)
           ON CONFLICT (employee_id, date) DO UPDATE SET status = 'approved', notes = $3`,
          [request.employee_id, request.date, noteText]
        );
      }
    }

    const empUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [request.employee_id]);
    if (empUser.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)`,
        [empUser.rows[0].id, "Request Finalized",
         `Your ${TYPE_LABELS[request.request_type] || request.request_type} request has been ${newStatus} by HR.`,
         "request_update", "/requests"]
      );
    }

    await logAudit(req.user.id, `${status === "approved" ? "hr_approve" : "hr_reject"}_request`, req.params.id, { status, comment });

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
