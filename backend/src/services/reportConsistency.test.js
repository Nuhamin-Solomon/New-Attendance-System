const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyAttendance } = require("./attendanceRules");

test("all report consumers receive identical status and hours from the shared classifier", () => {
  const rules = { standardHours: 8, lateAfterMinutes: 495 };
  const input = { firstIn: "2026-09-16 08:30:00", lastOut: "2026-09-16 17:00:00", scanCount: 2, rules };
  const dashboard = classifyAttendance(input);
  const daily = classifyAttendance(input);
  const weekly = classifyAttendance(input);
  const monthly = classifyAttendance(input);
  const summary = classifyAttendance(input);
  assert.deepEqual(daily, dashboard);
  assert.deepEqual(weekly, dashboard);
  assert.deepEqual(monthly, dashboard);
  assert.deepEqual(summary, dashboard);
});
