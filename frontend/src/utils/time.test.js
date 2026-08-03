import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBioTimeTimeValue, formatBioTimeDateValue, formatBioTimeDateTimeValue } from './time.js';

test('preserves BioTime wall-clock time for naive timestamps', () => {
  assert.equal(formatBioTimeTimeValue('2024-01-02T08:24:00'), '08:24');
  assert.equal(formatBioTimeTimeValue('2024-01-02 17:30:00'), '17:30');
});

test('passes through bare HH:MM report values unchanged', () => {
  assert.equal(formatBioTimeTimeValue('09:56'), '09:56');
  assert.equal(formatBioTimeTimeValue('16:35'), '16:35');
  assert.equal(formatBioTimeTimeValue(''), '');
  assert.equal(formatBioTimeTimeValue(null), '');
});

test('formats wall-clock date from naive date string', () => {
  assert.equal(formatBioTimeDateValue('2026-08-03'), '03 Aug 2026');
  assert.equal(formatBioTimeDateValue('2026-08-02T21:00:00.000Z'), '02 Aug 2026');
});

test('preserves BioTime wall-clock date-time for timezone aware values', () => {
  assert.equal(formatBioTimeDateTimeValue('2024-01-02T08:24:00.000Z'), '02 Jan 2024, 08:24');
  assert.equal(formatBioTimeDateTimeValue('2024-01-02T17:30:00+03:00'), '02 Jan 2024, 17:30');
  assert.equal(formatBioTimeDateTimeValue('2026-07-06 09:56:31'), '06 Jul 2026, 09:56');
  assert.equal(formatBioTimeDateTimeValue('2026-07-28 12:33:31.475377'), '28 Jul 2026, 12:33');
});
