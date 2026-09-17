const test = require("node:test");
const assert = require("node:assert/strict");
const { buildEmployeeFilter } = require("./departmentFilter");

test("buildEmployeeFilter composes department and employee filters safely", () => {
  const filter = buildEmployeeFilter({ role: "admin" }, 1, ["Engineering"], [4, 9]);
  assert.equal(filter.clause, " AND e.department = ANY($1) AND e.id = ANY($2)");
  assert.deepEqual(filter.params, [["Engineering"], [4, 9]]);
});

test("buildEmployeeFilter restricts unassigned non-admin users", () => {
  const filter = buildEmployeeFilter({ role: "manager", assigned_departments: [] }, 2);
  assert.equal(filter.clause, " AND e.department = $2");
  assert.deepEqual(filter.params, ["__no_access__"]);
});
