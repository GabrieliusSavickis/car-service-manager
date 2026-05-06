import { firestore } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

// Cache for technicians to avoid repeated Firestore queries
const techniciansCacheByLocation = new Map();
const cacheTimestampByLocation = new Map();
const techniciansInFlightByLocation = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get all technicians for a given location
 * @param {string} locationSuffix - '_ennis' for Ennis site, '' for main site
 * @returns {Promise<Array>} Array of technician objects with id and name
 */
export const getTechnicians = async (locationSuffix = '') => {
  const cacheKey = locationSuffix || 'default';

  // Check if cache is still valid
  const cachedTechnicians = techniciansCacheByLocation.get(cacheKey);
  const cacheTimestamp = cacheTimestampByLocation.get(cacheKey);
  if (cachedTechnicians && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
    return cachedTechnicians;
  }

  // Deduplicate concurrent requests so one refresh only triggers one Firestore read.
  const inFlightPromise = techniciansInFlightByLocation.get(cacheKey);
  if (inFlightPromise) {
    return inFlightPromise;
  }

  try {
    const loadPromise = (async () => {
      const techniciansCollection = collection(firestore, `technicians${locationSuffix}`);
      const querySnapshot = await getDocs(techniciansCollection);
      const technicians = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by order field for display
      technicians.sort((a, b) => (a.order || 999) - (b.order || 999));

      // Update cache
      techniciansCacheByLocation.set(cacheKey, technicians);
      cacheTimestampByLocation.set(cacheKey, Date.now());

      return technicians;
    })();

    techniciansInFlightByLocation.set(cacheKey, loadPromise);

    try {
      return await loadPromise;
    } finally {
      techniciansInFlightByLocation.delete(cacheKey);
    }
  } catch (error) {
    console.error('Error fetching technicians:', error);
    return [];
  }
};

/**
 * Get technician name by ID
 * @param {string} technicianId - The technician's ID
 * @param {string} locationSuffix - '_ennis' for Ennis site, '' for main site
 * @returns {Promise<string>} Technician name or 'Unknown' if not found
 */
export const getTechnicianName = async (technicianId, locationSuffix = '') => {
  try {
    const technicians = await getTechnicians(locationSuffix);
    const technician = technicians.find(t => t.id === technicianId);
    return technician ? technician.name : 'Unknown';
  } catch (error) {
    console.error('Error getting technician name:', error);
    return 'Unknown';
  }
};

/**
 * Get technician ID by name (useful for migration)
 * @param {string} name - The technician's name
 * @param {string} locationSuffix - '_ennis' for Ennis site, '' for main site
 * @returns {Promise<string|null>} Technician ID or null if not found
 */
export const getTechnicianIdByName = async (name, locationSuffix = '') => {
  try {
    const technicians = await getTechnicians(locationSuffix);
    const technician = technicians.find(t => t.name === name);
    return technician ? technician.id : null;
  } catch (error) {
    console.error('Error getting technician ID:', error);
    return null;
  }
};

/**
 * Clear the technicians cache (call this when technicians are updated)
 */
export const clearTechniciansCache = () => {
  techniciansCacheByLocation.clear();
  cacheTimestampByLocation.clear();
  techniciansInFlightByLocation.clear();
};
