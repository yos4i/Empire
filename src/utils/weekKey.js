/**
 * Week key utility functions for consistent date handling
 */

/**
 * Convert a date to the week start ISO string (Sunday-based week)
 * @param {Date} date - Input date
 * @returns {string} Week start date in YYYY-MM-DD format
 */
export function toWeekStartISO(date) {
  const dt = new Date(date);
  const day = dt.getDay(); // 0=Sunday
  dt.setDate(dt.getDate() - day); // go to Sunday
  
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Get the next week start from today
 * @returns {string} Next week start in YYYY-MM-DD format
 */
export function getNextWeekStart() {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  return toWeekStartISO(nextWeek);
}

/**
 * Get current week start
 * @returns {string} Current week start in YYYY-MM-DD format
 */
export function getCurrentWeekStart() {
  return toWeekStartISO(new Date());
}

/**
 * Get default week start for soldier views
 * From Friday 7:00 AM onwards through the weekend, shows next week
 *
 * Week structure: Sunday - Saturday
 *
 * Example timeline (assuming week of Jan 1-7 is Sun-Sat):
 * - Sunday Jan 1: Shows week Jan 1-7 (current week)
 * - Monday Jan 2: Shows week Jan 1-7 (current week)
 * - Thursday Jan 5: Shows week Jan 1-7 (current week)
 * - Friday Jan 6 at 6:59 AM: Shows week Jan 1-7 (current week)
 * - Friday Jan 6 at 7:00 AM: Shows week Jan 8-14 (next week) ✅
 * - Saturday Jan 7: Shows week Jan 8-14 (next week)
 * - Sunday Jan 8: Shows week Jan 8-14 (current week - new week started)
 * - Thursday Jan 12: Shows week Jan 8-14 (current week)
 * - Friday Jan 13 at 7:00 AM: Shows week Jan 15-21 (next week) ✅
 *
 * @returns {Date} Week start date object
 */
export function getDefaultWeekStart() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
  const currentHour = today.getHours(); // 0-23

  // Check if we're in the "show next week" window:
  // Friday 7 AM onwards OR Saturday (but not Sunday, that's the start of the new week)
  const shouldShowNextWeek =
    (dayOfWeek === 5 && currentHour >= 7) || // Friday 7 AM or later
    (dayOfWeek === 6); // Saturday

  if (shouldShowNextWeek) {
    // Show next week's Sunday (7 days from current week's Sunday)
    const currentWeekSunday = new Date(today);
    currentWeekSunday.setDate(today.getDate() - today.getDay());

    const nextWeekSunday = new Date(currentWeekSunday);
    nextWeekSunday.setDate(currentWeekSunday.getDate() + 7);

    return nextWeekSunday;
  }

  // Otherwise, show current week (this week's Sunday)
  const currentWeekSunday = new Date(today);
  currentWeekSunday.setDate(today.getDate() - today.getDay());
  return currentWeekSunday;
}

/**
 * Get the end time for a long shift based on the day
 * Tuesday long shifts end at 16:15
 * All other days end at 15:30
 *
 * @param {string} day - Day name (e.g., "tuesday", "monday")
 * @returns {string} End time in HH:MM format
 */
export function getLongShiftEndTime(day) {
  return day === 'tuesday' ? '16:15' : '15:30';
}