// Utilities for normalizing and parsing shift preferences data

export const WEEKDAYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 
  'thursday', 'friday', 'saturday'
];

export const WEEKDAYS_HE = [
  'ראשון', 'שני', 'שלישי', 'רביעי', 
  'חמישי', 'שישי', 'שבת'
];

/**
 * Parse a slot string like "1930_1530_ערב" or "1430_07_בוקר"
 * @param {string} raw - Raw slot string
 * @returns {Object} Parsed slot object
 */
export function parseSlot(raw) {
  if (!raw || typeof raw !== 'string') {
    return { raw: raw || '', start: '', end: '', label: '' };
  }

  const parts = String(raw).split('_');
  
  // Handle new format like "1330_07_בוקר"
  if (parts.length >= 3) {
    const start = parts[1];
    const end = parts[0];
    const label = parts[2];
    return {
      raw,
      start: start.padStart(4, '0'), // Ensure 4 digits
      end,
      label
    };
  }
  
  return { raw, start: '', end: '', label: parts[0] || '' };
}

/**
 * Format time string for display (e.g., "1530" -> "15:30")
 * @param {string} time - Time string like "1530"
 * @returns {string} Formatted time like "15:30"
 */
export function formatTime(time) {
  if (!time || time.length !== 4) return time;
  return `${time.slice(0, 2)}:${time.slice(2)}`;
}

/**
 * Get display text for a parsed slot
 * @param {Object} slot - Parsed slot object
 * @returns {string} Display text like "בוקר (07:00-14:30)"
 */
export function getSlotDisplayText(slot) {
  if (!slot || !slot.label) return slot?.raw || '';
  
  const { start, end, label } = slot;
  
  if (start && end) {
    return `${label} (${formatTime(start)}-${formatTime(end)})`;
  } else if (start) {
    return `${label} (${formatTime(start)})`;
  } else {
    return label;
  }
}

/**
 * Normalize a raw submission document to a consistent format
 * Handles both legacy (days at root) and new (shifts object) shapes
 * @param {Object} rawSubmission - Raw Firestore document data
 * @returns {Object} Normalized submission object
 */
export function normalizeSubmission(rawSubmission) {
  if (!rawSubmission) {
    return null;
  }

  const days = {};
  
  // Initialize all weekdays with empty arrays
  WEEKDAYS.forEach(day => {
    days[day] = [];
  });

  // Prefer new shape (shifts object), fallback to legacy (days at root)
  const sourceData = rawSubmission.shifts ?? rawSubmission;

  // Process each weekday, handling missing or invalid data safely
  WEEKDAYS.forEach(day => {
    const dayData = sourceData[day];
    if (Array.isArray(dayData)) {
      days[day] = dayData.map(slot => parseSlot(slot)).filter(slot => slot.raw);
    } else if (typeof dayData === 'string') {
      // Handle case where day data is a single string instead of array
      days[day] = [parseSlot(dayData)].filter(slot => slot.raw);
    }
    // If dayData is undefined, null, or other invalid type, keep empty array
  });

  return {
    id: rawSubmission.id || '',
    uid: String(rawSubmission.uid || ''), // Used for join with roster
    userId: String(rawSubmission.user_id || ''), // Legacy/external ID
    userName: rawSubmission.user_name || '',
    weekStart: rawSubmission.week_start || '',
    updatedAt: rawSubmission.updated_at?.toDate ? rawSubmission.updated_at.toDate() : new Date(rawSubmission.updated_at || Date.now()),
    days
  };
}

/**
 * Check if a submission has any preferences
 * @param {Object} normalizedSubmission - Normalized submission object
 * @returns {boolean} True if has any preferences
 */
export function hasAnyPreferences(normalizedSubmission) {
  if (!normalizedSubmission || !normalizedSubmission.days) return false;
  
  return WEEKDAYS.some(day => 
    normalizedSubmission.days[day] && normalizedSubmission.days[day].length > 0
  );
}

/**
 * Get total number of shifts for a submission
 * @param {Object} normalizedSubmission - Normalized submission object
 * @returns {number} Total number of shifts
 */
export function getTotalShifts(normalizedSubmission) {
  if (!normalizedSubmission || !normalizedSubmission.days) return 0;
  
  return WEEKDAYS.reduce((total, day) => {
    return total + (normalizedSubmission.days[day]?.length || 0);
  }, 0);
}

/**
 * Group submissions by user and return latest for each user
 * @param {Array} rawSubmissions - Array of raw submission documents
 * @returns {Array} Array of normalized submissions (latest per user)
 */
export function groupSubmissionsByUser(rawSubmissions) {
  if (!Array.isArray(rawSubmissions)) return [];

  const userSubmissions = {};
  
  rawSubmissions.forEach(raw => {
    const normalized = normalizeSubmission(raw);
    if (!normalized || !normalized.userId) return;
    
    const existing = userSubmissions[normalized.userId];
    if (!existing || normalized.updatedAt > existing.updatedAt) {
      userSubmissions[normalized.userId] = normalized;
    }
  });
  
  return Object.values(userSubmissions).sort((a, b) => 
    (a.userName || '').localeCompare(b.userName || '')
  );
}