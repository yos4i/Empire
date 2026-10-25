import { addWeeks } from 'date-fns';
import { ShiftSubmission } from '../../entities/ShiftSubmission';
import { SubmissionWindow } from '../../entities/SubmissionWindow';
import { ShiftSubmissionService } from '../../services/shiftSubmission';
import { DAYS } from '../../config/shifts';
import { toWeekStartISO, getDefaultWeekStart } from '../../utils/weekKey';

// Days offered as a "day off" choice.
export const SELECTABLE_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

// How many weeks ahead a soldier may submit for.
export const MAX_WEEK_OFFSET = 4;

// The default shift a soldier is assumed available for on every day that is
// NOT their day off. Morning is the standard shift (evening is by command only).
const DEFAULT_SHIFT = 'קריית_חינוך_בוקר';

// Build the days/shifts structure the admin panel + scheduler consume from a
// single chosen day-off: the off day is empty (unavailable), every other day
// gets the default morning shift.
const buildShiftsFromDayOff = (offDay) =>
  DAYS.reduce((acc, day) => {
    acc[day] = day === offDay ? [] : [DEFAULT_SHIFT];
    return acc;
  }, {});

// Recover the chosen day-off from a stored submission. Prefers the explicit
// `dayOff` field; falls back to "the one selectable day with no shifts".
export const deriveDayOff = (submission) => {
  if (!submission) return null;
  if (submission.dayOff && SELECTABLE_DAYS.includes(submission.dayOff)) {
    return submission.dayOff;
  }
  const days = submission.days || submission.shifts;
  if (!days) return null;
  const off = SELECTABLE_DAYS.find((d) => (days[d] || []).length === 0);
  return off || null;
};

/**
 * The week a soldier should be submitting for: the nearest week (from the
 * default week up to MAX_WEEK_OFFSET ahead) that the admin opened for
 * submissions. Returns { offset, open }; offset 0 / open false when nothing is open.
 */
export async function findSubmissionWeek() {
  const windows = await SubmissionWindow.list();
  const openWeeks = new Set(windows.filter((w) => w.is_open === true).map((w) => w.week_start));
  const base = getDefaultWeekStart();
  for (let offset = 0; offset <= MAX_WEEK_OFFSET; offset++) {
    if (openWeeks.has(toWeekStartISO(addWeeks(base, offset)))) return { offset, open: true };
  }
  return { offset: 0, open: false };
}

export const submissionWeekStart = (offset) => addWeeks(getDefaultWeekStart(), offset || 0);

/** Existing submission for a week — new collection first, then legacy. */
export async function loadDayOffSubmission(uid, weekStartStr) {
  const preferences = await ShiftSubmissionService.getPreferences(uid, weekStartStr);
  if (preferences) return preferences;
  const submissions = await ShiftSubmission.filter({ user_id: uid, week_start: weekStartStr });
  return submissions[0] || null;
}

export async function saveDayOff(user, weekStartStr, dayOff, notes) {
  const shifts = buildShiftsFromDayOff(dayOff);
  const userName = user.displayName || user.username || user.hebrew_name;

  // Method 1: new shift_preferences collection (admin view).
  await ShiftSubmissionService.submitPreferences(
    user.uid,
    userName,
    weekStartStr,
    shifts,
    {}, // no long-shift preferences in the day-off model
    notes
  );

  // Method 2: legacy shift_submissions collection (backward compat).
  const submissionData = {
    uid: user.uid,
    user_id: user.uid,
    soldier_id: user.uid,
    userName,
    week_start: weekStartStr,
    shifts,
    days: shifts,
    dayOff, // explicit day-off marker for clean round-trip
    notes,
  };

  const existingSubs = await ShiftSubmission.filter({ user_id: user.uid, week_start: weekStartStr });
  if (existingSubs.length > 0) {
    await ShiftSubmission.update(existingSubs[0].id, submissionData);
  } else {
    await ShiftSubmission.create(submissionData);
  }
}
