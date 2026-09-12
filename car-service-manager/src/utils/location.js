// Which garage this build is serving, derived from the hostname the same way
// the rest of the app does it.

export const LOCATION_KEYS = {
  MAIN: 'main',
  ENNIS: 'ennis',
};

export const LOCATION_LABELS = {
  [LOCATION_KEYS.MAIN]: 'Kerry',
  [LOCATION_KEYS.ENNIS]: 'Ennis',
};

export const LOCATION_OPTIONS = [
  { value: LOCATION_KEYS.MAIN, label: LOCATION_LABELS[LOCATION_KEYS.MAIN] },
  { value: LOCATION_KEYS.ENNIS, label: LOCATION_LABELS[LOCATION_KEYS.ENNIS] },
];

/**
 * @returns {string} '_ennis' for the Ennis site, '' for the main (Kerry) site
 */
export const getLocationSuffix = () => {
  const hostname = window.location.hostname;
  return hostname.includes('asgennislive.ie') ? '_ennis' : '';
};

/**
 * @returns {string} 'ennis' or 'main'
 */
export const getLocationKey = () => (
  getLocationSuffix() === '_ennis' ? LOCATION_KEYS.ENNIS : LOCATION_KEYS.MAIN
);

/**
 * @param {string} key - A location key
 * @returns {string} Display name for the garage
 */
export const getLocationLabel = (key) => LOCATION_LABELS[key] || key || 'Unknown';
