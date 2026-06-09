// Heuristic, rule-based daily scheduler.
//
// Pass order (significant — later passes assume earlier ones ran):
//
//   1. applyAvailability          mark unavailable + forced special states
//   2. applyMishikhaPriority      Mon/Thu: fill משיכה via the priority list
//   3. applyFixedDuties           any leftover per-name day duties
//   4. applyPinnedAssignments     admin-pinned slot assignments
//   5. preSelectSpecialShifts     RESERVE the evening/afternoon-shift roster
//                                 BEFORE any morning slots get filled — late
//                                 arrivers (אלדד, מור) anchor first, then
//                                 the quota is topped up.
//   6. fill regular (non-everyone) slots — by now משמרת_ערב people are
//                                 already in inSpecialState, so the per-state
//                                 SLOT_BLOCK_BEFORE rule keeps them out of
//                                 morning slots automatically.
//   7. fill "*כולם*" slots         evening ones use ONLY משמרת_ערב members
//   8. rebalanceHours             move slots from the most-loaded worker to a
//                                 lighter one to even out assigned hours
//   9. validateNoDoubleBooking    assert no soldier holds two overlapping
//                                 slots; drop the later one if so, re-report gaps
//  10. deriveRestState            everyone unassigned → מנוחה
//
// Per-state slot-blocking rules (see SLOT_BLOCK_BEFORE):
//   • מנוחה / משיכה  → block all slots (whole-day commitment)
//   • משמרת_ערב      → block only slots starting before 14:30
//   • משמרת_צהריים   → blocks nothing (they may still take regular slots)
//
// Why the order matters: if step 6 ran before step 5, the morning slot fills
// would gobble up every staff member, leaving 0 candidates for evening shift
// and producing the "evening shift is always empty" bug. By reserving evening
// people FIRST, the evening shift always hits its target (subject to roster
// size) and morning slots get best-effort coverage from whoever's left.
//
// Admin overrides via `pinnedAssignments` bypass the in-special-state guard,
// so a person CAN be intentionally placed in both a morning slot and the
// evening shift on the same day.

import { format } from 'date-fns';
import type {
  DayOfWeek,
  DaySchedule,
  DayTemplate,
  ShiftSlot,
  SolverOptions,
  SpecialStateId,
  Staff,
  UnfilledSlot,
} from '../types/scheduling';
import { SPECIAL_STATE_IDS } from '../types/scheduling';
import {
  FIXED_WEEKLY_DUTIES,
  MISHIKHA_PRIORITY,
  MANUAL_ONLY_LOCATIONS,
} from '../config/dailyShiftTemplates';

// ---------------------------------------------------------------------------
// Time + interval helpers
// ---------------------------------------------------------------------------

