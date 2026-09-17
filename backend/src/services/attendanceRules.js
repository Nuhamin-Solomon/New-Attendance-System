const { computeTotalHours } = require("./attendanceTime");

function toMinutes(value, fallback) {
  const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : toMinutes(fallback, "08:00");
}

async function getAttendanceRules() {
  const pool = require("../config/db");
  const result = await pool.query(
    "SELECT key, value FROM settings WHERE key = ANY($1::text[])",
    [["working_hours_start", "late_threshold_minutes", "standard_working_hours"]]
  );
  const values = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
  return {
    standardHours: Math.max(0, Number(values.standard_working_hours || 8)),
    lateAfterMinutes: toMinutes(values.working_hours_start, "08:00") + Math.max(0, Number(values.late_threshold_minutes || 15)),
  };
}

function timeToMinutes(value) {
  const match = String(value || "").match(/(?:T|\s)(\d{2}):(\d{2})|^(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1] || match[3]) * 60 + Number(match[2] || match[4]);
}

function classifyAttendance({ firstIn, lastOut, scanCount = 0, rules, approvedStatus = null, approvedType = "" }) {
  if (approvedStatus === "approved" || approvedStatus === "on_leave" || approvedStatus === "leave") {
    return {
      totalHours: 0,
      status: approvedStatus,
      isLate: false,
      lateMinutes: 0,
      approved: true,
      approvedType,
    };
  }
  const scans = Number(scanCount) || 0;
  if (scans === 0 || !firstIn) {
    return { totalHours: 0, status: "absent", isLate: false, lateMinutes: 0, approved: false, approvedType: "" };
  }
  const totalHours = computeTotalHours(firstIn, lastOut);
  const missingCheckout = scans < 2 || !lastOut || firstIn === lastOut;
  const firstInMinutes = timeToMinutes(firstIn);
  const lateMinutes = !missingCheckout && firstInMinutes !== null
    ? Math.max(0, firstInMinutes - rules.lateAfterMinutes)
    : 0;
  return {
    totalHours,
    status: missingCheckout || totalHours < rules.standardHours ? "present_incomplete" : "present",
    isLate: lateMinutes > 0,
    lateMinutes,
    approved: false,
    approvedType: "",
  };
}

module.exports = { getAttendanceRules, classifyAttendance };
