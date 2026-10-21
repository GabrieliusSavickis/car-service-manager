// Irish working days: weekends and bank holidays. Shared so every path that
// places an appointment on a date agrees on what is bookable.

const sameDay = (a, b) => (
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate()
);

/**
 * Easter Sunday for a year, via the Computus algorithm.
 * @param {number} year - Four digit year
 * @returns {Date} Easter Sunday
 */
export const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const getFirstMonday = (year, month) => {
  const firstDay = new Date(year, month, 1);
  return new Date(year, month, 1 + ((8 - firstDay.getDay()) % 7));
};

const getLastMonday = (year, month) => {
  const lastDay = new Date(year, month + 1, 0);
  return new Date(year, month, lastDay.getDate() - ((lastDay.getDay() + 6) % 7));
};

/**
 * Every Irish bank holiday in a year, as dates.
 * @param {number} year - Four digit year
 * @returns {Array<{date: Date, name: string}>}
 */
export const getBankHolidays = (year) => {
  const easterMonday = getEasterDate(year);
  easterMonday.setDate(easterMonday.getDate() + 1);

  return [
    { date: new Date(year, 0, 1), name: "New Year's Day" },
    { date: getFirstMonday(year, 1), name: "St Brigid's Day" },
    { date: new Date(year, 2, 17), name: "St Patrick's Day" },
    { date: easterMonday, name: 'Easter Monday' },
    { date: getFirstMonday(year, 4), name: 'May bank holiday' },
    { date: getFirstMonday(year, 5), name: 'June bank holiday' },
    { date: getFirstMonday(year, 7), name: 'August bank holiday' },
    { date: getLastMonday(year, 9), name: 'October bank holiday' },
    { date: new Date(year, 11, 25), name: 'Christmas Day' },
    { date: new Date(year, 11, 26), name: "St Stephen's Day" },
  ];
};

/**
 * The bank holiday falling on a date, if any.
 * @param {Date} date - The date to check
 * @returns {string} The holiday name, or '' when it is not a bank holiday
 */
export const getBankHolidayName = (date) => {
  const match = getBankHolidays(date.getFullYear())
    .find((holiday) => sameDay(holiday.date, date));
  return match ? match.name : '';
};

/**
 * Whether appointments can be booked on a date.
 * @param {Date} date - The date to check
 * @returns {boolean} True for weekends and bank holidays
 */
export const isNonWorkingDay = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6 || getBankHolidayName(date) !== '';
};

/**
 * Why a date cannot be booked, for showing to whoever picked it.
 * @param {Date} date - The date to check
 * @returns {string} A reason, or '' when the date is bookable
 */
export const describeNonWorkingDay = (date) => {
  const holiday = getBankHolidayName(date);
  if (holiday) return holiday;

  const day = date.getDay();
  if (day === 0) return 'a Sunday';
  if (day === 6) return 'a Saturday';
  return '';
};

/**
 * The next bookable day after a date.
 * @param {Date} date - Starting date
 * @returns {Date} The next working day
 */
export const getNextWorkingDay = (date) => {
  const nextDay = new Date(date.getTime());
  nextDay.setDate(nextDay.getDate() + 1);

  // At most a week of weekends and holidays can ever stack up.
  let guard = 0;
  while (isNonWorkingDay(nextDay) && guard < 14) {
    nextDay.setDate(nextDay.getDate() + 1);
    guard += 1;
  }

  return nextDay;
};

/**
 * Read a date input's yyyy-mm-dd value as a local date, avoiding the UTC shift
 * that new Date('2026-10-26') introduces.
 * @param {string} value - A date input value
 * @returns {Date|null} The local date, or null when unparseable
 */
export const parseDateInputValue = (value) => {
  const [year, month, day] = (value || '').split('-').map(Number);
  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
