// Shared definitions for mechanic unavailability so the modal, calendar and
// appointments page agree on reasons and on which hours an entry covers.
//
// Which slots exist depends on the garage and the day, because Ennis moved its
// lunch hour. Every function here therefore works against a timetable from
// utils/timetable rather than a fixed list, and tolerates an entry saved under
// a lunch hour that has since changed.

import { timeToMinutes } from './timetable';

export const UNAVAILABILITY_REASONS = [
  'Holiday',
  'Sick Day',
  'Personal',
  'No Show',
];

export const UNAVAILABILITY_COVERAGE = {
  FULL: 'full',
  CUSTOM: 'custom',
};

export const UNAVAILABILITY_COVERAGE_OPTIONS = [
  { value: UNAVAILABILITY_COVERAGE.FULL, label: 'Full day' },
  { value: UNAVAILABILITY_COVERAGE.CUSTOM, label: 'Custom hours' },
];

/**
 * Which slot a stored start time refers to. An exact match wins; a time that is
 * no longer bookable because lunch has moved lands on the next real slot rather
 * than silently resetting to the start of the day.
 * @param {string} time - A slot label such as '14:30'
 * @param {object} timetable - From getTimetable()
 * @returns {number} Slot index, or -1 when it is past the end of the day
 */
const startIndexOf = (time, timetable) => {
  const exact = timetable.slots.indexOf(time);
  if (exact !== -1) return exact;

  const target = timeToMinutes(time);
  if (target === null) return -1;
  return timetable.slots.findIndex((slot) => timeToMinutes(slot) >= target);
};

/**
 * Which slot a stored end time refers to. End times are stored as the time the
 * mechanic is back, so '12:30' means the 12:00 block is the last one covered.
 * @param {string} time - An end time such as '12:30'
 * @param {object} timetable - From getTimetable()
 * @returns {number} Slot index, or -1 when nothing finishes by then
 */
const endIndexOf = (time, timetable) => {
  const exact = timetable.slotEndTimes.indexOf(time);
  if (exact !== -1) return exact;

  // Older entries stored the end as a slot start, meaning that slot is covered.
  const asSlot = timetable.slots.indexOf(time);
  if (asSlot !== -1) return asSlot;

  // Not in this day's timetable at all, so lunch has moved since the entry was
  // saved. Take the last slot finishing by then, which keeps a half day a half
  // day instead of widening it to the whole day.
  const target = timeToMinutes(time);
  if (target === null) return -1;

  for (let index = timetable.slotEndTimes.length - 1; index >= 0; index -= 1) {
    if (timeToMinutes(timetable.slotEndTimes[index]) <= target) return index;
  }
  return -1;
};

/**
 * Resolve the hours an unavailability entry covers on a given day. Entries with
 * no coverage field are treated as full days.
 * @param {object} entry - An unavailability record
 * @param {object} timetable - From getTimetable()
 * @returns {{coverage: string, startTime: string, endTime: string, startIndex: number, endIndex: number, isFullDay: boolean}}
 */
export const getEntryWindow = (entry, timetable) => {
  const lastIndex = timetable.slots.length - 1;

  if (entry?.coverage === UNAVAILABILITY_COVERAGE.CUSTOM) {
    const parsedStart = startIndexOf(entry?.startTime, timetable);
    const startIndex = parsedStart === -1 ? 0 : parsedStart;

    // Guard against a missing end, or one stored before the start.
    const parsedEnd = endIndexOf(entry?.endTime, timetable);
    const endIndex = parsedEnd === -1 ? lastIndex : Math.max(parsedEnd, startIndex);

    return {
      coverage: UNAVAILABILITY_COVERAGE.CUSTOM,
      startTime: timetable.slots[startIndex],
      endTime: timetable.slotEndTimes[endIndex],
      startIndex,
      endIndex,
      isFullDay: startIndex === 0 && endIndex === lastIndex,
    };
  }

  return {
    coverage: UNAVAILABILITY_COVERAGE.FULL,
    startTime: timetable.slots[0],
    endTime: timetable.slotEndTimes[lastIndex],
    startIndex: 0,
    endIndex: lastIndex,
    isFullDay: true,
  };
};

/**
 * Whether an entry blocks a given time slot.
 * @param {object} entry - An unavailability record
 * @param {string} time - A slot label such as '14:30'
 * @param {object} timetable - From getTimetable()
 * @returns {boolean}
 */
export const entryCoversTime = (entry, time, timetable) => {
  const index = timetable.slots.indexOf(time);
  if (index === -1) return false;

  const { startIndex, endIndex } = getEntryWindow(entry, timetable);
  return index >= startIndex && index <= endIndex;
};

/**
 * How many calendar slots an entry spans, inclusive of its start and end slots.
 * @param {object} entry - An unavailability record
 * @param {object} timetable - From getTimetable()
 * @returns {number}
 */
export const getEntrySlotCount = (entry, timetable) => {
  const { startIndex, endIndex } = getEntryWindow(entry, timetable);
  return endIndex - startIndex + 1;
};

/**
 * Short description of the hours covered, for labels and warnings.
 * @param {object} entry - An unavailability record
 * @param {object} timetable - From getTimetable()
 * @returns {string} e.g. 'Full day' or '09:00 - 12:30'
 */
export const describeEntryWindow = (entry, timetable) => {
  const { startTime, endTime, isFullDay } = getEntryWindow(entry, timetable);
  return isFullDay ? 'Full day' : `${startTime} - ${endTime}`;
};

/**
 * Whether a chosen custom range is usable, i.e. the end is not before the start.
 * @param {string} startTime - A slot label such as '09:00'
 * @param {string} endTime - An end time such as '12:30'
 * @param {object} timetable - From getTimetable()
 * @returns {boolean}
 */
export const isCustomRangeValid = (startTime, endTime, timetable) => {
  const startIndex = startIndexOf(startTime, timetable);
  return startIndex !== -1 && endIndexOf(endTime, timetable) >= startIndex;
};
