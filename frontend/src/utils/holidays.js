/**
 * Shared holiday display logic for the Admin and Employee dashboards.
 *
 * Both dashboards consume the SAME data source: the backend `holidays` table,
 * returned as `holiday_label` / `holiday_name` on each attendance record.
 * This helper guarantees identical output on both sides and falls back to
 * "Holiday" when no holiday name is available.
 *
 * Example: September 11, 2026 -> "Enkutatash Holiday"
 *
 * Half-day holidays are classified as `half_day` (a half working day) and are
 * displayed as "½ half working day" everywhere.
 */
export function holidayBadgeText(status, record) {
  if (status === "half_day") return "½ half working day";
  if (status !== "holiday") {
    return (status || "no data").replace(/_/g, " ");
  }
  if (record && record.holiday_label) return record.holiday_label;
  if (record && record.holiday_name) return `${record.holiday_name} Holiday`;
  return "Holiday";
}

/**
 * Formats hours and, for half-day records, appends the " (½ day)" marker so
 * reports show the actual worked hours together with the half-day note.
 */
export function formatHours(hours, status, withUnit = true) {
  const core = `${(Number(hours) || 0).toFixed(1)}${withUnit ? "h" : ""}`;
  return status === "half_day" ? `${core} (½ day)` : core;
}