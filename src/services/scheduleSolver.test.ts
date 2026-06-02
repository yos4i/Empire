import { generateSchedule } from './scheduleSolver';
import { DAILY_TEMPLATES } from '../config/dailyShiftTemplates';
import type { DayOfWeek, Staff } from '../types/scheduling';

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// A real Date whose weekday matches each template (June 2 2026 is a Tuesday).
const DATE_FOR: Record<string, Date> = {
  sunday: new Date(2026, 4, 31),
  monday: new Date(2026, 5, 1),
  tuesday: new Date(2026, 5, 2),
  wednesday: new Date(2026, 5, 3),
  thursday: new Date(2026, 5, 4),
};

const makeStaff = (
  prefix: string,
  n: number,
  shiftWindow: Staff['shiftWindow']
): Staff[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    name: `${prefix}${i}`,
    shiftWindow,
  }));

const WEEKDAYS: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

describe('scheduleSolver — no gaps / no double-booking', () => {
  // Bug: Tuesday (no evening roster) left every ≥14:30 slot empty because
  // morning soldiers were hard-blocked from the afternoon. With the soft
  // fallback they now stay late and fill it.
  test('Tuesday afternoon slots fill from morning staff (no gaps)', () => {
    const template = DAILY_TEMPLATES['tuesday']!;
    const staff = makeStaff('m', 20, 'morning');
    const sched = generateSchedule(DATE_FOR.tuesday, staff, template, { seed: 1 });

    const afternoon = template.slots.filter(
      (s) => !s.everyone && toMin(s.start) >= toMin('14:30')
    );
    expect(afternoon.length).toBeGreaterThan(0);
    for (const slot of afternoon) {
      expect((sched.slotAssignments[slot.id] || []).length).toBe(slot.required);
    }
    expect(sched.unfilledSlots).toHaveLength(0);
  });

  // A double-shift ('both') soldier must be placeable in BOTH a morning and an
  // afternoon slot — the loader used to collapse them to one window.
  test("a 'both' soldier can be assigned across the 14:30 boundary", () => {
    const template = DAILY_TEMPLATES['wednesday']!;
    // Only one 'both' soldier is free in the afternoon; force them to be the
    // one who covers a late slot by starving the evening roster.
    const staff: Staff[] = [
      ...makeStaff('m', 12, 'morning'),
      { id: 'dual', name: 'dual', shiftWindow: 'both' },
    ];
    const sched = generateSchedule(DATE_FOR.wednesday, staff, template, { seed: 3 });

    const slotsById = new Map(template.slots.map((s) => [s.id, s]));
    let hasMorning = false;
    let hasAfternoon = false;
    for (const [slotId, ids] of Object.entries(sched.slotAssignments)) {
      if (!ids.includes('dual')) continue;
      const slot = slotsById.get(slotId)!;
      if (toMin(slot.start) < toMin('14:30')) hasMorning = true;
      else hasAfternoon = true;
    }
    // 'both' is eligible everywhere; with a scarce afternoon pool they should
    // end up working both halves.
    expect(hasMorning).toBe(true);
    expect(hasAfternoon).toBe(true);
  });

  // Hours should be balanced across the MORNING workers (the user's complaint
  // was two morning soldiers 1h apart). Evening soldiers inherently work fewer
  // hours — fewer evening slots — and can't swap with morning staff, so only
  // the within-window spread is meaningful.
  test.each(WEEKDAYS)('%s: morning workers stay within ~1h of each other', (day) => {
    const template = DAILY_TEMPLATES[day]!;
    const staff = [
      ...makeStaff('m', 14, 'morning'),
      ...makeStaff('e', 6, 'evening'),
    ];
    const sched = generateSchedule(DATE_FOR[day], staff, template, { seed: 5 });

    const morningWorked = Object.entries(sched.staffHours)
      .filter(([id, h]) => id.startsWith('m') && h > 0)
      .map(([, h]) => h);
    if (morningWorked.length < 2) return;
    const spread = Math.max(...morningWorked) - Math.min(...morningWorked);
    // Slots come in 0.75–2h chunks; a single move shifts ≥0.75h, so we can't
    // promise ≤0.5h, but the within-window spread should stay within one chunk.
    expect(spread).toBeLessThanOrEqual(1.0);
  });

  // Core invariant for every weekday: no soldier is ever in two slots whose
  // times overlap.
  test.each(WEEKDAYS)('%s: no soldier is double-booked', (day) => {
    const template = DAILY_TEMPLATES[day]!;
    const staff = [
      ...makeStaff('m', 16, 'morning'),
      ...makeStaff('e', 8, 'evening'),
      ...makeStaff('b', 2, 'both'),
    ];
    const sched = generateSchedule(DATE_FOR[day], staff, template, { seed: 9 });

    const slotsById = new Map(template.slots.map((s) => [s.id, s]));
    const intervalsByStaff = new Map<string, { start: number; end: number }[]>();
    for (const [slotId, ids] of Object.entries(sched.slotAssignments)) {
      const slot = slotsById.get(slotId)!;
      const interval = { start: toMin(slot.start), end: toMin(slot.end) };
      for (const id of ids) {
        const list = intervalsByStaff.get(id) || [];
        list.push(interval);
        intervalsByStaff.set(id, list);
      }
    }

    intervalsByStaff.forEach((intervals, id) => {
      intervals.sort((a, b) => a.start - b.start);
      for (let i = 1; i < intervals.length; i++) {
        const prev = intervals[i - 1];
        const cur = intervals[i];
        expect(prev.end).toBeLessThanOrEqual(cur.start); // no overlap
      }
    });
  });
});
