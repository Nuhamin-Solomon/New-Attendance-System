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

module.exports = { getDepartmentFilter };
