// Per-weekday slot templates for the daily auto-scheduler.
//
// Each entry encodes the SHAPE of a day — which locations get covered, at
// which time intervals, and how many bodies each interval needs. The actual
// people are picked by the solver at runtime; nothing in this file references
// a real staff member.
//
// Times are 24-hour "HH:MM". `end` is exclusive when computing duration but
// is rendered verbatim in the UI. Reinforcement (תגבור) slots are normal
// slots with `isReinforcement: true` and are filled after primary slots.
// "*כולם*" slots set `everyone: true` and `required: 0`; the solver fills
// them with every staff member who happens to be free at that time.

import type { DayOfWeek, DayTemplate, LocationId, ShiftSlot } from '../types/scheduling';

interface SlotInit {
  loc: LocationId;
  start: string;
  end: string;
  required: number;
  isReinforcement?: boolean;
  everyone?: boolean;
  label?: string;
}

const makeSlot = (init: SlotInit, idx: number, day: DayOfWeek): ShiftSlot => ({
  id: `${day}-${init.loc}-${init.start.replace(':', '')}-${init.end.replace(':', '')}-${idx}`,
  location: init.loc,
  start: init.start,
  end: init.end,
  required: init.required,
  isReinforcement: !!init.isReinforcement,
  everyone: !!init.everyone,
  label: init.label,
});

const buildDay = (
  day: DayOfWeek,
  slots: SlotInit[],
  specialStateQuotas: DayTemplate['specialStateQuotas']
): DayTemplate => ({
  day,
  slots: slots.map((s, i) => makeSlot(s, i, day)),
  specialStateQuotas,
});

// ============================================================================
// Sunday — evening roster (3) + משיכה (1, לידור)
// ============================================================================
const SUNDAY_SLOTS: SlotInit[] = [
  // יסודי
  { loc: 'יסודי', start: '07:15', end: '08:15', required: 2 },
  { loc: 'יסודי', start: '12:45', end: '13:30', required: 1, isReinforcement: true },

  // צפוני
  { loc: 'צפוני', start: '07:15', end: '08:15', required: 2 },
  { loc: 'צפוני', start: '08:15', end: '10:00', required: 1 },
  { loc: 'צפוני', start: '10:00', end: '12:00', required: 1 },
  { loc: 'צפוני', start: '12:00', end: '13:30', required: 1 },
  { loc: 'צפוני', start: '13:30', end: '14:30', required: 1 },
  { loc: 'צפוני', start: '12:45', end: '13:30', required: 1, isReinforcement: true },

  // חוגים — manual only (solver never auto-fills; left empty to staff by hand)
  { loc: 'חוגים', start: '12:45', end: '13:15', required: 1 },

  // חטיבה — morning
  { loc: 'חטיבה', start: '07:15', end: '09:00', required: 2 },
  { loc: 'חטיבה', start: '09:00', end: '11:00', required: 1 },
  { loc: 'חטיבה', start: '11:00', end: '12:30', required: 1 },
  { loc: 'חטיבה', start: '12:30', end: '13:30', required: 1 },
  { loc: 'חטיבה', start: '13:30', end: '14:30', required: 1 },
  { loc: 'חטיבה', start: '13:45', end: '14:30', required: 1, isReinforcement: true },
  // חטיבה — afternoon (evening roster)
  { loc: 'חטיבה', start: '14:30', end: '15:30', required: 1 },
  { loc: 'חטיבה', start: '15:30', end: '16:15', required: 1 },
  { loc: 'חטיבה', start: '14:45', end: '15:30', required: 1, isReinforcement: true },
  { loc: 'חטיבה', start: '15:45', end: '16:15', required: 2, isReinforcement: true },
  { loc: 'חטיבה', start: '17:30', end: '18:00', required: 0, isReinforcement: true, everyone: true },
  { loc: 'חטיבה', start: '19:10', end: '19:30', required: 0, isReinforcement: true, everyone: true },
];

