// Shared definitions for the parts workflow so the modal, calendar and job card agree.

export const PARTS_STATUS = {
  NONE: 'none',
  NEEDED: 'needed',
  ORDERED: 'ordered',
  RECEIVED: 'received',
};

export const PARTS_STATUS_OPTIONS = [
  { value: PARTS_STATUS.NONE, label: 'Not needed' },
  { value: PARTS_STATUS.NEEDED, label: 'Needed' },
  { value: PARTS_STATUS.ORDERED, label: 'Ordered' },
  { value: PARTS_STATUS.RECEIVED, label: 'Received' },
];

const VALID_STATUSES = PARTS_STATUS_OPTIONS.map((option) => option.value);

/**
 * Read the parts status off an appointment's details, defaulting to 'none' for
 * appointments created before parts tracking existed.
 * @param {object} details - The appointment's details object
 * @returns {string} One of the PARTS_STATUS values
 */
export const getPartsStatus = (details) => {
  const status = details?.partsStatus;
  return VALID_STATUSES.includes(status) ? status : PARTS_STATUS.NONE;
};

/**
 * Human readable label for a parts status.
 * @param {string} status - One of the PARTS_STATUS values
 * @returns {string} Label for display, or '' if the status is unknown
 */
export const getPartsStatusLabel = (status) => {
  const match = PARTS_STATUS_OPTIONS.find((option) => option.value === status);
  return match ? match.label : '';
};

/**
 * Convert a stored parts timestamp (Firestore Timestamp, Date, string or number)
 * into a locale string for display.
 * @param {*} value - The stored timestamp
 * @returns {string} Formatted date/time, or '' if there is nothing to show
 */
export const formatPartsTimestamp = (value) => {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};
