const pool = require("../config/db");

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

function parseWorkingDays(value) {
  if (value === null || value === undefined) return DEFAULT_WORKING_DAYS;
  const arr = String(value)
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return arr.length ? [...new Set(arr)].sort((a, b) => a - b) : DEFAULT_WORKING_DAYS;
}

async function getWorkingDays() {
  const res = await pool.query("SELECT value FROM settings WHERE key = 'working_days'");
  return parseWorkingDays(res.rows[0]?.value);
}

async function getWorkingDaysSet() {
  return new Set(await getWorkingDays());
}

function isWorkingDay(dow, workingDays) {
  return workingDays.includes(dow);
}

function dateKeyUTC(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function workingDayKeys(startKey, endKey, workingDays) {
  const days = workingDays || (await getWorkingDays());
  const [y1, m1, d1] = startKey.split("-").map(Number);
  const [y2, m2, d2] = endKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(y1, m1 - 1, d1));
  const end = new Date(Date.UTC(y2, m2 - 1, d2));
  const keys = [];
  while (cursor <= end) {
    if (isWorkingDay(cursor.getUTCDay(), days)) keys.push(dateKeyUTC(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

module.exports = {
  DEFAULT_WORKING_DAYS,
  parseWorkingDays,
  getWorkingDays,
  getWorkingDaysSet,
  isWorkingDay,
  workingDayKeys,
};
