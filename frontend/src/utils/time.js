export const BIO_TIME_TIMEZONE = 'Africa/Nairobi';

function parseBioTimeParts(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
      hour: value.getUTCHours(),
      minute: value.getUTCMinutes(),
      second: value.getUTCSeconds(),
    };
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/);
  if (!match) return null;

  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
    hour: match[4] ? parseInt(match[4], 10) : null,
    minute: match[5] ? parseInt(match[5], 10) : null,
    second: match[6] ? parseInt(match[6], 10) : 0,
  };
}

export function formatBioTimeTimeValue(value) {
  if (typeof value === 'string') {
    const bare = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{1,2}))?$/);
    if (bare) return `${String(bare[1]).padStart(2, '0')}:${bare[2]}`;
  }

  const parts = parseBioTimeParts(value);
  if (!parts || parts.hour === null || parts.minute === null) return '';

  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function formatBioTimeDateValue(value) {
  const parts = parseBioTimeParts(value);
  if (!parts) return '';

  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return utcDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatBioTimeDateTimeValue(value) {
  const parts = parseBioTimeParts(value);
  if (!parts) return '';

  const utcDate = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  ));

  return utcDate.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

export const parseBioTimeTimestamp = parseBioTimeParts;
