export function buildReportParams(base, { departments, employeeIds }) {
  const params = { ...base };
  if (departments && departments.length) params.departments = departments.join(",");
  if (employeeIds && employeeIds.length) params.employee_ids = employeeIds.join(",");
  return params;
}

export function activeFilterLabel(departments, employeeIds) {
  if (!departments?.length && !employeeIds?.length) return "";
  if (departments?.length && employeeIds?.length) {
    return `${departments.length} dept${departments.length === 1 ? "" : "s"}, ${employeeIds.length} emp${employeeIds.length === 1 ? "" : "s"}`;
  }
  if (departments?.length) {
    return departments.length === 1 ? departments[0] : `${departments.length} departments`;
  }
  return `${employeeIds.length} employee${employeeIds.length === 1 ? "" : "s"}`;
}
