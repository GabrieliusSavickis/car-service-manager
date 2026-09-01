// Shared definitions for mechanic unavailability so the modal, calendar and
// appointments page agree on reasons and on which hours an entry covers.

export const UNAVAILABILITY_REASONS = [
  'Holiday',
  'Sick Day',
  'Personal',
  'No Show',
];

// The bookable slots of a working day, matching the calendar grid.
export const UNAVAILABILITY_TIME_SLOTS = [
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00',
  '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00', '17:30',
];

// The clock time each slot above finishes at. 17:30 is the last bookable block
// but it runs until 18:00, so that is what an end time of 18:00 means.
export const UNAVAILABILITY_SLOT_END_TIMES = [
  '09:30', '10:00',
  '10:30', '11:00',
  '11:30', '12:00',
  '12:30',
  '14:00',
  '14:30', '15:00',
  '15:30', '16:00',
  '16:30', '17:00',
  '17:30', '18:00',
];

const LAST_INDEX = UNAVAILABILITY_TIME_SLOTS.length - 1;
const FIRST_SLOT = UNAVAILABILITY_TIME_SLOTS[0];
const LAST_END = UNAVAILABILITY_SLOT_END_TIMES[LAST_INDEX];

export const UNAVAILABILITY_COVERAGE = {
  FULL: 'full',
  CUSTOM: 'custom',
};

export const UNAVAILABILITY_COVERAGE_OPTIONS = [
  { value: UNAVAILABILITY_COVERAGE.FULL, label: 'Full day' },
  { value: UNAVAILABILITY_COVERAGE.CUSTOM, label: 'Custom hours' },
];

const startIndexOf = (time) => UNAVAILABILITY_TIME_SLOTS.indexOf(time);

// End times are stored as the time the mechanic is back, so '12:30' means the
// 12:00 block is the last one covered.
const endIndexOf = (time) => {
  const index = UNAVAILABILITY_SLOT_END_TIMES.indexOf(time);
  return index === -1 ? startIndexOf(time) : index;
};

/**
 * Resolve the hours an unavailability entry covers. Entries with no coverage
 * field are treated as full days.
 * @param {object} entry - An unavailability record
 * @returns {{coverage: string, startTime: string, endTime: string, startIndex: number, endIndex: number, isFullDay: boolean}}
 */
export const getEntryWindow = (entry) => {
  if (entry?.coverage === UNAVAILABILITY_COVERAGE.CUSTOM) {
    const parsedStart = startIndexOf(entry?.startTime);
    const startIndex = parsedStart === -1 ? 0 : parsedStart;

    // Guard against a missing end, or one stored before the start.
    const parsedEnd = endIndexOf(entry?.endTime);
    const endIndex = parsedEnd === -1 ? LAST_INDEX : Math.max(parsedEnd, startIndex);

    return {
      coverage: UNAVAILABILITY_COVERAGE.CUSTOM,
      startTime: UNAVAILABILITY_TIME_SLOTS[startIndex],
      endTime: UNAVAILABILITY_SLOT_END_TIMES[endIndex],
      startIndex,
      endIndex,
      isFullDay: startIndex === 0 && endIndex === LAST_INDEX,
    };
  }

  return {
    coverage: UNAVAILABILITY_COVERAGE.FULL,
    startTime: FIRST_SLOT,
    endTime: LAST_END,
    startIndex: 0,
    endIndex: LAST_INDEX,
    isFullDay: true,
  };
};

/**
 * Whether an entry blocks a given time slot.
 * @param {object} entry - An unavailability record
 * @param {string} time - A slot label such as '14:30'
 * @returns {boolean}
 */
export const entryCoversTime = (entry, time) => {
  const index = startIndexOf(time);
  if (index === -1) return false;

  const { startIndex, endIndex } = getEntryWindow(entry);
  return index >= startIndex && index <= endIndex;
};

/**
 * How many calendar slots an entry spans, inclusive of its start and end slots.
 * @param {object} entry - An unavailability record
 * @returns {number}
 */
export const getEntrySlotCount = (entry) => {
  const { startIndex, endIndex } = getEntryWindow(entry);
  return endIndex - startIndex + 1;
};

/**
 * Short description of the hours covered, for labels and warnings.
 * @param {object} entry - An unavailability record
 * @returns {string} e.g. 'Full day' or '09:00 - 12:30'
 */
export const describeEntryWindow = (entry) => {
  const { startTime, endTime, isFullDay } = getEntryWindow(entry);
  return isFullDay ? 'Full day' : `${startTime} - ${endTime}`;
};

/**
 * Whether a chosen custom range is usable, i.e. the end is not before the start.
 * @param {string} startTime - A slot label such as '09:00'
 * @param {string} endTime - An end time such as '12:30'
 * @returns {boolean}
 */
export const isCustomRangeValid = (startTime, endTime) => {
  const startIndex = startIndexOf(startTime);
  return startIndex !== -1 && endIndexOf(endTime) >= startIndex;
};
