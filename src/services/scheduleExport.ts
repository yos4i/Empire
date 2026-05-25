// Convert a solved DaySchedule into the WhatsApp/Telegram-style plain-text
// schedule format the unit currently uses by hand. Matches the shape of the
// real-world examples — section headers wrapped in *bold markers*, slots
// ordered start-time-first with תגבור rows after the primary slots, and the
// special states (משיכה / מנוחה / משמרת ערב / משמרת צהריים) listed at the
// bottom.

import type {
  DayOfWeek,
  DaySchedule,
  DayTemplate,
  LocationId,
  ShiftSlot,
  SpecialStateId,
} from '../types/scheduling';

const DAYS_HE: Record<DayOfWeek, string> = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי',
  saturday: 'שבת',
};

// Render order matches the original telegram-format examples.
const LOCATION_ORDER: LocationId[] = ['יסודי', 'צפוני', 'חוגים', 'חטיבה'];

const SPECIAL_ORDER: SpecialStateId[] = [
  'משיכה',
  'מנוחה',
  'משמרת_צהריים',
  'משמרת_ערב',
];
const SPECIAL_LABELS: Record<SpecialStateId, string> = {
  משיכה: 'משיכה',
  מנוחה: 'מנוחה',
  משמרת_צהריים: 'משמרת צהריים',
  משמרת_ערב: 'משמרת ערב',
};

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const formatSlotLine = (
  slot: ShiftSlot,
  assignedNames: string[]
): string | null => {
  const timeRange = `${slot.start}-${slot.end}`;
  const prefix = slot.isReinforcement ? 'תגבור ' : '';

  if (slot.everyone) {
    // "*כולם*" rows always print the marker even if (rarely) empty.
    return `${prefix}${timeRange} *כולם*`;
  }

  // Don't print empty primary/תגבור rows — matches the examples.
  if (assignedNames.length === 0) return null;

  return `${prefix}${timeRange} ${assignedNames.join(' ')}`;
};

/**
 * Render the schedule. `staffNameById` only needs to expose `.name` per id
 * — this keeps the formatter decoupled from the full Staff interface so it
 * can be called from JS pages without TypeScript complaints.
 */
export function exportDayScheduleToText(
  schedule: DaySchedule,
  template: DayTemplate,
  staffNameById: Record<string, string>
): string {
  const lines: string[] = [];
  const nameOf = (id: string) => staffNameById[id] || id;

  lines.push(`*סידור יום ${DAYS_HE[schedule.day]}:*`);
  lines.push('');

  for (const loc of LOCATION_ORDER) {
    const locSlots = template.slots.filter((s) => s.location === loc);
    if (locSlots.length === 0) continue;

    const primary = locSlots
      .filter((s) => !s.isReinforcement)
      .sort((a, b) => toMin(a.start) - toMin(b.start));
    const reinforcement = locSlots
      .filter((s) => s.isReinforcement)
      .sort((a, b) => toMin(a.start) - toMin(b.start));

    const rendered: string[] = [];
    for (const slot of [...primary, ...reinforcement]) {
      const assigned = (schedule.slotAssignments[slot.id] || []).map(nameOf);
      const line = formatSlotLine(slot, assigned);
      if (line) rendered.push(line);
    }

    // Skip locations that ended up with no printable content (e.g. חוגים
    // on a day where every slot is empty).
    if (rendered.length === 0) continue;

    lines.push(`*${loc}*`);
    lines.push(...rendered);
    lines.push('');
  }

  for (const role of SPECIAL_ORDER) {
    const list = schedule.specialStates[role] || [];
    if (list.length === 0) continue;
    const names = list.map(nameOf).join(' ');
    lines.push(`*${SPECIAL_LABELS[role]}* ${names}`);
  }

  // Long-shift line — emitted only on days like Tuesday where the template
  // has no evening or afternoon-shift quota but the day still extends past
  // 14:30. Lists anyone holding a slot that starts at 14:30 or later, in the
  // form "*עד 16:15* ירין הראל עבדתי".
  const quotas = template.specialStateQuotas || {};
  const hasLateRoster =
    (quotas['משמרת_ערב'] || 0) > 0 || (quotas['משמרת_צהריים'] || 0) > 0;
  if (!hasLateRoster) {
    const cutoff = toMin('14:30');
    let maxEnd = '00:00';
    const ids = new Set<string>();
    const slotMap: Record<string, ShiftSlot> = {};
    for (const s of template.slots) slotMap[s.id] = s;
    for (const [slotId, assigned] of Object.entries(schedule.slotAssignments || {})) {
      const slot = slotMap[slotId];
      if (!slot) continue;
      if (toMin(slot.end) > toMin(maxEnd)) maxEnd = slot.end;
      if (toMin(slot.start) < cutoff) continue;
      for (const id of assigned) ids.add(id);
    }
    if (ids.size > 0) {
      const names = Array.from(ids).map(nameOf).join(' ');
      lines.push(`*עד ${maxEnd}* ${names}`);
    }
  }

  // Trim trailing blank line so the output doesn't end with whitespace.
  while (lines.length && lines[lines.length - 1] === '') lines.pop();

  return lines.join('\n');
}
