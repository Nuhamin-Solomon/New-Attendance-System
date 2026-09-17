const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyAttendance } = require("./attendanceRules");

const rules = { standardHours: 8, lateAfterMinutes: 8 * 60 + 15 };

test("classifies a complete standard workday as present", () => {
  const result = classifyAttendance({
    firstIn: "2026-09-16 08:00:00", lastOut: "2026-09-16 17:00:00", scanCount: 2, rules,
  });
  assert.equal(result.status, "present");
  assert.equal(result.totalHours, 9);
  assert.equal(result.isLate, false);
});

test("does not mark short or one-scan days as present", () => {
  const shortDay = classifyAttendance({
    firstIn: "2026-09-16 08:00:00", lastOut: "2026-09-16 12:00:00", scanCount: 2, rules,
  });
  const singleScan = classifyAttendance({
    firstIn: "2026-09-16 08:00:00", lastOut: "2026-09-16 08:00:00", scanCount: 1, rules,
  });
  assert.equal(shortDay.status, "present_incomplete");
  assert.equal(singleScan.status, "present_incomplete");
});

test("calculates late arrivals from the configured threshold", () => {
  const result = classifyAttendance({
    firstIn: "2026-09-16 08:30:00", lastOut: "2026-09-16 17:00:00", scanCount: 2, rules,
  });
  assert.equal(result.isLate, true);
  assert.equal(result.lateMinutes, 15);
});

test("classifies no scan as absent and preserves approved leave", () => {
  assert.equal(classifyAttendance({ rules }).status, "absent");
  const leave = classifyAttendance({ rules, approvedStatus: "on_leave", approvedType: "Annual Leave" });
  assert.equal(leave.status, "on_leave");
  assert.equal(leave.approved, true);
  assert.equal(leave.approvedType, "Annual Leave");
});
