import { getLongShiftEndTime } from '../../utils/weekKey';
import { dayKeyFromDate } from '../../utils/days';

// Display helpers shared by the soldier screens.

export const shiftTitle = (assignment) =>
  (assignment.shift_display_name || assignment.shift_name || assignment.shift_type || 'משמרת')
    .replace(/_/g, ' ')
    .replace(/\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*/, '')
    .trim();

export const shiftEndTime = (assignment) =>
  assignment.isLongShift ? getLongShiftEndTime(dayKeyFromDate(assignment.date)) : assignment.end_time;

export const shiftTimeRange = (assignment) => {
  const end = shiftEndTime(assignment);
  if (!assignment.start_time && !end) return '';
  return `${assignment.start_time || '?'}–${end || '?'}`;
};

export const sortAssignments = (list) =>
  [...list].sort(
    (a, b) => (a.date || '').localeCompare(b.date || '') || (a.start_time || '').localeCompare(b.start_time || '')
  );
