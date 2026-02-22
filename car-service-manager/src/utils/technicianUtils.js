import { firestore } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

// Cache for technicians to avoid repeated Firestore queries
let techniciansCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get all technicians for a given location
 * @param {string} locationSuffix - '_ennis' for Ennis site, '' for main site
 * @returns {Promise<Array>} Array of technician objects with id and name
 */
export const getTechnicians = async (locationSuffix = '') => {
  // Check if cache is still valid
  if (techniciansCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
    return techniciansCache;
  }

  try {
    const techniciansCollection = collection(firestore, `technicians${locationSuffix}`);
    const querySnapshot = await getDocs(techniciansCollection);
    const technicians = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by order field for display
    technicians.sort((a, b) => (a.order || 999) - (b.order || 999));
    
    // Update cache
    techniciansCache = technicians;
    cacheTimestamp = Date.now();
    
    return technicians;
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
  techniciansCache = null;
  cacheTimestamp = null;
};
