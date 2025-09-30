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