// ============================================================================
// Monday — evening roster (3); no משיכה, no afternoon (צהריים) roster anymore
// ============================================================================
const MONDAY_SLOTS: SlotInit[] = [
  // יסודי
  { loc: 'יסודי', start: '07:15', end: '08:15', required: 2 },
  { loc: 'יסודי', start: '13:45', end: '14:30', required: 1, isReinforcement: true },

  // צפוני
  { loc: 'צפוני', start: '07:15', end: '08:15', required: 2 },
  { loc: 'צפוני', start: '08:15', end: '10:00', required: 1 },
  { loc: 'צפוני', start: '10:00', end: '12:00', required: 1 },
  { loc: 'צפוני', start: '12:00', end: '13:30', required: 1 },
  { loc: 'צפוני', start: '13:30', end: '14:30', required: 1 },
  { loc: 'צפוני', start: '13:45', end: '14:30', required: 2, isReinforcement: true },

  // חוגים — manual only
  { loc: 'חוגים', start: '07:15', end: '08:15', required: 1 },

  // חטיבה — morning
  { loc: 'חטיבה', start: '07:15', end: '09:00', required: 2 },
  { loc: 'חטיבה', start: '09:00', end: '11:00', required: 1 },
  { loc: 'חטיבה', start: '11:00', end: '12:30', required: 1 },
  { loc: 'חטיבה', start: '12:30', end: '13:30', required: 1 },
  { loc: 'חטיבה', start: '13:30', end: '14:30', required: 1 },
  { loc: 'חטיבה', start: '13:45', end: '14:30', required: 1, isReinforcement: true },
  // חטיבה — afternoon (evening roster)
  { loc: 'חטיבה', start: '14:30', end: '15:30', required: 1 },
  { loc: 'חטיבה', start: '15:30', end: '16:15', required: 1 },
  { loc: 'חטיבה', start: '14:45', end: '15:30', required: 1, isReinforcement: true },
  { loc: 'חטיבה', start: '15:45', end: '16:15', required: 1, isReinforcement: true },
  { loc: 'חטיבה', start: '17:30', end: '18:00', required: 0, isReinforcement: true, everyone: true },
  { loc: 'חטיבה', start: '19:10', end: '19:30', required: 0, isReinforcement: true, everyone: true },
];

// ============================================================================
// Tuesday — long-shift day: no evening roster; morning staff stay till 16:15
// ============================================================================
const TUESDAY_SLOTS: SlotInit[] = [
  // יסודי
  { loc: 'יסודי', start: '07:15', end: '08:15', required: 2 },
  { loc: 'יסודי', start: '12:45', end: '13:30', required: 2, isReinforcement: true },

  // צפוני
  { loc: 'צפוני', start: '07:15', end: '08:15', required: 2 },
  { loc: 'צפוני', start: '08:15', end: '10:00', required: 1 },
  { loc: 'צפוני', start: '10:00', end: '11:30', required: 1 },
  { loc: 'צפוני', start: '11:30', end: '12:30', required: 1 },
  { loc: 'צפוני', start: '12:30', end: '13:30', required: 1 },
  { loc: 'צפוני', start: '13:30', end: '14:30', required: 1 },
  { loc: 'צפוני', start: '12:45', end: '13:30', required: 1, isReinforcement: true },

  // חוגים — manual only
  { loc: 'חוגים', start: '12:45', end: '13:15', required: 1 },

  // חטיבה
  { loc: 'חטיבה', start: '07:15', end: '09:00', required: 2 },
  { loc: 'חטיבה', start: '09:00', end: '11:00', required: 1 },
  { loc: 'חטיבה', start: '11:00', end: '12:30', required: 1 },
  { loc: 'חטיבה', start: '12:30', end: '13:30', required: 1 },
  { loc: 'חטיבה', start: '13:30', end: '14:30', required: 1 },
  { loc: 'חטיבה', start: '13:45', end: '14:30', required: 2, isReinforcement: true },
  { loc: 'חטיבה', start: '14:30', end: '15:30', required: 1 },
  { loc: 'חטיבה', start: '15:45', end: '16:15', required: 0, isReinforcement: true, everyone: true },
];

