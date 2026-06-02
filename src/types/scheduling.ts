// Types for the daily auto-scheduling engine.
//
// This is a standalone domain — separate from the coarser weekly grid in
// ScheduleManagementPage. It models the granular, per-location, per-time-slot
// workflow described in the real Telegram-format daily schedules.

export type DayOfWeek =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

/** The four physical locations a staff member can be posted to. */
export type LocationId = 'יסודי' | 'צפוני' | 'חוגים' | 'חטיבה';

export const LOCATION_IDS: readonly LocationId[] = [
  'יסודי',
  'צפוני',
  'חוגים',
  'חטיבה',
] as const;

/** Whole-day "states" — alternatives to being posted to a location slot. */
export type SpecialStateId =
  | 'מנוחה' // Rest / off-duty
  | 'משמרת_ערב' // Evening shift
  | 'משמרת_צהריים' // Afternoon shift
  | 'משיכה'; // Food pickup / duty tasks

export const SPECIAL_STATE_IDS: readonly SpecialStateId[] = [
  'מנוחה',
  'משמרת_ערב',
  'משמרת_צהריים',
  'משיכה',
] as const;

/**
 * A single staffable slot in a daily template.
 *
 * Reinforcement slots (תגבור) work like normal slots but are filled last and
 * are usually short (~45 min). `everyone:true` represents the "*כולם*"
 * marker — every available staff member is added to the slot regardless of
 * `required`.
 */
export interface ShiftSlot {
  /** Stable identifier — used as the key in DaySchedule.slotAssignments. */
  id: string;
  location: LocationId;
  /** Inclusive start in "HH:MM" 24-hour format. */
  start: string;
  /** Exclusive end in "HH:MM" 24-hour format. */
  end: string;
  /** How many distinct staff members the slot demands. */
  required: number;
  /** True for תגבור slots (filled after primary slots). */
  isReinforcement: boolean;
  /** True for "*כולם*" slots — assign every free staff member. */
  everyone: boolean;
  /** Optional human-readable label, surfaced in the UI. */
  label?: string;
}

/** A staff member available to be scheduled. */
export interface Staff {
  /** Stable id (Firestore user doc id). */
  id: string;
  /** Display name in Hebrew (matches the names admins recognise). */
  name: string;
  /** ISO dates ("YYYY-MM-DD") the staff member is out (sick, leave, etc.). */
  unavailableDates?: string[];
  /** Per-day, fixed roles the staff member must always perform. */
  fixedDuties?: { day: DayOfWeek; role: SpecialStateId }[];
  /**
   * Earliest "HH:MM" this staff member can start a shift. Slots whose `start`
   * is before this value will exclude them. Use for late-arrival staff
   * (e.g. אלדד only available from 15:45 onwards).
   */
  earliestStart?: string;
  /** Soft preference flags. */
  preferences?: {
    /** Default true: avoid early-morning slot the day after an evening shift. */
    avoidEarlyAfterEvening?: boolean;
  };
  /**
   * Which half of the day this person is rostered for, derived from the
   * weekly `shift_assignments` collection (`קריית_חינוך_בוקר` vs
   * `קריית_חינוך_ערב`). The solver uses this to keep morning soldiers out
   * of evening-shift rosters and vice versa.
   *
   *   • 'morning' — rostered only for the morning shift.
   *   • 'evening' — rostered only for the evening shift.
   *   • 'both'    — rostered for BOTH (a double shift): eligible for morning
   *                 AND evening slots, assigned to each separately, never
   *                 blocked by the window gates.
   *
   * Undefined means "no shift constraint" (e.g. admin override).
   */
  shiftWindow?: 'morning' | 'evening' | 'both';

  /**
   * Whole-day "supervisor" flag. Commanders show up in the day's roster
   * count (the admin wants the number of people who turned up) but the
   * solver never picks them for slot or special-state assignment.
   */
  isCommander?: boolean;
}

/**
 * A per-day template describing every slot that exists for that weekday and how
 * many bodies should occupy the named special states (when not derived purely
 * from leftover capacity).
 */
export interface DayTemplate {
  day: DayOfWeek;
  slots: ShiftSlot[];
  /** Optional caps for whole-day states (e.g. {מנוחה: 2}). */
  specialStateQuotas?: Partial<Record<SpecialStateId, number>>;
}

export interface UnfilledSlot {
  slotId: string;
  missing: number;
  reason: string;
}

/** The output of the solver — one full day of work. */
export interface DaySchedule {
  /** "YYYY-MM-DD" date the schedule applies to. */
  date: string;
  day: DayOfWeek;
  /** slotId → ordered list of staff ids occupying it. */
  slotAssignments: Record<string, string[]>;
  /** Special-state name → list of staff ids assigned to that state. */
  specialStates: Partial<Record<SpecialStateId, string[]>>;
  /** Slots that the solver could not fully fill, with diagnostic reasons. */
  unfilledSlots: UnfilledSlot[];
  /** Total hours assigned per staff id — surfaced for fairness diagnostics. */
  staffHours: Record<string, number>;
  /** ISO timestamp the solver produced this output. */
  generatedAt: string;
}

export interface SolverOptions {
  /**
   * Previous day's schedule. When present, the solver applies a soft penalty
   * against assigning anyone who was in משמרת_ערב yesterday to an early
   * morning slot today.
   */
  previousDaySchedule?: DaySchedule;
  /** Staff ids the admin has forced into a particular special state. */
  forcedSpecialStates?: Partial<Record<SpecialStateId, string[]>>;
  /** Staff ids the admin has manually pinned to a specific slot id. */
  pinnedAssignments?: Record<string, string[]>;
  /** Deterministic tie-breaker seed. */
  seed?: number;
}
