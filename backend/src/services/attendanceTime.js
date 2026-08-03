// Parse a wall-clock timestamp value ("2026-07-06 09:56:31",
// "2026-07-06T09:56:31+03:00", or a Date) into a Date whose UTC fields hold the
// original wall-clock digits. Treating both bounds this way keeps duration math
// correct without applying any timezone offset.
function toWallClockDate(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds(),
    ));
  }

  if (typeof value !== "string") return new Date(NaN);

  const match = value
    .trim()
    .replace(" ", "T")
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?/);
  if (!match) return new Date(NaN);

  return new Date(Date.UTC(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10),
    parseInt(match[4], 10),
    parseInt(match[5], 10),
    match[6] ? parseInt(match[6], 10) : 0,
  ));
}

function computeTotalHours(firstIn, lastOut) {
  if (!firstIn || !lastOut) return 0;

  const first = toWallClockDate(firstIn);
  const last = toWallClockDate(lastOut);

  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return 0;

  return Math.round(((last - first) / (1000 * 60 * 60)) * 100) / 100;
}

// Format a wall-clock timestamp value as "HH:MM" preserving the literal digits.
function formatTimeHHMM(value) {
  if (!value) return "";

  const d = toWallClockDate(value);
  if (Number.isNaN(d.getTime())) return "";

  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function normalizeAttendanceDaySummary(row) {
  const totalHours = computeTotalHours(row.first_in, row.last_out);
  return {
    ...row,
    first_in: row.first_in || null,
    last_out: row.last_out || null,
    total_hours: totalHours,
  };
}

module.exports = {
  computeTotalHours,
  formatTimeHHMM,
  normalizeAttendanceDaySummary,
};
