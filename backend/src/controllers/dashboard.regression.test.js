const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "report.controller.js"), "utf8");

test("dashboard uses the centralized attendance classifier", () => {
  const dashboard = source.slice(source.indexOf("exports.dashboardStats"));
  assert.match(dashboard, /getAttendanceRules\(\)/);
  assert.match(dashboard, /classifyAttendance\(/);
});

test("department-scoped dashboard query uses the supplied first SQL parameter", () => {
  const dashboard = source.slice(source.indexOf("exports.dashboardStats"));
  assert.match(dashboard, /empScope = " AND e\.department = ANY\(\$1\)"/);
  assert.doesNotMatch(dashboard, /empScope = " AND e\.department = ANY\(\$2\)"/);
});