interface Interval {
  start: number; // minutes since 00:00
  end: number;
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const slotInterval = (s: ShiftSlot): Interval => ({
  start: toMin(s.start),
  end: toMin(s.end),
});

const slotDurationHours = (s: ShiftSlot): number =>
  (toMin(s.end) - toMin(s.start)) / 60;

const intervalsOverlap = (a: Interval, b: Interval): boolean =>
  a.start < b.end && b.start < a.end;

const hasConflict = (busy: Interval[], next: Interval): boolean =>
  busy.some((b) => intervalsOverlap(b, next));

/** Boundary at-or-after which a slot is considered "evening". */
const EVENING_START_MIN = toMin('14:30');

const isEveningSlot = (slot: ShiftSlot): boolean =>
  toMin(slot.start) >= EVENING_START_MIN;

/** True for locations the admin staffs by hand (solver leaves them empty). */
const isManualOnlySlot = (slot: ShiftSlot): boolean =>
  MANUAL_ONLY_LOCATIONS.includes(slot.location);

// ---------------------------------------------------------------------------
// Per-state blocking rules.
//
// For each special state, this map says: "if you're in this state, slots
// whose start time is BEFORE this threshold are off-limits."
//
//   • '24:00' → blocks every slot (whole-day commitment)
//   • '14:30' → blocks morning only (evening shift still allowed)
//   • null     → blocks nothing
// ---------------------------------------------------------------------------

const SLOT_BLOCK_BEFORE: Record<SpecialStateId, string | null> = {
  מנוחה: '24:00',
  משיכה: '24:00',
  משמרת_ערב: '14:30',
  משמרת_צהריים: null,
};

// ---------------------------------------------------------------------------
// Deterministic tie-break PRNG (xorshift32)
// ---------------------------------------------------------------------------

const makeRng = (seed: number) => {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
};

/**
 * In-place Fisher–Yates shuffle driven by a [0,1) rng. Replaces the previous
 * `sort(() => rng() - rng())` idiom, which is a non-uniform / engine-dependent
 * comparator (Array.sort requires a consistent ordering) and biased which
 * soldiers got reserved.
 */
const shuffleInPlace = <T>(arr: T[], rng: () => number): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// ---------------------------------------------------------------------------
// Solver state
// ---------------------------------------------------------------------------

interface SolverState {
  date: string;
  day: DayOfWeek;
  staff: Staff[];
  staffById: Map<string, Staff>;
  template: DayTemplate;
  options: SolverOptions;
  busyByStaff: Map<string, Interval[]>;
  hoursByStaff: Map<string, number>;
  unavailable: Set<string>;
  slotAssignments: Map<string, string[]>;
  specialStates: Map<SpecialStateId, string[]>;
  unfilledSlots: UnfilledSlot[];
  rng: () => number;
}

const createState = (
  date: Date,
  day: DayOfWeek,
  staff: Staff[],
  template: DayTemplate,
  options: SolverOptions
): SolverState => ({
  date: format(date, 'yyyy-MM-dd'),
  day,
  staff,
  staffById: new Map(staff.map((s) => [s.id, s])),
  template,
  options,
  busyByStaff: new Map(staff.map((s) => [s.id, []])),
  hoursByStaff: new Map(staff.map((s) => [s.id, 0])),
  unavailable: new Set(),
  slotAssignments: new Map(),
  specialStates: new Map(SPECIAL_STATE_IDS.map((k) => [k, []])),
  unfilledSlots: [],
  rng: makeRng(options.seed ?? Math.floor(Math.random() * 1_000_000)),
});

// ---------------------------------------------------------------------------
// State-membership / blocking queries
// ---------------------------------------------------------------------------

const isInState = (state: SolverState, staffId: string, role: SpecialStateId): boolean =>
  (state.specialStates.get(role) || []).includes(staffId);

/** True if any of the staff's whole-day commitments forbid this slot. */
const isBlockedBySpecialState = (
  state: SolverState,
  staffId: string,
  slot: ShiftSlot
): boolean => {
  const isDouble = state.staffById.get(staffId)?.shiftWindow === 'both';
  for (const role of SPECIAL_STATE_IDS) {
    if (!isInState(state, staffId, role)) continue;
    // Double-shift soldiers are listed on the evening roster (משמרת_ערב) for
    // display but legitimately work mornings too — so the evening shift's
    // "<14:30 is off-limits" rule must NOT apply to them.
    if (role === 'משמרת_ערב' && isDouble) continue;
    const cutoff = SLOT_BLOCK_BEFORE[role];
    if (cutoff === null) continue;
    if (toMin(slot.start) < toMin(cutoff)) return true;
  }
  return false;
};

/** True if this weekday runs an evening/afternoon roster (Sun/Wed/Thu/Mon). */
const dayHasLateRoster = (state: SolverState): boolean => {
  const q = state.template.specialStateQuotas || {};
  return (q['משמרת_ערב'] ?? 0) > 0 || (q['משמרת_צהריים'] ?? 0) > 0;
};

/**
 * Hard per-staff availability: late-arrival rule + shift-window.
 *
 * Window gates:
 *   • 'both'    — eligible for every slot (a double shift); no window gate.
 *   • 'evening' — HARD-blocked from morning slots (<14:30); they are genuinely
 *                 not present in the morning.
 *   • 'morning' — the afternoon (≥14:30) depends on the day:
 *                   - day WITH an evening/afternoon roster (hasLateRoster) → the
 *                     afternoon is that roster's job; morning soldiers are kept
 *                     OUT. A shortfall is reported as an unfilled slot so the
 *                     admin adds evening people, rather than silently keeping a
 *                     morning soldier till 16:15.
 *                   - day WITHOUT a late roster (e.g. Tuesday) → morning
 *                     soldiers MAY stay late to cover the afternoon (the only
 *                     people available); candidatePenalty still de-prioritises
 *                     them but they're eligible.
 */
const isStaffEligibleForSlot = (
  staff: Staff,
  slot: ShiftSlot,
  hasLateRoster: boolean
): boolean => {
  if (staff.earliestStart && toMin(slot.start) < toMin(staff.earliestStart)) {
    return false;
  }
  if (staff.shiftWindow === 'evening' && toMin(slot.start) < EVENING_START_MIN) {
    return false;
  }
  if (
    staff.shiftWindow === 'morning' &&
    !slot.everyone &&
    toMin(slot.start) >= EVENING_START_MIN &&
    hasLateRoster
  ) {
    return false;
  }
  return true;
};

const staffHasMorningSlot = (state: SolverState, staffId: string): boolean => {
  const busy = state.busyByStaff.get(staffId) || [];
  return busy.some((b) => b.start < EVENING_START_MIN);
};

const staffIsAssignedToAnySlot = (state: SolverState, staffId: string): boolean => {
  let found = false;
  state.slotAssignments.forEach((ids) => {
    if (ids.includes(staffId)) found = true;
  });
  return found;
};

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

const commitAssignment = (state: SolverState, slot: ShiftSlot, staffId: string): void => {
  const busy = state.busyByStaff.get(staffId) || [];
  busy.push(slotInterval(slot));
  state.busyByStaff.set(staffId, busy);
  state.hoursByStaff.set(
    staffId,
    (state.hoursByStaff.get(staffId) || 0) + slotDurationHours(slot)
  );
};

/** Inverse of commitAssignment for a single slot occupancy (used by rebalance). */
const uncommitAssignment = (state: SolverState, slot: ShiftSlot, staffId: string): void => {
  const interval = slotInterval(slot);
  const busy = state.busyByStaff.get(staffId) || [];
  const idx = busy.findIndex((b) => b.start === interval.start && b.end === interval.end);
  if (idx >= 0) busy.splice(idx, 1);
  state.busyByStaff.set(staffId, busy);
  state.hoursByStaff.set(
    staffId,
    (state.hoursByStaff.get(staffId) || 0) - slotDurationHours(slot)
  );
};

const addToSpecialState = (
  state: SolverState,
  role: SpecialStateId,
  staffId: string
): void => {
  const list = state.specialStates.get(role) || [];
  if (!list.includes(staffId)) {
    list.push(staffId);
    state.specialStates.set(role, list);
  }
};

// ---------------------------------------------------------------------------
// Pass 1 — availability + forced states
// ---------------------------------------------------------------------------

const applyAvailability = (state: SolverState): void => {
  for (const s of state.staff) {
    if (s.unavailableDates?.includes(state.date)) {
      state.unavailable.add(s.id);
    }
  }
  const forced = state.options.forcedSpecialStates;
  if (forced) {
    for (const role of SPECIAL_STATE_IDS) {
      for (const id of forced[role] || []) {
        addToSpecialState(state, role, id);
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Pass 2 — משיכה priority-list fill (Mon/Thu only by default)
// ---------------------------------------------------------------------------

/**
 * Walk MISHIKHA_PRIORITY in order, picking the first `count` matching staff
 * by name substring. Honours `unavailable` and skips anyone already in a
 * whole-day special state.
 */
const applyMishikhaPriority = (state: SolverState): void => {
  const rule = MISHIKHA_PRIORITY[state.day];
  if (!rule) return;

  const current = (state.specialStates.get('משיכה') || []).length;
  let stillNeeded = Math.max(rule.count - current, 0);
  if (stillNeeded === 0) return;

  // Already-picked names get skipped so the priority list never double-adds.
  const alreadyPicked = new Set(state.specialStates.get('משיכה') || []);

  for (const nameSubstring of rule.priorityNames) {
    if (stillNeeded === 0) break;
    const match = state.staff.find(
      (s) =>
        s.name.includes(nameSubstring) &&
        !state.unavailable.has(s.id) &&
        !alreadyPicked.has(s.id) &&
        !s.isCommander &&
        // משיכה is a morning duty — evening-shift soldiers aren't around.
        s.shiftWindow !== 'evening'
    );
    if (!match) continue;
    addToSpecialState(state, 'משיכה', match.id);
    alreadyPicked.add(match.id);
    stillNeeded--;
  }

  if (stillNeeded > 0) {
    state.unfilledSlots.push({
      slotId: `special:משיכה`,
      missing: stillNeeded,
      reason: 'אין מספיק חיילים זמינים מרשימת ההעדפות למשיכה',
    });
  }
};

// ---------------------------------------------------------------------------
// Pass 3 — any other name-based fixed duties (currently empty)
// ---------------------------------------------------------------------------

const applyFixedDuties = (state: SolverState): void => {
  for (const rule of FIXED_WEEKLY_DUTIES) {
    if (rule.day !== state.day) continue;
    for (const s of state.staff) {
      if (s.name.includes(rule.nameSubstring) && !state.unavailable.has(s.id)) {
        addToSpecialState(state, rule.role, s.id);
      }
    }
  }
  // Per-staff explicit fixedDuties.
  for (const s of state.staff) {
    for (const duty of s.fixedDuties || []) {
      if (duty.day === state.day && !state.unavailable.has(s.id)) {
        addToSpecialState(state, duty.role, s.id);
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Pass 4 — admin-pinned slot assignments
//
// Pinned assignments are an ADMIN OVERRIDE. They bypass the "in special
// state" guard so the dual-assignment exception (morning+evening for one
// person) is possible. We still respect availability and time conflicts.
// ---------------------------------------------------------------------------

const applyPinnedAssignments = (state: SolverState): void => {
  const pinned = state.options.pinnedAssignments;
  if (!pinned) return;
  for (const slot of state.template.slots) {
    const ids = pinned[slot.id];
    if (!ids?.length) continue;
    const accepted: string[] = [];
    for (const id of ids) {
      if (state.unavailable.has(id)) continue;
      const person = state.staffById.get(id);
      if (person && !isStaffEligibleForSlot(person, slot, dayHasLateRoster(state))) continue;
      const busy = state.busyByStaff.get(id) || [];
      if (hasConflict(busy, slotInterval(slot))) continue;
      accepted.push(id);
      commitAssignment(state, slot, id);
    }
    state.slotAssignments.set(slot.id, accepted);
  }
};

// ---------------------------------------------------------------------------
// Pass 5 — regular (non-everyone) slot fill
// ---------------------------------------------------------------------------

const orderRegularSlots = (slots: ShiftSlot[]): ShiftSlot[] => {
  const score = (s: ShiftSlot): number => {
    let v = 0;
    if (s.isReinforcement) v += 1_000;
    v -= s.required * 10;
    v += toMin(s.start) / 60;
    return v;
  };
  return slots
    .filter((s) => !s.everyone && !isManualOnlySlot(s))
    .sort((a, b) => score(a) - score(b));
};

const wasEveningYesterday = (staffId: string, state: SolverState): boolean => {
  const prev = state.options.previousDaySchedule;
  if (!prev) return false;
  return !!prev.specialStates?.['משמרת_ערב']?.includes(staffId);
};

// A morning-window soldier IS eligible for afternoon (≥14:30) slots, but only
// as a last resort. This HARD penalty is larger than any realistic load value,
// so rankCandidates always exhausts evening/both soldiers before pulling a
// morning soldier into the afternoon.
const CROSS_WINDOW_FALLBACK_PENALTY = 1000;

// Desired rest between two guard slots for the same soldier, and how strongly
// we steer away from breaking it. The values are in "effective hours" so they
// trade off directly against real assigned hours in the soft ranking: avoiding
// a back-to-back is worth ~one extra slot of load, so we still prefer a lighter
// soldier when the only gap-respecting option is much more loaded.
const REST_GAP_MIN = 60; // minutes
const BACK_TO_BACK_LOAD = 3; // 0-gap (immediately adjacent) guard slots
const NEAR_GAP_LOAD = 1.5; // positive but shorter than REST_GAP_MIN

/** Minutes between `slot` and the soldier's nearest assigned slot (0 = adjacent). */
const nearestSlotGap = (staffId: string, slot: ShiftSlot, state: SolverState): number => {
  const iv = slotInterval(slot);
  let best = Infinity;
  for (const b of state.busyByStaff.get(staffId) || []) {
    if (b.end <= iv.start) best = Math.min(best, iv.start - b.end);
    else if (iv.end <= b.start) best = Math.min(best, b.start - iv.end);
    else best = 0; // overlap (shouldn't happen — filtered) → no gap
  }
  return best;
};

// Hard ranking tier — see CROSS_WINDOW_FALLBACK_PENALTY.
const candidateHardPenalty = (staffId: string, slot: ShiftSlot, state: SolverState): number => {
  if (toMin(slot.start) >= EVENING_START_MIN && !slot.everyone) {
    const person = state.staffById.get(staffId);
    if (person?.shiftWindow === 'morning') return CROSS_WINDOW_FALLBACK_PENALTY;
  }
  return 0;
};

// Soft ranking — lower is better. Real assigned hours (fairness) plus nudges:
// keep a rest gap between a soldier's guard slots, and avoid an early-morning
// slot the day after an evening shift.
const candidateSoftLoad = (staffId: string, slot: ShiftSlot, state: SolverState): number => {
  let load = state.hoursByStaff.get(staffId) || 0;
  const gap = nearestSlotGap(staffId, slot, state);
  if (gap <= 0) load += BACK_TO_BACK_LOAD;
  else if (gap < REST_GAP_MIN) load += NEAR_GAP_LOAD;
  if (toMin(slot.start) < toMin('08:30') && wasEveningYesterday(staffId, state)) {
    load += 1;
  }
  return load;
};

const rankCandidates = (ids: string[], slot: ShiftSlot, state: SolverState): string[] => {
  const scored = ids.map((id) => ({
    id,
    hard: candidateHardPenalty(id, slot, state),
    soft: candidateSoftLoad(id, slot, state),
    tieBreak: state.rng(),
  }));
  scored.sort((a, b) => {
    if (a.hard !== b.hard) return a.hard - b.hard;
    if (a.soft !== b.soft) return a.soft - b.soft;
    return a.tieBreak - b.tieBreak;
  });
  return scored.map((s) => s.id);
};

const fillRegularSlot = (state: SolverState, slot: ShiftSlot): void => {
  const existing = state.slotAssignments.get(slot.id) || [];
  const stillNeeded = Math.max(slot.required - existing.length, 0);
  if (stillNeeded === 0) {
    state.slotAssignments.set(slot.id, existing);
    return;
  }

  const interval = slotInterval(slot);
  const eligibleIds: string[] = [];

  for (const s of state.staff) {
    if (existing.includes(s.id)) continue;
    if (state.unavailable.has(s.id)) continue;
    if (s.isCommander) continue;
    if (isBlockedBySpecialState(state, s.id, slot)) continue;
    if (!isStaffEligibleForSlot(s, slot, dayHasLateRoster(state))) continue;
    if (hasConflict(state.busyByStaff.get(s.id) || [], interval)) continue;
    eligibleIds.push(s.id);
  }

  if (eligibleIds.length === 0) {
    state.slotAssignments.set(slot.id, existing);
    state.unfilledSlots.push({
      slotId: slot.id,
      missing: stillNeeded,
      reason: 'אין חיילים פנויים לזמן זה',
    });
    return;
  }

  const picked = rankCandidates(eligibleIds, slot, state).slice(0, stillNeeded);
  state.slotAssignments.set(slot.id, [...existing, ...picked]);
  for (const id of picked) commitAssignment(state, slot, id);

  if (picked.length < stillNeeded) {
    state.unfilledSlots.push({
      slotId: slot.id,
      missing: stillNeeded - picked.length,
      reason: 'לא נמצאו מספיק חיילים זמינים',
    });
  }
};

// ---------------------------------------------------------------------------
// Pass 5 — RESERVE special-shift personnel BEFORE morning slots are filled.
//
// This is the bit that fixes the "evening shift is always empty" bug. If we
// let morning slots eat up the entire roster first, there's nobody left to
// be on משמרת_ערב — the quota silently fails. By committing the evening
// roster up front (and relying on the SLOT_BLOCK_BEFORE rule to keep them
// out of morning slots), we guarantee evening shift hits its target.
//
// Algorithm:
//   Step A — Anchor late-arrivers. אלדד / מור can only work from 15:45 and
//            therefore can ONLY exist as evening- or afternoon-shift staff.
//            We force-add them to whichever of those quotas is open today.
//   Step B — Top up each quota with random eligible staff until target met.
//            "Eligible" = not unavailable, not already in another whole-day
//            commitment, and (for evening shift) not already pinned to a
//            morning slot — pinning bypasses everything else but pinning to
//            a morning slot is an explicit admin override, and the evening
//            shift's <14:30 block would conflict.
//
// `מנוחה` is excluded (it's derived after all slots fill).
// `משיכה` is excluded (the priority-list pass at step 2 already owns it).
// ---------------------------------------------------------------------------

const preSelectSpecialShifts = (state: SolverState): void => {
  const quotas = state.template.specialStateQuotas;
  if (!quotas) return;

  // ---- Step A: anchor late-arrivers -------------------------------------
  // Pick whichever late shift the day has — prefer evening if both exist
  // (most of the supplied real-world examples place late-arrivers there).
  const lateShiftPreference: SpecialStateId[] = ['משמרת_ערב', 'משמרת_צהריים'];
  const lateArrivers = state.staff.filter(
    (s) =>
      s.earliestStart &&
      !state.unavailable.has(s.id) &&
      !isInState(state, s.id, 'משיכה')
  );
  for (const la of lateArrivers) {
    if (
      isInState(state, la.id, 'משמרת_ערב') ||
      isInState(state, la.id, 'משמרת_צהריים')
    ) {
      continue;
    }
    for (const role of lateShiftPreference) {
      if ((quotas[role] ?? 0) > 0) {
        addToSpecialState(state, role, la.id);
        break;
      }
    }
    // If neither quota exists today the late-arriver naturally ends up
    // resting (no morning slots possible due to earliestStart).
  }

  // ---- Step A2: list double-shift soldiers on the late roster -----------
  // A 'both' soldier works a full day — morning slots AND the afternoon. They
  // belong on the evening roster (so they show up under *משמרת ערב*) and count
  // toward its quota, but isBlockedBySpecialState exempts them from the <14:30
  // block so their morning eligibility is untouched. Added BEFORE the top-up so
  // they reduce the number of dedicated evening soldiers still needed.
  const lateRole: SpecialStateId | null =
    (quotas['משמרת_ערב'] ?? 0) > 0
      ? 'משמרת_ערב'
      : (quotas['משמרת_צהריים'] ?? 0) > 0
        ? 'משמרת_צהריים'
        : null;
  if (lateRole) {
    for (const s of state.staff) {
      if (s.shiftWindow !== 'both') continue;
      if (state.unavailable.has(s.id) || s.isCommander) continue;
      if (isInState(state, s.id, 'משיכה')) continue;
      addToSpecialState(state, lateRole, s.id);
    }
  }

  // ---- Step B: top up each quota ----------------------------------------
  for (const role of SPECIAL_STATE_IDS) {
    if (role === 'מנוחה') continue; // derived
    if (role === 'משיכה') continue; // priority list owns this
    const target = quotas[role] ?? 0;
    if (target <= 0) continue;

    const currentCount = (state.specialStates.get(role) || []).length;
    const needed = Math.max(target - currentCount, 0);
    if (needed === 0) continue;

    const eligible = state.staff.filter((s) => {
      if (state.unavailable.has(s.id)) return false;
      if (s.isCommander) return false;
      if (isInState(state, s.id, role)) return false;
      if (isInState(state, s.id, 'משיכה')) return false;
      // A person can't be both evening AND afternoon shift on the same day.
      if (role === 'משמרת_ערב' && isInState(state, s.id, 'משמרת_צהריים')) return false;
      if (role === 'משמרת_צהריים' && isInState(state, s.id, 'משמרת_ערב')) return false;
      // Evening-shift conflicts with anyone pinned to a morning slot.
      if (role === 'משמרת_ערב' && staffHasMorningSlot(state, s.id)) return false;
      // Respect the per-soldier shiftWindow from the weekly assignment:
      //   • משמרת_ערב is reserved for pure evening-shift soldiers ONLY. Being
      //     reserved here blocks the morning (SLOT_BLOCK_BEFORE), so 'both'
      //     (double-shift) and 'morning' soldiers are deliberately excluded —
      //     a 'both' soldier reaches evening slots through the normal fill
      //     pass without losing their morning eligibility.
      //   • משמרת_צהריים is broad — either window may end up filling the
      //     afternoon block, so no shift-window gate is applied here.
      if (role === 'משמרת_ערב' && s.shiftWindow !== 'evening') return false;
      return true;
    });

    // Random ordering using the seeded RNG → reproducible runs.
    shuffleInPlace(eligible, state.rng);

    for (let i = 0; i < needed && i < eligible.length; i++) {
      addToSpecialState(state, role, eligible[i].id);
    }

    const finalCount = (state.specialStates.get(role) || []).length;
    if (finalCount < target) {
      state.unfilledSlots.push({
        slotId: `special:${role}`,
        missing: target - finalCount,
        reason: `חסרים ${target - finalCount} חיילים ב-${role.replace('_', ' ')} (יעד ${target}, שובצו ${finalCount})`,
      });
    }
  }
};

// ---------------------------------------------------------------------------
// Pass 7 — *כולם* slots
//
// Per the spec: evening "*כולם*" slots ARE the משמרת_ערב roster, no one
// else. Morning *כולם* slots (none in our current templates) would still
// pull from every staff member free at that time.
// ---------------------------------------------------------------------------

const fillEveryoneSlots = (state: SolverState): void => {
  const everyone = state.template.slots.filter((s) => s.everyone && !isManualOnlySlot(s));
  for (const slot of everyone) {
    const interval = slotInterval(slot);
    const existing = state.slotAssignments.get(slot.id) || [];

    let candidatePool: string[];
    if (isEveningSlot(slot)) {
      // Evening *כולם* — everyone on duty in the afternoon: the late-shift
      // roster (משמרת_ערב / משמרת_צהריים) PLUS anyone already assigned to an
      // afternoon (>=14:30) slot. On a long-shift day with NO late roster
      // (e.g. Tuesday) that second part is what fills the muster — the morning
      // staff who stayed late — instead of it landing empty.
      const set = new Set<string>();
      for (const id of state.specialStates.get('משמרת_ערב') || []) set.add(id);
      for (const id of state.specialStates.get('משמרת_צהריים') || []) set.add(id);
      for (const s of state.template.slots) {
        if (s.everyone || toMin(s.start) < EVENING_START_MIN) continue;
        for (const id of state.slotAssignments.get(s.id) || []) set.add(id);
      }
      candidatePool = Array.from(set);
    } else {
      // Morning *כולם* — everyone who's available and not committed elsewhere.
      candidatePool = state.staff
        .filter(
          (s) =>
            !state.unavailable.has(s.id) &&
            !s.isCommander &&
            !isInState(state, s.id, 'משיכה') &&
            !isInState(state, s.id, 'מנוחה')
        )
        .map((s) => s.id);
    }

    const accepted: string[] = [...existing];
    for (const id of candidatePool) {
      if (accepted.includes(id)) continue;
      const person = state.staffById.get(id);
      if (person && !isStaffEligibleForSlot(person, slot, dayHasLateRoster(state))) continue;
      if (hasConflict(state.busyByStaff.get(id) || [], interval)) continue;
      accepted.push(id);
      commitAssignment(state, slot, id);
    }
    state.slotAssignments.set(slot.id, accepted);
  }
};

// ---------------------------------------------------------------------------
// Pass 10 — derive מנוחה
//
// Anyone who's not unavailable, not in another whole-day commitment, and
// not assigned to any slot is considered resting. The set is computed
// here at the end — מנוחה is never solver-input.
// ---------------------------------------------------------------------------

const deriveRestState = (state: SolverState): void => {
  for (const s of state.staff) {
    if (state.unavailable.has(s.id)) continue;
    // Commanders aren't assigned and aren't "resting" either — they're just
    // present. They get their own bucket in the UI.
    if (s.isCommander) continue;
    if (isInState(state, s.id, 'משיכה')) continue;
    if (isInState(state, s.id, 'משמרת_ערב')) continue;
    if (isInState(state, s.id, 'משמרת_צהריים')) continue;
    if (staffIsAssignedToAnySlot(state, s.id)) continue;
    addToSpecialState(state, 'מנוחה', s.id);
  }
};

// ---------------------------------------------------------------------------
// Pass 8 — rebalance assigned hours.
//
// The per-slot greedy fill prefers lower-hours candidates but never revisits a
// decision, so totals drift apart (e.g. 2.75h vs 3.75h). This hill-climb takes
// a slot off whoever currently has the MOST hours and hands it to anyone
// eligible and time-free who is far enough below — strictly shrinking the gap
// each move (variance is monotonically reduced, so it terminates). The receiver
// may be someone who would otherwise rest: keeping everyone's hours "very
// close" means spreading the load wider rather than leaving a few people idle,
// so on a roster with spare capacity more people each work a little. Each slot
// keeps its headcount, so coverage is untouched; "*כולם*" musters, pinned
// slots, and manual-only locations (חוגים) are never moved.
//
// Two move types: a one-way hand-off of a whole slot, and a SWAP that trades a
// bigger slot for a smaller one (shifting only their difference) so hours can
// be fine-tuned below the slot-chunk size — important once a location like
// חוגים is taken out of the auto-assignable pool.
//
// Note: morning and evening soldiers can't swap slots, so this evens out hours
// WITHIN a window, not across them (evening shifts are inherently shorter).
// ---------------------------------------------------------------------------

const MAX_REBALANCE_ITERS = 2000;

const rebalanceHours = (state: SolverState): void => {
  const movableSlots = state.template.slots.filter(
    (s) => !s.everyone && !isManualOnlySlot(s)
  );
  const pinned = state.options.pinnedAssignments || {};
  const hasLate = dayHasLateRoster(state);
  const hoursOf = (id: string): number => state.hoursByStaff.get(id) || 0;

  const inPool = (id: string): boolean => {
    const s = state.staffById.get(id);
    if (!s || s.isCommander) return false;
    if (state.unavailable.has(id)) return false;
    if (isInState(state, id, 'משיכה')) return false;
    return true;
  };

  const eligibleFor = (id: string, slot: ShiftSlot): boolean => {
    const p = state.staffById.get(id);
    if (!p) return false;
    return isStaffEligibleForSlot(p, slot, hasLate) && !isBlockedBySpecialState(state, id, slot);
  };

  // Free for `interval`, optionally ignoring one interval the person gives up.
  const freeFor = (id: string, interval: Interval, give?: Interval): boolean => {
    for (const b of state.busyByStaff.get(id) || []) {
      if (give && b.start === give.start && b.end === give.end) continue;
      if (intervalsOverlap(b, interval)) return false;
    }
    return true;
  };

  const slotsOf = (id: string): ShiftSlot[] =>
    movableSlots.filter(
      (s) => !pinned[s.id]?.includes(id) && (state.slotAssignments.get(s.id) || []).includes(id)
    );

  const move = (slot: ShiftSlot, from: string, to: string): void => {
    const occ = state.slotAssignments.get(slot.id) || [];
    state.slotAssignments.set(slot.id, occ.map((x) => (x === from ? to : x)));
    uncommitAssignment(state, slot, from);
    commitAssignment(state, slot, to);
  };

  for (let iter = 0; iter < MAX_REBALANCE_ITERS; iter++) {
    const poolIds = state.staff.map((s) => s.id).filter(inPool);
    if (poolIds.length < 2) return;
    const donors = [...poolIds].sort((a, b) => hoursOf(b) - hoursOf(a));
    let acted = false;

    // --- Phase 1: one-way move — hand a whole slot to a lighter person -----
    for (const donor of donors) {
      const dH = hoursOf(donor);
      const dSlots = slotsOf(donor).sort(
        (a, b) => slotDurationHours(a) - slotDurationHours(b)
      );
      for (const slot of dSlots) {
        const dur = slotDurationHours(slot);
        const interval = slotInterval(slot);
        const occ = state.slotAssignments.get(slot.id) || [];
        let best: string | null = null;
        let bestH = Infinity;
        for (const cand of poolIds) {
          if (cand === donor || occ.includes(cand)) continue;
          const cH = hoursOf(cand);
          if (dH - cH <= dur) continue; // wouldn't strictly reduce variance
          if (!eligibleFor(cand, slot) || !freeFor(cand, interval)) continue;
          if (cH < bestH) { bestH = cH; best = cand; }
        }
        if (best) { move(slot, donor, best); acted = true; break; }
      }
      if (acted) break;
    }
    if (acted) continue;

    // --- Phase 2: swap — trade a bigger slot for a smaller one -------------
    // Shifts only (d1 − d2) hours, so it can fine-tune below the chunk size
    // when no whole-slot move helps (e.g. once חוגים's small slots are gone).
    for (const donor of donors) {
      const dH = hoursOf(donor);
      for (const s1 of slotsOf(donor)) {
        const d1 = slotDurationHours(s1);
        const i1 = slotInterval(s1);
        const occ1 = state.slotAssignments.get(s1.id) || [];
        for (const cand of poolIds) {
          if (cand === donor || occ1.includes(cand)) continue;
          const cH = hoursOf(cand);
          if (cH >= dH) continue;
          for (const s2 of slotsOf(cand)) {
            const d2 = slotDurationHours(s2);
            if (d2 >= d1) continue; // donor must shed a bigger slot than it gains
            if (dH - cH <= d1 - d2) continue; // wouldn't strictly reduce variance
            const occ2 = state.slotAssignments.get(s2.id) || [];
            if (occ2.includes(donor)) continue;
            const i2 = slotInterval(s2);
            if (!eligibleFor(donor, s2) || !eligibleFor(cand, s1)) continue;
            if (!freeFor(donor, i2, i1) || !freeFor(cand, i1, i2)) continue;
            move(s1, donor, cand);
            move(s2, cand, donor);
            acted = true;
            break;
          }
          if (acted) break;
        }
        if (acted) break;
      }
      if (acted) break;
    }

    if (!acted) return; // local optimum — nothing left to improve
  }
};

// ---------------------------------------------------------------------------
// Pass 9 — validate the no-double-booking invariant.
//
// Every fill path already guards with hasConflict, so this shouldn't find
// anything — but asserting it here guarantees the OUTPUT is clean regardless
// of future changes (and of pinned-assignment edge cases). Any soldier found
// in two time-overlapping slots is dropped from the later (higher-start) slot;
// their hours are corrected and the freed slot is re-reported as unfilled.
// Runs BEFORE deriveRestState so anyone emptied out correctly falls to מנוחה.
// ---------------------------------------------------------------------------

const validateNoDoubleBooking = (state: SolverState): void => {
  const slotById = new Map(state.template.slots.map((s) => [s.id, s]));

  // Collect every (slot, interval) a soldier holds.
  const perStaff = new Map<string, { slotId: string; interval: Interval }[]>();
  state.slotAssignments.forEach((ids, slotId) => {
    const slot = slotById.get(slotId);
    if (!slot) return;
    const interval = slotInterval(slot);
    for (const id of ids) {
      const list = perStaff.get(id) || [];
      list.push({ slotId, interval });
      perStaff.set(id, list);
    }
  });

  // Keep the earliest-starting slot of any overlapping pair, drop the rest.
  perStaff.forEach((entries, staffId) => {
    entries.sort((a, b) => a.interval.start - b.interval.start);
    const kept: Interval[] = [];
    for (const entry of entries) {
      if (kept.some((k) => intervalsOverlap(k, entry.interval))) {
        const ids = state.slotAssignments.get(entry.slotId) || [];
        state.slotAssignments.set(
          entry.slotId,
          ids.filter((id) => id !== staffId)
        );
        const slot = slotById.get(entry.slotId);
        if (slot) {
          state.hoursByStaff.set(
            staffId,
            (state.hoursByStaff.get(staffId) || 0) - slotDurationHours(slot)
          );
          console.warn(
            `scheduleSolver: removed double-booked ${staffId} from ` +
              `${slot.location} ${slot.start}-${slot.end}`
          );
        }
      } else {
        kept.push(entry.interval);
      }
    }
  });

  // Re-report any regular slot left under its requirement after the cleanup.
  for (const slot of state.template.slots) {
    if (slot.everyone) continue;
    if (isManualOnlySlot(slot)) continue; // staffed by hand — empty isn't a gap
    const have = (state.slotAssignments.get(slot.id) || []).length;
    if (have >= slot.required) continue;
    const missing = slot.required - have;
    const existing = state.unfilledSlots.find((u) => u.slotId === slot.id);
    if (existing) existing.missing = missing;
    else
      state.unfilledSlots.push({
        slotId: slot.id,
        missing,
        reason: 'אין חיילים פנויים לזמן זה',
      });
  }
};

// ---------------------------------------------------------------------------
// Materialisation
// ---------------------------------------------------------------------------

const toDaySchedule = (state: SolverState): DaySchedule => {
  const slotAssignments: Record<string, string[]> = {};
  for (const slot of state.template.slots) {
    slotAssignments[slot.id] = state.slotAssignments.get(slot.id) || [];
  }

  const specialStates: Partial<Record<SpecialStateId, string[]>> = {};
  for (const role of SPECIAL_STATE_IDS) {
    const list = state.specialStates.get(role) || [];
    if (list.length) specialStates[role] = list;
  }

  const staffHours: Record<string, number> = {};
  state.hoursByStaff.forEach((hrs, id) => {
    staffHours[id] = Number(hrs.toFixed(2));
  });

  return {
    date: state.date,
    day: state.day,
    slotAssignments,
    specialStates,
    unfilledSlots: state.unfilledSlots,
    staffHours,
    generatedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const dayOfWeekFromDate = (d: Date): DayOfWeek => {
  const map: DayOfWeek[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  ];
  return map[d.getDay()];
};

/**
 * Generate a populated daily schedule.
 *
 * @param date     Calendar date the schedule applies to.
 * @param staff    Eligible roster — typically Firestore users (role='soldier'),
 *                 with commanders and other excluded names filtered out
 *                 upstream.
 * @param template The shape of slots for this weekday.
 * @param options  Pinning, forced states, previous day, RNG seed.
 */
export function generateSchedule(
  date: Date,
  staff: Staff[],
  template: DayTemplate,
  options: SolverOptions = {}
): DaySchedule {
  if (template.day !== dayOfWeekFromDate(date)) {
    console.warn(
      `generateSchedule: template.day (${template.day}) doesn't match date weekday (${dayOfWeekFromDate(date)})`
    );
  }

  const state = createState(date, template.day, staff, template, options);

  applyAvailability(state);          // 1
  applyMishikhaPriority(state);      // 2
  applyFixedDuties(state);           // 3
  applyPinnedAssignments(state);     // 4
  preSelectSpecialShifts(state);     // 5 — reserve evening/afternoon roster

  // 6 — regular slots, hardest first. משמרת_ערב people are already in
  // inSpecialState by this point, so SLOT_BLOCK_BEFORE keeps them out of
  // any slot starting before 14:30 automatically.
  for (const slot of orderRegularSlots(template.slots)) {
    fillRegularSlot(state, slot);
  }

  fillEveryoneSlots(state);          // 7
  rebalanceHours(state);             // 8 — even out assigned hours across workers
  validateNoDoubleBooking(state);    // 9 — assert no overlaps, re-report gaps
  deriveRestState(state);            // 10

  return toDaySchedule(state);
}

/**
 * Patch a published day after a last-minute drop-out (e.g. a soldier called
 * in sick the morning of). Clears the absentee from every slot/state, marks
 * them unavailable, and re-runs the solver with all OTHER assignments pinned
 * — so only the vacated rows get re-filled and nothing else moves.
 *
 * Returns a NEW DaySchedule; the input is not mutated.
 */
export function reassignAfterDropout(
  existing: DaySchedule,
  dropoutStaffId: string,
  allStaff: Staff[],
  template: DayTemplate,
  options: SolverOptions = {}
): DaySchedule {
  const pinnedAssignments: Record<string, string[]> = {};
  for (const [slotId, ids] of Object.entries(existing.slotAssignments)) {
    pinnedAssignments[slotId] = ids.filter((id) => id !== dropoutStaffId);
  }

  const forcedSpecialStates: Partial<Record<SpecialStateId, string[]>> = {};
  for (const role of SPECIAL_STATE_IDS) {
    if (role === 'מנוחה') continue; // derived; never force
    const list = existing.specialStates[role] || [];
    const filtered = list.filter((id) => id !== dropoutStaffId);
    if (filtered.length) forcedSpecialStates[role] = filtered;
  }

  const patchedStaff = allStaff.map((s) =>
    s.id === dropoutStaffId
      ? { ...s, unavailableDates: [...(s.unavailableDates || []), existing.date] }
      : s
  );

  return generateSchedule(new Date(existing.date), patchedStaff, template, {
    ...options,
    pinnedAssignments,
    forcedSpecialStates,
  });
}

/** Helper: distribution diagnostics for the assigned hours. */
export function fairnessReport(schedule: DaySchedule): {
  average: number;
  stdDev: number;
  min: number;
  max: number;
} {
  const hours = Object.values(schedule.staffHours);
  if (hours.length === 0) return { average: 0, stdDev: 0, min: 0, max: 0 };
  const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
  const variance = hours.reduce((a, b) => a + (b - avg) ** 2, 0) / hours.length;
  return {
    average: Number(avg.toFixed(2)),
    stdDev: Number(Math.sqrt(variance).toFixed(2)),
    min: Math.min(...hours),
    max: Math.max(...hours),
  };
}
