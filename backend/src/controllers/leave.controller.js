const pool = require("../config/db");
const { getDepartmentFilter } = require("../utils/departmentFilter");
const { getWorkingDays } = require("../services/workingDays");

async function logAudit(userId, action, entityId, details) {
  await pool.query(
    "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, 'leave_request', $3, $4)",
    [userId, action, entityId, details ? JSON.stringify(details) : null]
  );
}

async function getLeaveDayCount(startDate, endDate) {
  const workingDays = await getWorkingDays();
  const s = new Date(startDate);
  const e = new Date(endDate);
  let count = 0;
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getUTCDay();
    if (workingDays.includes(dow)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count || 1;
}

async function markLeaveDates(employeeId, startDate, endDate) {
  const workingDays = await getWorkingDays();
  const s = new Date(startDate);
  const e = new Date(endDate);
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getUTCDay();
    if (workingDays.includes(dow)) {
      const dateStr = d.toISOString().split("T")[0];
      await pool.query(
        `INSERT INTO attendance_summary (employee_id, date, status, notes)
         VALUES ($1, $2, 'on_leave', 'Approved Leave')
         ON CONFLICT (employee_id, date) DO UPDATE SET status = 'on_leave', notes = 'Approved Leave', first_in = NULL, last_out = NULL, total_hours = 0`,
        [employeeId, dateStr]
      );
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

async function revertLeaveDates(employeeId, startDate, endDate) {
  const workingDays = await getWorkingDays();
  const s = new Date(startDate);
  const e = new Date(endDate);
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getUTCDay();
    if (workingDays.includes(dow)) {
      const dateStr = d.toISOString().split("T")[0];
      const logs = await pool.query(
        `SELECT MIN(scan_time) AS first_in, MAX(scan_time) AS last_out, COUNT(*) AS scan_count
         FROM attendance_logs
         WHERE employee_id = $1 AND DATE(scan_time) = $2`,
        [employeeId, dateStr]
      );
      const l = logs.rows[0];
      if (l && parseInt(l.scan_count) > 0) {
        const diffMs = new Date(l.last_out) - new Date(l.first_in);
        const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        const status = parseInt(l.scan_count) <= 1 ? "present_incomplete"
          : totalHours >= 1 ? "present" : "present_incomplete";
        await pool.query(
          `INSERT INTO attendance_summary (employee_id, date, first_in, last_out, total_hours, status, is_late, late_minutes)
           VALUES ($1, $2, $3, $4, $5, $6, false, 0)
           ON CONFLICT (employee_id, date) DO UPDATE SET first_in = $3, last_out = $4, total_hours = $5, status = $6, notes = NULL`,
          [employeeId, dateStr, l.first_in, l.last_out, totalHours, status]
        );
      } else {
        await pool.query(
          `INSERT INTO attendance_summary (employee_id, date, status)
           VALUES ($1, $2, 'absent')
           ON CONFLICT (employee_id, date) DO UPDATE SET status = 'absent', notes = NULL`,
          [employeeId, dateStr]
        );
      }
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

async function deductLeaveBalance(employeeId, leaveTypeId, startDate, endDate) {
  const days = await getLeaveDayCount(startDate, endDate);
  await pool.query(
    `UPDATE leave_balances SET used_days = used_days + $1, remaining_days = remaining_days - $1
     WHERE employee_id = $2 AND leave_type_id = $3 AND year = EXTRACT(YEAR FROM $4::date)`,
    [days, employeeId, leaveTypeId, startDate]
  );
}

async function restoreLeaveBalance(employeeId, leaveTypeId, startDate, endDate) {
  const days = await getLeaveDayCount(startDate, endDate);
  await pool.query(
    `UPDATE leave_balances SET used_days = GREATEST(used_days - $1, 0), remaining_days = remaining_days + $1
     WHERE employee_id = $2 AND leave_type_id = $3 AND year = EXTRACT(YEAR FROM $4::date)`,
    [days, employeeId, leaveTypeId, startDate]
  );
}

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
      SELECT lr.*, lt.name AS leave_type_name, e.full_name AS employee_name, e.department,
             mu.full_name AS manager_name, hu.full_name AS hr_name
      FROM leave_requests lr
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      JOIN employees e ON e.id = lr.employee_id
      LEFT JOIN users mu ON mu.id = lr.manager_id
      LEFT JOIN users hu ON hu.id = lr.hr_id
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
    } else {
      const deptFilter = getDepartmentFilter(req.user, idx);
      if (deptFilter.clause) {
        query += deptFilter.clause;
        params.push(deptFilter.value);
        idx = deptFilter.nextIdx;
      }
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

    const created = result.rows[0];
    const emp = await pool.query("SELECT manager_id, full_name FROM employees WHERE id = $1", [employee_id]);
    const managerId = emp.rows[0]?.manager_id;
    const empName = emp.rows[0]?.full_name || "An employee";

    if (managerId) {
      const mgrUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [managerId]);
      if (mgrUser.rows.length > 0) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)`,
          [mgrUser.rows[0].id, "New Leave Request",
           `${empName} submitted a leave request for your approval.`,
           "approval", "/leave"]
        );
      }
    }

    await logAudit(req.user.id, "create_leave", created.id, { leave_type_id, start_date, end_date, employee_id });

    res.status(201).json(created);
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
      `UPDATE leave_requests SET leave_type_id = $1, start_date = $2, end_date = $3, reason = $4,
       supporting_doc_url = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [leave_type_id || lr.rows[0].leave_type_id, start_date || lr.rows[0].start_date,
       end_date || lr.rows[0].end_date, reason ?? lr.rows[0].reason,
       supporting_doc_url ?? lr.rows[0].supporting_doc_url, req.params.id]
    );
    await logAudit(req.user.id, "update_leave", req.params.id, req.body);
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.cancel = async (req, res) => {
  try {
    const lr = await pool.query("SELECT * FROM leave_requests WHERE id = $1", [req.params.id]);
    if (lr.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    const request = lr.rows[0];
    if (req.user.role === "employee" && request.employee_id !== req.user.employee_id) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!["pending", "manager_approved"].includes(request.status)) {
      return res.status(400).json({ error: "Only pending or manager-approved requests can be cancelled" });
    }

    const result = await pool.query(
      `UPDATE leave_requests SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logAudit(req.user.id, "cancel_leave", req.params.id, { previous_status: request.status });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.recall = async (req, res) => {
  try {
    const lr = await pool.query("SELECT * FROM leave_requests WHERE id = $1", [req.params.id]);
    if (lr.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    const request = lr.rows[0];
    if (req.user.role === "employee" && request.employee_id !== req.user.employee_id) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (request.status !== "approved") {
      return res.status(400).json({ error: "Only approved requests can be recalled" });
    }

    const result = await pool.query(
      `UPDATE leave_requests SET status = 'recalled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await revertLeaveDates(request.employee_id, request.start_date, request.end_date);
    await restoreLeaveBalance(request.employee_id, request.leave_type_id, request.start_date, request.end_date);

    await logAudit(req.user.id, "recall_leave", req.params.id, { start_date: request.start_date, end_date: request.end_date });

    const empUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [request.employee_id]);
    if (empUser.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)`,
        [empUser.rows[0].id, "Leave Recalled",
         `Your leave request (${request.start_date} to ${request.end_date}) has been recalled.`,
         "leave", "/leave"]
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
    const lr = await pool.query("SELECT * FROM leave_requests WHERE id = $1", [req.params.id]);
    if (lr.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    const request = lr.rows[0];

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Only pending requests can be reviewed by manager" });
    }

    const newStatus = status === "approved" ? "manager_approved" : "rejected";
    const result = await pool.query(
      `UPDATE leave_requests
       SET manager_status = $1, manager_comment = $2, manager_approved_at = NOW(),
           manager_id = $3, status = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status, comment || null, req.user.id, newStatus, req.params.id]
    );

    const empUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [request.employee_id]);
    if (empUser.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)`,
        [empUser.rows[0].id, "Leave Update",
         `Your leave request was ${status} by your manager.`,
         "leave", "/leave"]
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
            [hrUser.rows[0].id, "Leave Needs HR Approval",
             `${empName.rows[0]?.full_name || "An employee"}'s leave request has been approved by the manager and needs your review.`,
             "approval", "/leave"]
          );
        }
      }
    }

    await logAudit(req.user.id, `${status === "approved" ? "manager_approve" : "manager_reject"}_leave`, req.params.id, { status, comment });

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.approveHR = async (req, res) => {
  try {
    const { status, comment } = req.body;
    const lr = await pool.query("SELECT * FROM leave_requests WHERE id = $1", [req.params.id]);
    if (lr.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    const request = lr.rows[0];

    if (request.status !== "manager_approved") {
      return res.status(400).json({ error: "Only manager-approved requests can be reviewed by HR" });
    }

    const newStatus = status === "approved" ? "approved" : "rejected";
    const result = await pool.query(
      `UPDATE leave_requests
       SET hr_status = $1, hr_comment = $2, hr_approved_at = NOW(),
           hr_id = $3, status = $4, approved_by = $5, approved_at = NOW(), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [status, comment || null, req.user.id, newStatus, req.user.id, req.params.id]
    );

    if (newStatus === "approved") {
      await markLeaveDates(request.employee_id, request.start_date, request.end_date);
      await deductLeaveBalance(request.employee_id, request.leave_type_id, request.start_date, request.end_date);
    }

    const empUser = await pool.query("SELECT id FROM users WHERE employee_id = $1", [request.employee_id]);
    if (empUser.rows.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)`,
        [empUser.rows[0].id, "Leave Finalized",
         `Your leave request has been ${newStatus} by HR.`,
         "leave", "/leave"]
      );
    }

    await logAudit(req.user.id, `${status === "approved" ? "hr_approve" : "hr_reject"}_leave`, req.params.id, { status, comment });

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.reject = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE leave_requests SET status = 'rejected', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Request not found" });
    await logAudit(req.user.id, "reject_leave", req.params.id, { comment: req.body.comment });
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
