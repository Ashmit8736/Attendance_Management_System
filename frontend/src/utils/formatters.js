/**
 * Format ISO date string into readable Date (e.g. Oct 8, 2026)
 */
export const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format ISO datetime string into readable 12-hour Time (e.g. 09:15 AM)
 */
export const formatTime = (timeString) => {
  if (!timeString) return '—';
  const date = new Date(timeString);
  if (isNaN(date.getTime())) {
    // If string is in format "HH:MM:SS"
    const parts = timeString.split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 -> 12
      return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }
    return timeString;
  }
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format hours decimal into readable string (e.g. "8.5 hrs" or "8h 30m")
 */
export const formatHours = (hours) => {
  if (hours === null || hours === undefined) return '0 hrs';
  const num = parseFloat(hours);
  const h = Math.floor(num);
  const m = Math.round((num - h) * 60);
  if (m === 0) return `${h} hrs`;
  return `${h}h ${m}m`;
};

const pad = (n) => String(n).padStart(2, '0');

/**
 * Value for <input type="date"> in the viewer's local time (e.g. 2026-10-09).
 * Local parts are used on purpose: toISOString() would shift the day for users ahead of UTC.
 */
export const toDateInputValue = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Value for <input type="datetime-local"> in the viewer's local time (e.g. 2026-10-09T09:05).
 */
export const toDateTimeInputValue = (value) => {
  const d = new Date(value);
  return `${toDateInputValue(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
