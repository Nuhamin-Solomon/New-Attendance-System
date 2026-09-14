const pool = require("../config/db");

/**
 * Builds a SQL WHERE clause fragment that filters employees by the user's assigned departments.
 * - Admin: no filter (sees everything)
 * - Manager/HR with assigned_departments: filter by department names
 * - Manager/HR without assignments: no access (__none__ placeholder ensures 0 results)
 */
function getDepartmentFilter(user, idx) {
  if (user.role === "admin") {
    return { clause: "", value: null, nextIdx: idx };
  }

  if (user.assigned_departments && user.assigned_departments.length > 0) {
    const deptNames = user.assigned_departments.map((d) => d.department_name);
    return {
      clause: ` AND e.department = ANY($${idx})`,
      value: deptNames,
      nextIdx: idx + 1,
    };
  }

  return {
    clause: ` AND e.department = $${idx}`,
    value: "__no_access__",
    nextIdx: idx + 1,
  };
}

function parseList(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : String(value).split(",");
  return arr.map((v) => String(v).trim()).filter(Boolean);
}

function parseIdList(value) {
  const arr = parseList(value);
  return arr.map((v) => parseInt(v, 10)).filter((n) => Number.isFinite(n));
}

/**
 * Builds a WHERE fragment that composes role scoping with optional report-level filters.
 * - Always enforces the user's assigned departments (admins see everything).
 * - selectedDepartments: optional list of department names to restrict to.
 * - selectedEmployeeIds: optional list of employee ids to restrict to.
 * Returns { clause, params, nextIdx }. The clause (if any) must be appended to
 * the query's WHERE with the returned params pushed in order.
 */
function buildEmployeeFilter(user, idx, selectedDepartments = [], selectedEmployeeIds = []) {
  let clause = "";
  const params = [];
  let nextIdx = idx;

  if (user.role === "admin") {
    if (selectedDepartments.length > 0) {
      clause += ` AND e.department = ANY($${nextIdx})`;
      params.push(selectedDepartments);
      nextIdx++;
    }
  } else {
    const assigned = (user.assigned_departments || []).map((d) => d.department_name);
    if (assigned.length === 0) {
      clause += ` AND e.department = $${nextIdx}`;
      params.push("__no_access__");
      nextIdx++;
    } else {
      let allowed = assigned;
      if (selectedDepartments.length > 0) {
        allowed = assigned.filter((d) => selectedDepartments.includes(d));
        if (allowed.length === 0) allowed = ["__no_access__"];
      }
      clause += ` AND e.department = ANY($${nextIdx})`;
      params.push(allowed);
      nextIdx++;
    }
  }

  if (selectedEmployeeIds.length > 0) {
    clause += ` AND e.id = ANY($${nextIdx})`;
    params.push(selectedEmployeeIds);
    nextIdx++;
  }

  return { clause, params, nextIdx };
}

module.exports = { getDepartmentFilter, buildEmployeeFilter, parseList, parseIdList };
