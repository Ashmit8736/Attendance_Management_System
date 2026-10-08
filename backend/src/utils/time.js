const env = require('../config/env');

const TZ = env.OFFICE_TIMEZONE;

/**
 * Calendar date ("YYYY-MM-DD") of an instant in the office timezone.
 */
const officeDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/**
 * Wall-clock time ("HH:MM:SS") of an instant in the office timezone.
 */
const officeTime = (date = new Date()) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date);

/**
 * Add minutes to an "HH:MM[:SS]" string, capped at 23:59:59.
 */
const addMinutes = (timeStr, minutes) => {
  const [h, m, s = 0] = String(timeStr).split(':').map(Number);
  const total = Math.min(h * 3600 + m * 60 + s + minutes * 60, 24 * 3600 - 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
};

// Offset (ms) of the office timezone from UTC at a given instant
const officeOffsetMs = (date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

const NAIVE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parse a date-time string. A value with an explicit zone ("...Z", "+05:30") is taken
 * as-is; a zone-less value (what <input type="datetime-local"> sends) is read as
 * wall-clock time in the office timezone, independent of the server's own timezone.
 * Returns an Invalid Date if the string cannot be parsed.
 */
const parseOfficeDateTime = (value) => {
  const m = NAIVE_DATETIME.exec(String(value).trim());
  if (!m) return new Date(value);

  const [, y, mo, d, h, mi, s = '0'] = m;
  const guess = Date.UTC(+y, mo - 1, +d, +h, +mi, +s);
  const first = new Date(guess - officeOffsetMs(new Date(guess)));
  return new Date(guess - officeOffsetMs(first));
};

module.exports = { officeDate, officeTime, addMinutes, parseOfficeDateTime };
