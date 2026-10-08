const { officeTime, addMinutes } = require('./time');

/**
 * Status from the clock-in time, using the attendance rules:
 *   up to office_start + grace          -> PRESENT
 *   after that, up to late_threshold    -> LATE
 *   after late_threshold                -> HALF_DAY
 */
const classifyClockIn = (clockIn, rules) => {
  if (!rules) return 'PRESENT';
  const time = officeTime(new Date(clockIn));
  const onTimeUntil = addMinutes(rules.office_start_time, Number(rules.grace_period_minutes) || 0);
  if (time <= onTimeUntil) return 'PRESENT';
  if (time <= rules.late_threshold_time) return 'LATE';
  return 'HALF_DAY';
};

/**
 * Final status once hours worked are known: too few hours is always HALF_DAY,
 * otherwise the clock-in based status stands.
 */
const finalizeStatus = (clockInStatus, totalHours, rules) => {
  if (rules && totalHours < parseFloat(rules.half_day_min_hours)) return 'HALF_DAY';
  return clockInStatus;
};

module.exports = { classifyClockIn, finalizeStatus };