// ============================================================================
// Wednesday — evening roster (3)
// ============================================================================
const WEDNESDAY_SLOTS: SlotInit[] = [
  // יסודי
  { loc: 'יסודי', start: '07:15', end: '08:15', required: 1 },
  { loc: 'יסודי', start: '13:45', end: '14:30', required: 1, isReinforcement: true },

  // צפוני
  { loc: 'צפוני', start: '07:15', end: '08:15', required: 2 },
  { loc: 'צפוני', start: '08:15', end: '10:00', required: 1 },
  { loc: 'צפוני', start: '10:00', end: '12:00', required: 1 },
  { loc: 'צפוני', start: '12:00', end: '13:30', required: 1 },
  { loc: 'צפוני', start: '13:30', end: '14:30', required: 1 },
  { loc: 'צפוני', start: '13:45', end: '14:30', required: 1, isReinforcement: true },

  // חוגים — manual only (kept available even though Wednesday's sheet had none)
  { loc: 'חוגים', start: '07:15', end: '08:15', required: 1 },

  // חטיבה — morning
  { loc: 'חטיבה', start: '07:15', end: '09:00', required: 2 },
  { loc: 'חטיבה', start: '09:00', end: '11:00', required: 1 },
  { loc: 'חטיבה', start: '11:00', end: '12:30', required: 1 },
  { loc: 'חטיבה', start: '12:30', end: '13:30', required: 1 },
  { loc: 'חטיבה', start: '13:30', end: '14:30', required: 1 },
  { loc: 'חטיבה', start: '13:45', end: '14:30', required: 2, isReinforcement: true },
  // חטיבה — afternoon (evening roster)
  { loc: 'חטיבה', start: '14:30', end: '15:30', required: 1 },
  { loc: 'חטיבה', start: '15:30', end: '16:15', required: 1 },
  { loc: 'חטיבה', start: '14:45', end: '15:30', required: 1, isReinforcement: true },
  { loc: 'חטיבה', start: '15:45', end: '16:15', required: 2, isReinforcement: true },
  { loc: 'חטיבה', start: '17:30', end: '18:00', required: 0, isReinforcement: true, everyone: true },
  { loc: 'חטיבה', start: '19:10', end: '19:30', required: 0, isReinforcement: true, everyone: true },
];

// ============================================================================
// Thursday — evening roster (3) + משיכה (1, לידור)
// ============================================================================
const THURSDAY_SLOTS: SlotInit[] = [
  // יסודי
  { loc: 'יסודי', start: '07:15', end: '08:15', required: 1 },
  { loc: 'יסודי', start: '12:45', end: '13:30', required: 1, isReinforcement: true },

  // צפוני
  { loc: 'צפוני', start: '07:15', end: '08:15', required: 2 },
  { loc: 'צפוני', start: '08:15', end: '10:00', required: 1 },
  { loc: 'צפוני', start: '10:00', end: '12:00', required: 1 },
  { loc: 'צפוני', start: '12:00', end: '13:30', required: 1 },
  { loc: 'צפוני', start: '13:30', end: '14:30', required: 1 },
  { loc: 'צפוני', start: '12:45', end: '13:30', required: 2, isReinforcement: true },

  // חוגים — manual only (kept available even though Thursday's sheet had none)
  { loc: 'חוגים', start: '07:15', end: '08:15', required: 1 },

  // חטיבה — morning
  { loc: 'חטיבה', start: '07:15', end: '09:00', required: 2 },
  { loc: 'חטיבה', start: '09:00', end: '11:00', required: 1 },
  { loc: 'חטיבה', start: '11:00', end: '12:30', required: 1 },
  { loc: 'חטיבה', start: '12:30', end: '13:30', required: 1 },
  { loc: 'חטיבה', start: '13:30', end: '14:30', required: 1 },
  { loc: 'חטיבה', start: '13:45', end: '14:30', required: 1, isReinforcement: true },
  // חטיבה — afternoon (evening roster)
  { loc: 'חטיבה', start: '14:30', end: '15:30', required: 1 },
  { loc: 'חטיבה', start: '15:30', end: '16:15', required: 1 },
  { loc: 'חטיבה', start: '14:45', end: '15:30', required: 1, isReinforcement: true },
  { loc: 'חטיבה', start: '15:45', end: '16:15', required: 1, isReinforcement: true },
  { loc: 'חטיבה', start: '17:30', end: '18:00', required: 0, isReinforcement: true, everyone: true },
  { loc: 'חטיבה', start: '19:10', end: '19:30', required: 0, isReinforcement: true, everyone: true },
];

