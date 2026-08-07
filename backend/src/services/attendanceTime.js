function computeTotalHours(firstIn, lastOut) {
  if (!firstIn || !lastOut) return 0;

  const first = firstIn instanceof Date ? firstIn : new Date(firstIn);
  const last = lastOut instanceof Date ? lastOut : new Date(lastOut);

  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return 0;

  return Math.round(((last - first) / (1000 * 60 * 60)) * 100) / 100;
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
  normalizeAttendanceDaySummary,
};
