const pool = require("../config/db");

function dateKeyUTC(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function getHolidayMap(startKey, endKey) {
  const res = await pool.query(
    `SELECT TO_CHAR(holiday_date, 'YYYY-MM-DD') AS d, name, day_type, notes
     FROM holidays
     WHERE holiday_date >= $1::date AND holiday_date <= $2::date
     ORDER BY holiday_date`,
    [startKey, endKey]
  );
  const map = {};
  for (const r of res.rows) {
    map[r.d] = { name: r.name, type: r.day_type, notes: r.notes || "" };
  }
  return map;
}

async function getHoliday(dateKey) {
  const res = await pool.query(
    `SELECT TO_CHAR(holiday_date, 'YYYY-MM-DD') AS d, name, day_type, notes
     FROM holidays
     WHERE holiday_date = $1::date`,
    [dateKey]
  );
  if (res.rows.length === 0) return null;
  return { name: res.rows[0].name, type: res.rows[0].day_type, notes: res.rows[0].notes || "" };
}

/**
 * Builds a calendar for [startKey, endKey].
 *
 * For every date in the range it decides:
 *  - open:  the office is open -> a normal expected working day
 *           (a configured weekday that is NOT a full holiday,
 *            a half-day holiday -> employees work a required half,
 *            or a special working day such as a Saturday make-up day).
 *  - holiday: a 2026 calendar entry (full / half / special), or null.
 *
 * Returns { days, holidays, openDayCount }.
 *  - days[i] = { key, dow, open, holiday }
 *  - openDayCount = number of open days -> the working-day denominator
 *    (full holidays are excluded so they never reduce the attendance %;
 *     half-day holidays are open because they are half working days).
 */
async function buildCalendar(startKey, endKey, workingDays) {
  const holidays = await getHolidayMap(startKey, endKey);
  const days = [];
  const [y1, m1, d1] = startKey.split("-").map(Number);
  const [y2, m2, d2] = endKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(y1, m1 - 1, d1));
  const end = new Date(Date.UTC(y2, m2 - 1, d2));
  while (cursor <= end) {
    const key = dateKeyUTC(cursor);
    const holiday = holidays[key] || null;
    const dow = cursor.getUTCDay();
    const type = holiday ? holiday.type : null;
    const open = type === "special" || type === "half" || (workingDays.includes(dow) && type !== "full");
    days.push({ key, dow, open, holiday });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const openDayCount = days.filter((d) => d.open).length;
  return { days, holidays, openDayCount };
}

function holidayTypeLabel(type) {
  if (type === "half") return "Half-Day Holiday";
  if (type === "special") return "Special Working Day";
  return "Holiday";
}

/**
 * User-facing holiday label. Derived from the holidays table (single source),
 * formatted so every screen shows the actual holiday name:
 *   full   -> "Enkutatash Holiday"
 *   half   -> "Half-Day Holiday: Enkutatash Eve"
 *   special-> "Special Working Day: Enkutatash Make-up Day"
 * Falls back to "Holiday" / type label when no name is available.
 */
function holidayDisplayLabel(holiday) {
  if (!holiday) return "";
  const name = holiday.name || "";
  if (holiday.type === "half") return name ? `Half-Day Holiday: ${name}` : "Half-Day Holiday";
  if (holiday.type === "special") return name ? `Special Working Day: ${name}` : "Special Working Day";
  return name ? `${name} Holiday` : "Holiday";
}

module.exports = { buildCalendar, getHolidayMap, getHoliday, holidayTypeLabel, holidayDisplayLabel };