// NOTE: `מנוחה` is intentionally absent from these quotas. Rest is a DERIVED
// state — anyone left over after slot fills + active special-state quotas is
// considered resting. See deriveRestState() in scheduleSolver.ts.
//
// `משיכה` is filled by the priority list in MISHIKHA_PRIORITY (above), not
// by the standard quota-based pass. The quota here is kept as the UI's
// "target count" so the unfilled-slot diagnostic works.
export const DAILY_TEMPLATES: Record<DayOfWeek, DayTemplate | null> = {
  sunday: buildDay('sunday', SUNDAY_SLOTS, { משמרת_ערב: 3, משיכה: 1 }),
  monday: buildDay('monday', MONDAY_SLOTS, { משמרת_ערב: 3 }),
  tuesday: buildDay('tuesday', TUESDAY_SLOTS, {}),
  wednesday: buildDay('wednesday', WEDNESDAY_SLOTS, { משמרת_ערב: 3 }),
  thursday: buildDay('thursday', THURSDAY_SLOTS, { משמרת_ערב: 3, משיכה: 1 }),
  // Friday & Saturday templates are not part of the supplied examples.
  friday: null,
  saturday: null,
};

/**
 * Per-day name-substring → special-state lockdowns. Currently empty — משיכה
 * is now driven by MISHIKHA_PRIORITY below — but the export is kept as the
 * extension point for any future "person X always does Y on day Z" rules.
 */
export const FIXED_WEEKLY_DUTIES: { day: DayOfWeek; nameSubstring: string; role: 'משיכה' }[] = [];

/**
 * משיכה (food pickup) fill rules.
 *
 * Per the spec: משיכה duty must always consist of EXACTLY `count` people.
 * The solver walks `priorityNames` in order and picks the first `count`
 * staff matches it finds. Top of the list = top priority. If priority
 * picks #1 and #2 are unavailable, #3 fills in, then #4.
 *
 * Order: לידור שלום → מימון אזולאי → הראל גבריאלי → אריאל שמשון.
 * משיכה runs on Sundays and Thursdays, one person (לידור first).
 * Days not listed here have no משיכה duty.
 */
export const MISHIKHA_PRIORITY: Partial<
  Record<DayOfWeek, { count: number; priorityNames: string[] }>
> = {
  sunday: {
    count: 1,
    priorityNames: ['לידור', 'מימון', 'הראל', 'אריאל'],
  },
  thursday: {
    count: 1,
    priorityNames: ['לידור', 'מימון', 'הראל', 'אריאל'],
  },
};

/**
 * Roster-level personnel rules applied when the staff list is loaded.
 *
 * - `EXCLUDED_FROM_SCHEDULE` — name substrings that should NEVER be picked by
 *   the solver. Used for commanders / staff who only oversee. Matching users
 *   are dropped from the roster entirely before it reaches the solver.
 *
 * - `STAFF_EARLIEST_START` — caps when a staff member's day can begin. Slots
 *   whose `start` is earlier than the cap are made ineligible. Used for
 *   late-arrival staff (e.g. אלדד only present from 15:45).
 *
 * Match semantics are substring on `Staff.name`, same as FIXED_WEEKLY_DUTIES.
 */
export const EXCLUDED_FROM_SCHEDULE: string[] = [
  'אורי', // Commander — never assigned to positions
];

export const STAFF_EARLIEST_START: { nameSubstring: string; earliestStart: string }[] = [
  { nameSubstring: 'אלדד', earliestStart: '15:45' },
  { nameSubstring: 'מור', earliestStart: '15:45' },
];

/**
 * Per-soldier guard caps — exceptions who do only minimal guard duty.
 *
 * A matching soldier is limited to MORNING slots only, totalling at most
 * `maxGuardHours`. לידור שלום guards just one morning hour (on משיכה days he's
 * on pickup instead, which already blocks all slots). Match is a name substring
 * on `Staff.name`, same as the other rules here.
 */
export const LIMITED_GUARD: { nameSubstring: string; maxGuardHours: number }[] = [
  { nameSubstring: 'לידור', maxGuardHours: 1 },
];

/**
 * Locations the auto-scheduler must leave EMPTY — the admin staffs them by hand
 * via the per-slot picker. The slots still appear in the schedule (and in the
 * UI, ready to fill manually), but the solver never auto-assigns anyone to
 * them, they don't consume anyone's hours, and a vacant slot here is NOT
 * reported as an unfilled "gap".
 */
export const MANUAL_ONLY_LOCATIONS: LocationId[] = ['חוגים'];
