import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBioTimeTimeValue, formatBioTimeDateTimeValue } from './time.js';

test('preserves BioTime wall-clock time for naive timestamps', () => {
  assert.equal(formatBioTimeTimeValue('2024-01-02T08:24:00'), '08:24');
  assert.equal(formatBioTimeTimeValue('2024-01-02 17:30:00'), '17:30');
});

test('preserves BioTime wall-clock date-time for timezone aware values', () => {
  assert.equal(formatBioTimeDateTimeValue('2024-01-02T08:24:00.000Z'), '02 Jan 2024, 08:24');
  assert.equal(formatBioTimeDateTimeValue('2024-01-02T17:30:00+03:00'), '02 Jan 2024, 17:30');
});
