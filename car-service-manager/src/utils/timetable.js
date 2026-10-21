// The bookable half hour slots of a working day.
//
// Lunch is the only thing that differs between the two garages, and it decides
// which slots can be booked - so the day is generated from the lunch hour
// rather than listed out by hand. Ennis moved its lunch later, so the hour is
// also a function of the date: anything already in the diary keeps the hour it
// was booked under, and nothing has to be shifted.

import { LOCATION_KEYS } from './location';

export const DAY_START = '09:00';
export const DAY_END = '18:00';
export const SLOT_MINUTES = 30;

/**
 * Each garage's lunch hour, oldest first. 'from' is the first day an hour
 * applies to; null reaches as far back as the records go. To change a lunch
 * hour, add an entry with the date it starts - earlier days are untouched.
 */
export const LUNCH_SCHEDULE = {
  [LOCATION_KEYS.MAIN]: [
    { from: null, start: '12:30', end: '13:30' },
  ],
  [LOCATION_KEYS.ENNIS]: [
    { from: null, start: '12:30', end: '13:30' },
    // Mon 2 Nov 2026. Checked first: no Ennis job was booked at 13:30 on or
    // after this date, so the change needs no migration.
    { from: new Date(2026, 10, 2), start: '13:00', end: '14:00' },
  ],
};

/**
 * Minutes past midnight for a 'HH:MM' label.
 * @param {string} time - A clock time such as '13:30'
 * @returns {number|null} Minutes past midnight, or null when unreadable
 */
export const timeToMinutes = (time) => {
  const [hours, minutes] = (time || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
};

const toMinutes = (time) => timeToMinutes(time) ?? 0;

const toTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

// Midnight local, so a lunch change takes effect for the whole of its first day
// whatever time of day the comparison happens to run at.
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * The lunch hour in force at a garage on a date.
 * @param {string} locationKey - 'main' or 'ennis'
 * @param {Date} date - The day being looked at
 * @returns {{start: string, end: string}} Lunch start and end, e.g. 12:30 to 13:30
 */
export const getLunchHour = (locationKey, date) => {
  const schedule = LUNCH_SCHEDULE[locationKey] || LUNCH_SCHEDULE[LOCATION_KEYS.MAIN];
  const day = date instanceof Date && !Number.isNaN(date.getTime())
    ? startOfDay(date).getTime()
    : null;

  // Last entry that has come into effect. An unreadable date falls back to the
  // oldest hour, which is what every existing record was booked under.
  let current = schedule[0];
  schedule.forEach((entry) => {
    if (entry.from === null) return;
    if (day !== null && startOfDay(entry.from).getTime() <= day) current = entry;
  });

  return { start: current.start, end: current.end };
};

const buildTimetable = (lunchStart, lunchEnd) => {
  const dayStart = toMinutes(DAY_START);
  const dayEnd = toMinutes(DAY_END);
  const lunchFrom = toMinutes(lunchStart);
  const lunchTo = toMinutes(lunchEnd);

  const slots = [];
  const slotEndTimes = [];
  let lunchAfterIndex = -1;

  for (let start = dayStart; start + SLOT_MINUTES <= dayEnd; start += SLOT_MINUTES) {
    const end = start + SLOT_MINUTES;

    // Drop any slot that runs into lunch.
    if (start < lunchTo && end > lunchFrom) continue;

    slots.push(toTime(start));
    slotEndTimes.push(toTime(end));

    // The slot the lunch break follows, so the divider lands in one place only.
    if (end === lunchFrom) lunchAfterIndex = slots.length - 1;
  }

  return {
    slots,
    slotEndTimes,
    lunchStart,
    lunchEnd,
    lunchAfterIndex,
  };
};

// Built once per lunch hour. Keeping the identity stable matters: these arrays
// end up in React dependency lists.
const cache = new Map();

/**
 * The bookable slots for a garage on a date, with the lunch break positioned
 * for whichever hour applied that day.
 * @param {string} locationKey - 'main' or 'ennis'
 * @param {Date} date - The day being shown
 * @returns {{slots: Array<string>, slotEndTimes: Array<string>, lunchStart: string, lunchEnd: string, lunchAfterIndex: number}}
 */
export const getTimetable = (locationKey, date) => {
  const { start, end } = getLunchHour(locationKey, date);
  const key = `${start}|${end}`;

  if (!cache.has(key)) cache.set(key, buildTimetable(start, end));
  return cache.get(key);
};
