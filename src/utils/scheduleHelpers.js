import { addDays, format } from 'date-fns';
import {
  SHIFT_NAMES,
  SHIFT_REQUIREMENTS,
  DAY_END_TIMES,
  DAYS,
} from '../config/shifts';
import { getLongShiftEndTime } from './weekKey';
import { ShiftAssignment } from '../entities/ShiftAssignment';

// Per-day requirement & default-time overrides for a single shift cell.
// Single source of truth shared by `initializeSchedule` and the loadData rebuild loop.
export function getShiftRequirements(day, shiftKey) {
  const base = { ...(SHIFT_REQUIREMENTS[shiftKey] || {}) };

  if (shiftKey === 'קריית_חינוך_בוקר' && day === 'friday') {
    base.required = 12;
  }

  if (shiftKey.includes('בוקר')) {
    base.customStartTime = '07:00';
    base.customEndTime = DAY_END_TIMES[day];
  }

  return base;
}

// Resolve the actual start/end times for a shift cell.
// Prefers custom (per-day) hours, falls back to times parsed from the display name.
export function resolveShiftTimes(shiftData, shiftKey, dynamicNames = SHIFT_NAMES) {
  if (shiftData?.customStartTime && shiftData?.customEndTime) {
    return { start: shiftData.customStartTime, end: shiftData.customEndTime };
  }
  const display = dynamicNames?.[shiftKey] || SHIFT_NAMES[shiftKey] || '';
  const m = display.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
  return m ? { start: m[1], end: m[2] } : { start: '07:00', end: '13:30' };
}

// Build a single ShiftAssignment record ready for create()/bulkCreate().
export function buildAssignment({
  soldier,
  day,
  shiftKey,
  shiftData,
  weekStart,
  isLongShift,
  dynamicNames,
}) {
  const { start, end } = resolveShiftTimes(shiftData, shiftKey, dynamicNames);
  const dayDate = addDays(new Date(weekStart), DAYS.indexOf(day));
  const dateStr = format(dayDate, 'yyyy-MM-dd');

  return {
    soldier_id: soldier.uid || soldier.id,
    soldier_name:
      soldier.hebrew_name || soldier.displayName || soldier.full_name,
    date: dateStr,
    day_name: day,
    shift_type: shiftKey,
    shift_name: dynamicNames?.[shiftKey] || SHIFT_NAMES[shiftKey],
    start_time: start,
    end_time: isLongShift ? getLongShiftEndTime(day) : end,
    week_start: weekStart,
    status: 'assigned',
    isLongShift: !!isLongShift,
  };
}

// Re-fetch all assignments for a given week.
export async function reloadWeekAssignments(weekStart) {
  const weekEnd = format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd');
  return ShiftAssignment.filter({ start_date: weekStart, end_date: weekEnd });
}

// localStorage draft helpers.
// Drafts are admin-only; they never leave the admin's browser until "Publish" runs.
const DRAFT_PREFIX = 'schedule-draft:';

export function draftKey(weekStart) {
  return `${DRAFT_PREFIX}${weekStart}`;
}

export function readDraft(weekStart) {
  try {
    const raw = localStorage.getItem(draftKey(weekStart));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('readDraft: failed to parse draft', e);
    return null;
  }
}

export function writeDraft(weekStart, schedule) {
  try {
    localStorage.setItem(draftKey(weekStart), JSON.stringify(schedule));
    return true;
  } catch (e) {
    console.warn('writeDraft: failed to persist draft', e);
    return false;
  }
}

export function clearDraft(weekStart) {
  try {
    localStorage.removeItem(draftKey(weekStart));
  } catch (e) {
    console.warn('clearDraft: failed', e);
  }
}
