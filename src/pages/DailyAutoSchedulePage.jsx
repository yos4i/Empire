import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import {
  Calendar,
  Home,
  Sparkles,
  Save,
  ChevronRight,
  ChevronLeft,
  UserX,
  X,
  Plus,
  RefreshCw,
  FileText,
  Copy,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { User } from '../entities/User';
import { ShiftAssignment } from '../entities/ShiftAssignment';
import { WeeklySchedule } from '../entities/WeeklySchedule';
import {
  generateSchedule,
  reassignAfterDropout,
  fairnessReport,
} from '../services/scheduleSolver';
import { loadDaySchedule, saveDaySchedule } from '../services/dailyScheduleStorage';
import { exportDayScheduleToText } from '../services/scheduleExport';
import {
  DAILY_TEMPLATES,
  EXCLUDED_FROM_SCHEDULE,
  STAFF_EARLIEST_START,
} from '../config/dailyShiftTemplates';
import { toWeekStartISO } from '../utils/weekKey';
import { readDraft } from '../utils/scheduleHelpers';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAYS_HE = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי',
  saturday: 'שבת',
};
const SPECIAL_STATE_HE = {
  מנוחה: 'מנוחה',
  משמרת_ערב: 'משמרת ערב',
  משמרת_צהריים: 'משמרת צהריים',
  משיכה: 'משיכה',
};
const ACTIVE_STATE_KEYS = ['משיכה', 'משמרת_ערב', 'משמרת_צהריים'];

// --- Helpers ----------------------------------------------------------------

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const slotHours = (slot) => (toMin(slot.end) - toMin(slot.start)) / 60;

// True when two [start,end) minute-intervals overlap.
const intervalsOverlapMin = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && bStart < aEnd;

// True if assigning `staffId` to `targetSlot` would put them in two places at
// the same hour — i.e. they're already in another slot whose time overlaps.
// Mirrors the solver's hasConflict so the manual picker can't double-book.
const staffSlotConflicts = (schedule, template, staffId, targetSlot) => {
  if (!schedule || !template || !targetSlot) return false;
  const tStart = toMin(targetSlot.start);
  const tEnd = toMin(targetSlot.end);
  const slotById = {};
  for (const s of template.slots) slotById[s.id] = s;
  for (const [slotId, ids] of Object.entries(schedule.slotAssignments || {})) {
    if (slotId === targetSlot.id) continue;
    if (!ids.includes(staffId)) continue;
    const s = slotById[slotId];
    if (!s) continue;
    if (intervalsOverlapMin(toMin(s.start), toMin(s.end), tStart, tEnd)) return true;
  }
  return false;
};

// True when a shift key denotes an evening shift (e.g. קריית_חינוך_ערב).
const isEveningShiftKey = (shiftKey) => (shiftKey || '').includes('ערב');

// Extract a soldier_id → { morning, evening } window map for a given day-key
// from a weekly schedule structure (used by both draft and published variants —
// they share the same shape: schedule[day][shiftKey] = { soldiers: [...] }).
//
// A soldier rostered for BOTH a morning and an evening cell gets both flags set
// (a double shift); the solver then assigns them to morning AND evening slots
// separately instead of one window winning and blocking the other.
const buildShiftMapFromWeekly = (weeklySchedule, dayKey) => {
  const out = new Map();
  const dayShifts = weeklySchedule?.[dayKey];
  if (!dayShifts) return out;
  for (const [shiftKey, cell] of Object.entries(dayShifts)) {
    if (!cell || cell.cancelled) continue;
    const evening = isEveningShiftKey(shiftKey);
    for (const soldierId of cell.soldiers || []) {
      const cur = out.get(soldierId) || { morning: false, evening: false };
      if (evening) cur.evening = true;
      else cur.morning = true;
      out.set(soldierId, cur);
    }
  }
  return out;
};

// Load two rosters for a specific date:
//   • `staff` — only soldiers rostered for the day in the weekly schedule,
//     each tagged with `shiftWindow` from their `shift_type`. The solver
//     uses this list.
//   • `allActive` — every active user. Used for name resolution AND as the
//     candidate pool when an admin manually adds an unscheduled soldier
//     via the per-slot picker.
//
// Source priority (matches what the admin sees on the weekly page):
//   1. localStorage admin draft for the week (admin's current edits)
//   2. published weekly_schedules document for the week
//   3. shift_assignments collection for the exact date (legacy fallback)
const loadRosters = async (dateStr, dayKey) => {
  // Parse the YYYY-MM-DD string in LOCAL time. `new Date('2026-05-24')` would
  // be interpreted as UTC midnight, which in IL summer time (UTC+3) is the
  // previous Saturday evening — toWeekStartISO would then return the wrong
  // week and the localStorage draft lookup would miss.
  const [y, m, d] = dateStr.split('-').map(Number);
  const localDate = new Date(y, m - 1, d);
  const weekStart = toWeekStartISO(localDate);

  const [allUsers, publishedWeekly, dayAssignments] = await Promise.all([
    User.list(),
    WeeklySchedule.getWeek(weekStart).catch(() => null),
    ShiftAssignment.filter({ date: dateStr }).catch(() => []),
  ]);

  const isCommanderName = (name) =>
    EXCLUDED_FROM_SCHEDULE.some((sub) => name.includes(sub));

  // EVERYONE active, commanders included. Commanders must still appear in
  // the day's roster count ("12 came in" rather than "10 + commander"),
  // they're just flagged so the solver skips them.
  const allActive = allUsers
    .filter((u) => u.is_active !== false)
    .map((u) => ({
      id: u.id,
      name: u.hebrew_name || u.displayName || u.full_name || u.id,
    }));

  // Resolve the shift map from the first non-empty source.
  let shiftByUser = new Map();
  let sourceLabel = '';

  const draft = readDraft(weekStart);
  if (draft) {
    shiftByUser = buildShiftMapFromWeekly(draft, dayKey);
    if (shiftByUser.size > 0) sourceLabel = 'draft';
  }
  if (shiftByUser.size === 0 && publishedWeekly?.schedule) {
    shiftByUser = buildShiftMapFromWeekly(publishedWeekly.schedule, dayKey);
    if (shiftByUser.size > 0) sourceLabel = 'published';
  }
  if (shiftByUser.size === 0) {
    for (const a of dayAssignments) {
      if (a.status === 'cancelled') continue;
      const evening = isEveningShiftKey(a.shift_type);
      const cur = shiftByUser.get(a.soldier_id) || { morning: false, evening: false };
      if (evening) cur.evening = true;
      else cur.morning = true;
      shiftByUser.set(a.soldier_id, cur);
    }
    if (shiftByUser.size > 0) sourceLabel = 'assignments';
  }

  const staff = allActive
    .filter((u) => shiftByUser.has(u.id))
    .map((u) => {
      const timeRule = STAFF_EARLIEST_START.find((r) => u.name.includes(r.nameSubstring));
      const windows = shiftByUser.get(u.id) || { morning: false, evening: false };
      // morning + evening cells → double shift ('both'); otherwise the single
      // window they hold. Default to morning if somehow neither flag is set.
      const shiftWindow =
        windows.morning && windows.evening
          ? 'both'
          : windows.evening
            ? 'evening'
            : 'morning';
      const commander = isCommanderName(u.name);
      return {
        id: u.id,
        name: u.name,
        shiftWindow,
        ...(commander ? { isCommander: true } : {}),
        ...(timeRule ? { earliestStart: timeRule.earliestStart } : {}),
      };
    });

  return { staff, allActive, sourceLabel };
};

/**
 * Re-derives `staffHours` and `מנוחה` from the current `slotAssignments` and
 * active special states. Run after any manual edit so the panels stay
 * consistent (hours track what's actually assigned; rest = leftover).
 */
const recomputeDerivedFields = (schedule, staff, template) => {
  const slotMap = {};
  for (const s of template.slots) slotMap[s.id] = s;

  const hours = {};
  for (const s of staff) hours[s.id] = 0;
  for (const [slotId, ids] of Object.entries(schedule.slotAssignments || {})) {
    const slot = slotMap[slotId];
    if (!slot) continue;
    const dur = slotHours(slot);
    for (const id of ids) {
      hours[id] = (hours[id] || 0) + dur;
    }
  }
  const staffHours = {};
  for (const id of Object.keys(hours)) staffHours[id] = Number(hours[id].toFixed(2));

  const inActiveState = new Set();
  for (const role of ACTIVE_STATE_KEYS) {
    for (const id of schedule.specialStates?.[role] || []) inActiveState.add(id);
  }
  const hasSlot = new Set();
  for (const ids of Object.values(schedule.slotAssignments || {})) {
    for (const id of ids) hasSlot.add(id);
  }
  const resting = staff
    .filter((s) => !inActiveState.has(s.id) && !hasSlot.has(s.id))
    .map((s) => s.id);

  return {
    ...schedule,
    staffHours,
    specialStates: {
      ...(schedule.specialStates || {}),
      מנוחה: resting,
    },
  };
};

// --- Component --------------------------------------------------------------

export default function DailyAutoSchedulePage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [staff, setStaff] = useState([]);
  // Full active-user roster, used as a name-resolution fallback for ids that
  // may appear in older saved schedules but aren't on today's roster.
  const [allActive, setAllActive] = useState([]);
  // 'draft' | 'published' | 'assignments' | '' — surfaced in the UI so the
  // admin can see whether the roster came from their local edits or a
  // published weekly schedule.
  const [rosterSource, setRosterSource] = useState('');
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  // slotId currently showing its "+ הוסף" picker (null = none open)
  const [pickerSlotId, setPickerSlotId] = useState(null);
  // Export-to-text preview modal
  const [exportText, setExportText] = useState(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayKey = DAY_KEYS[selectedDate.getDay()];
  const template = DAILY_TEMPLATES[dayKey];

  // Resolve names for any id that might appear in the schedule. Anyone in the
  // full active roster lands in the map first; the scheduled subset overwrites
  // them so shiftWindow / earliestStart from the solver pipeline wins.
  const staffById = useMemo(() => {
    const m = {};
    for (const u of allActive) m[u.id] = u;
    for (const s of staff) m[s.id] = s;
    return m;
  }, [staff, allActive]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rosters, existing] = await Promise.all([
          loadRosters(dateStr, dayKey),
          loadDaySchedule(dateStr),
        ]);
        if (cancelled) return;
        setStaff(rosters.staff);
        setAllActive(rosters.allActive);
        setRosterSource(rosters.sourceLabel || '');
        setSchedule(existing);
        setPickerSlotId(null);
      } catch (e) {
        console.error('DailyAutoSchedulePage load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateStr, dayKey]);

  const flashStatus = (msg, ms = 2500) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), ms);
  };

  // --- Auto / save / reset --------------------------------------------------

  const handleAutoAssign = useCallback(async () => {
    if (!template) {
      alert('אין תבנית זמינה ליום זה.');
      return;
    }
    setBusy(true);
    try {
      const yesterday = format(addDays(selectedDate, -1), 'yyyy-MM-dd');
      const prev = await loadDaySchedule(yesterday);
      const result = generateSchedule(selectedDate, staff, template, {
        previousDaySchedule: prev || undefined,
      });
      setSchedule(result);
      flashStatus('✅ סידור נוצר אוטומטית — אפשר לערוך ידנית ולשמור');
    } catch (e) {
      console.error('Auto-assign failed:', e);
      alert('שגיאה בייצור הסידור: ' + e.message);
    } finally {
      setBusy(false);
    }
  }, [selectedDate, staff, template]);

  const handleSave = useCallback(async () => {
    if (!schedule) return;
    setBusy(true);
    try {
      await saveDaySchedule(schedule);
      flashStatus('✅ נשמר ל-Firestore');
    } catch (e) {
      console.error('Save failed:', e);
      alert('שגיאה בשמירה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }, [schedule]);

  const handleReset = useCallback(() => {
    if (!window.confirm('לאפס את הסידור של היום? כל השיבוצים שלא נשמרו יאבדו.')) return;
    setSchedule(null);
    setPickerSlotId(null);
  }, []);

  const handleExportText = useCallback(() => {
    if (!schedule || !template) return;
    // The exporter wants name-by-id only — flatten staffById down to that.
    const nameMap = {};
    for (const s of staff) nameMap[s.id] = s.name;
    const text = exportDayScheduleToText(schedule, template, nameMap);
    setExportText(text);
  }, [schedule, template, staff]);

  const handleCopyExport = useCallback(async () => {
    if (!exportText) return;
    try {
      await navigator.clipboard.writeText(exportText);
      flashStatus('✅ הועתק ללוח');
    } catch (e) {
      console.error('Clipboard write failed:', e);
      alert('שגיאה בהעתקה — סמן את הטקסט ידנית והעתק.');
    }
  }, [exportText]);

  // --- Manual edit ----------------------------------------------------------

  const handleRemoveFromSlot = useCallback(
    (slotId, staffId) => {
      if (!schedule || !template) return;
      const next = {
        ...schedule,
        slotAssignments: {
          ...schedule.slotAssignments,
          [slotId]: (schedule.slotAssignments[slotId] || []).filter((id) => id !== staffId),
        },
      };
      setSchedule(recomputeDerivedFields(next, staff, template));
    },
    [schedule, template, staff]
  );

  const handleAddToSlot = useCallback(
    (slotId, staffId) => {
      if (!schedule || !template) return;
      const existing = schedule.slotAssignments[slotId] || [];
      if (existing.includes(staffId)) return;
      // Block same-hour double-booking: if the soldier already holds a slot
      // that overlaps this one, require explicit confirmation.
      const slot = template.slots.find((s) => s.id === slotId);
      if (slot && staffSlotConflicts(schedule, template, staffId, slot)) {
        const name = staffById[staffId]?.name || staffId;
        if (
          !window.confirm(
            `⚠️ ${name} כבר משובץ/ת בשעות חופפות (${slot.start}-${slot.end}).\nלשבץ בכל זאת?`
          )
        ) {
          setPickerSlotId(null);
          return;
        }
      }
      // If they were in מנוחה, taking a slot means they're no longer resting —
      // recomputeDerivedFields handles that. If they were in another active
      // state (e.g. משמרת_ערב), leave it — admin chose dual-assignment.
      const next = {
        ...schedule,
        slotAssignments: {
          ...schedule.slotAssignments,
          [slotId]: [...existing, staffId],
        },
      };
      setSchedule(recomputeDerivedFields(next, staff, template));
      setPickerSlotId(null);
    },
    [schedule, template, staff, staffById]
  );

  const handleToggleSpecialState = useCallback(
    (role, staffId) => {
      if (!schedule || !template) return;
      // מנוחה is derived — admins shouldn't toggle it directly. Adding/removing
      // people happens via slot edits or active-state toggles.
      if (role === 'מנוחה') return;
      const list = schedule.specialStates?.[role] || [];
      const present = list.includes(staffId);
      const nextList = present ? list.filter((id) => id !== staffId) : [...list, staffId];
      const next = {
        ...schedule,
        specialStates: {
          ...(schedule.specialStates || {}),
          [role]: nextList,
        },
      };
      setSchedule(recomputeDerivedFields(next, staff, template));
    },
    [schedule, template, staff]
  );

  const handleMarkSick = useCallback(
    (staffId) => {
      if (!schedule || !template) return;
      const person = staffById[staffId];
      if (!person) return;
      if (!window.confirm(`לסמן את ${person.name} כחולה/לא זמין ולשבץ מחדש?`)) return;
      try {
        const patched = reassignAfterDropout(schedule, staffId, staff, template);
        setSchedule(patched);
        flashStatus(`🔄 ${person.name} סומן לא זמין — הסידור עודכן`);
      } catch (e) {
        console.error('Reassign failed:', e);
        alert('שגיאה בשיבוץ מחדש: ' + e.message);
      }
    },
    [schedule, template, staff, staffById]
  );

  // --- Derived views --------------------------------------------------------

  const slotsByLocation = useMemo(() => {
    if (!template) return {};
    const grouped = {};
    for (const slot of template.slots) {
      (grouped[slot.location] = grouped[slot.location] || []).push(slot);
    }
    return grouped;
  }, [template]);

  // "Working today" = anyone assigned to ≥1 slot OR in any active special state.
  // Returns sorted [{ id, name, hours, slotLabels, stateLabels }, …].
  const rosterSummary = useMemo(() => {
    if (!schedule || !template) {
      return { working: [], resting: [], commanders: [], total: 0 };
    }
    const slotMap = {};
    for (const s of template.slots) slotMap[s.id] = s;

    const commanderIds = new Set(staff.filter((s) => s.isCommander).map((s) => s.id));

    const perStaff = new Map();
    const ensure = (id) => {
      if (!perStaff.has(id)) {
        perStaff.set(id, {
          id,
          name: staffById[id]?.name || id,
          hours: schedule.staffHours?.[id] || 0,
          slotLabels: [],
          stateLabels: [],
        });
      }
      return perStaff.get(id);
    };

    for (const [slotId, ids] of Object.entries(schedule.slotAssignments || {})) {
      const slot = slotMap[slotId];
      if (!slot) continue;
      for (const id of ids) {
        const r = ensure(id);
        r.slotLabels.push({ loc: slot.location, start: slot.start, end: slot.end });
      }
    }

    for (const role of ACTIVE_STATE_KEYS) {
      for (const id of schedule.specialStates?.[role] || []) {
        const r = ensure(id);
        r.stateLabels.push(SPECIAL_STATE_HE[role]);
      }
    }

    const working = Array.from(perStaff.values())
      .filter((r) => !commanderIds.has(r.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));

    const resting = (schedule.specialStates?.['מנוחה'] || [])
      .filter((id) => !commanderIds.has(id))
      .map((id) => ({ id, name: staffById[id]?.name || id }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));

    // Commanders — rostered for the day but not placed anywhere by the solver.
    const commanders = staff
      .filter((s) => s.isCommander)
      .map((s) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));

    const total = working.length + resting.length + commanders.length;

    return { working, resting, commanders, total };
  }, [schedule, template, staffById, staff]);

  // Candidates for the manual slot picker: ALL active users (not just the
  // scheduled subset) — admins explicitly need to be able to drop in a
  // soldier who wasn't rostered for the day. Scheduled folks are listed
  // first; unscheduled appear below with a "(לא משובץ ביום זה)" tag.
  const availableForSlot = useCallback(
    (slotId) => {
      const already = new Set(schedule?.slotAssignments?.[slotId] || []);
      const scheduledIds = new Set(staff.map((s) => s.id));
      const slot = template?.slots.find((s) => s.id === slotId) || null;
      const list = allActive
        .filter((u) => !already.has(u.id))
        .map((u) => ({
          id: u.id,
          name: u.name,
          scheduled: scheduledIds.has(u.id),
          // Already booked in an overlapping slot — can't be added here.
          conflict: slot ? staffSlotConflicts(schedule, template, u.id, slot) : false,
        }));
      list.sort((a, b) => {
        if (a.scheduled !== b.scheduled) return a.scheduled ? -1 : 1;
        return a.name.localeCompare(b.name, 'he');
      });
      return list;
    },
    [schedule, staff, allActive, template]
  );

  const fairness = useMemo(
    () => (schedule ? fairnessReport(schedule) : null),
    [schedule]
  );

  // For "כולם" slots: derive the evening-shift roster only — anyone in
  // משמרת_ערב or משמרת_צהריים (the people who actually stay through the late
  // reinforcement window). Regular morning-slot folks are intentionally
  // excluded.
  const everyoneWorkingToday = useMemo(() => {
    if (!schedule) return [];
    const set = new Set();
    for (const role of ['משמרת_ערב', 'משמרת_צהריים']) {
      for (const id of schedule.specialStates?.[role] || []) set.add(id);
    }
    return Array.from(set);
  }, [schedule]);

  // Long-shift derivation for days like Tuesday — when the template has NO
  // evening or afternoon-shift quota, anyone working at least one slot that
  // starts in the afternoon (>= 14:30) is part of the "long shift" group.
  // The label uses the day's latest end time (e.g. "עד 16:15").
  const longShiftGroup = useMemo(() => {
    if (!schedule || !template) return null;
    const q = template.specialStateQuotas || {};
    if ((q['משמרת_ערב'] || 0) > 0) return null;
    if ((q['משמרת_צהריים'] || 0) > 0) return null;

    const slotMap = {};
    for (const s of template.slots) slotMap[s.id] = s;

    const eveningCutoff = toMin('14:30');
    let maxEnd = '00:00';
    const ids = new Set();
    for (const [slotId, assigned] of Object.entries(schedule.slotAssignments || {})) {
      const slot = slotMap[slotId];
      if (!slot) continue;
      if (toMin(slot.end) > toMin(maxEnd)) maxEnd = slot.end;
      if (toMin(slot.start) < eveningCutoff) continue;
      for (const id of assigned) ids.add(id);
    }
    if (ids.size === 0) return null;
    return { maxEnd, ids: Array.from(ids) };
  }, [schedule, template]);

  // --- Render ---------------------------------------------------------------

  if (loading) {
    return <div className="p-6 text-center" dir="rtl">טוען נתונים...</div>;
  }

  const renderStaffChip = (staffId, slotId) => {
    const person = staffById[staffId];
    const name = person?.name || staffId;
    return (
      <span
        key={`${slotId}-${staffId}`}
        className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-900 rounded-full text-xs pl-1 pr-2 py-0.5"
      >
        {name}
        <button
          onClick={() => handleRemoveFromSlot(slotId, staffId)}
          className="hover:bg-gray-200 rounded-full p-0.5 text-gray-600"
          title="הסר מהמשבצת הזו"
        >
          <X className="w-3 h-3" />
        </button>
      </span>
    );
  };

  // Read-only chip used for derived "כולם" rosters — these aren't real
  // assignments stored in slotAssignments, so there's no per-chip remove.
  const renderDerivedChip = (staffId, slotId) => {
    const person = staffById[staffId];
    const name = person?.name || staffId;
    return (
      <span
        key={`derived-${slotId}-${staffId}`}
        className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-full text-xs px-2 py-0.5"
      >
        {name}
      </span>
    );
  };

  const renderSpecialStateChip = (staffId, role) => {
    const person = staffById[staffId];
    const name = person?.name || staffId;
    return (
      <span
        key={`special-${role}-${staffId}`}
        className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-900 rounded-full text-xs pl-1 pr-2 py-0.5"
      >
        {name}
        {role !== 'מנוחה' && (
          <button
            onClick={() => handleToggleSpecialState(role, staffId)}
            className="hover:bg-gray-200 rounded-full p-0.5 text-gray-600"
            title={`הסר מ-${SPECIAL_STATE_HE[role]}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin')}>
          <Home className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl md:text-2xl font-bold text-black">
            סידור עבודה אוטומטי - יומי
          </h1>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex justify-center mb-4">
        <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full shadow-sm px-1.5 py-1">
          <button
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
            title="יום קודם"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="px-3 min-w-[170px] text-center">
            <div className="text-sm font-semibold text-gray-900 leading-tight">
              יום {DAYS_HE[dayKey]}
            </div>
            <div
              dir="ltr"
              className="text-[11px] text-gray-500 leading-tight tracking-wide"
            >
              {format(selectedDate, 'dd/MM/yyyy')}
            </div>
          </div>
          <button
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
            title="יום הבא"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {rosterSource && (
        <div className="text-center mb-2">
          <Badge
            className={
              rosterSource === 'draft'
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : rosterSource === 'published'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-blue-100 text-blue-800 border border-blue-200'
            }
          >
            רוסטר היום מתוך:{' '}
            {rosterSource === 'draft'
              ? 'טיוטה מקומית של ניהול סידור'
              : rosterSource === 'published'
              ? 'סידור שבועי שפורסם'
              : 'מאגר השיבוצים'}
          </Badge>
        </div>
      )}

      {status && (
        <div className="text-center mb-2">
          <p className="text-sm text-blue-700">{status}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center justify-center mb-4">
        <Button
          onClick={handleAutoAssign}
          disabled={busy || !template}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          size="sm"
        >
          <Sparkles className="w-4 h-4 ml-2" />
          {busy ? 'מייצר...' : 'בצע שיבוץ אוטומטי'}
        </Button>
        <Button
          onClick={handleSave}
          disabled={busy || !schedule}
          className="bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          <Save className="w-4 h-4 ml-2" />
          שמור
        </Button>
        <Button
          onClick={handleExportText}
          disabled={busy || !schedule}
          variant="outline"
          size="sm"
          className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
        >
          <FileText className="w-4 h-4 ml-2" />
          ייצא לטקסט
        </Button>
        <Button
          onClick={handleReset}
          disabled={busy || !schedule}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 ml-2" />
          אפס
        </Button>
      </div>

      {!template && (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6 text-center text-gray-600">
            אין תבנית פעילה ליום {DAYS_HE[dayKey]} (תבניות זמינות לימים א׳-ה׳).
          </CardContent>
        </Card>
      )}

      {template && staff.length === 0 && (
        <Card className="max-w-2xl mx-auto border-amber-300 bg-amber-50">
          <CardContent className="p-6 text-center text-amber-900">
            אין חיילים משובצים ליום זה בסידור השבועי. עברו לעמוד "ניהול סידור"
            ושבצו חיילים לתאריך זה לפני יצירת הסידור היומי.
          </CardContent>
        </Card>
      )}

      {template && staff.length > 0 && !schedule && (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6 text-center text-gray-600 space-y-2">
            <p>
              עדיין אין סידור ליום זה. לחצו על "בצע שיבוץ אוטומטי" כדי לייצר טיוטה.
            </p>
            <p className="text-xs text-gray-500">
              שובצו לתאריך זה:{' '}
              <strong>{staff.filter((s) => s.shiftWindow === 'morning').length}</strong>{' '}
              משמרת בוקר ·{' '}
              <strong>{staff.filter((s) => s.shiftWindow === 'evening').length}</strong>{' '}
              משמרת ערב
            </p>
          </CardContent>
        </Card>
      )}

      {template && schedule && (
        <div className="space-y-4">
          {/* === Roster panel: who's working today === */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>חיילי היום</span>
                <span className="text-xs font-normal text-gray-500">
                  סה״כ: <strong>{rosterSummary.total}</strong> ·
                  עובדים: <strong>{rosterSummary.working.length}</strong> ·
                  במנוחה: <strong>{rosterSummary.resting.length}</strong>
                  {rosterSummary.commanders.length > 0 && (
                    <>
                      {' '}· מפקדים: <strong>{rosterSummary.commanders.length}</strong>
                    </>
                  )}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="overflow-auto max-h-72 border border-gray-100 rounded">
                <table className="w-full text-sm table-auto border-collapse">
                  <thead className="text-gray-500 bg-gray-50 sticky top-0">
                    <tr className="border-b">
                      <th className="text-right py-2 px-3 font-medium w-32">שם</th>
                      <th className="text-right py-2 px-3 font-medium w-16">שעות</th>
                      <th className="text-right py-2 px-3 font-medium">משבצות</th>
                      <th className="text-right py-2 px-3 font-medium w-40">סטטוסים</th>
                      <th className="py-2 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterSummary.working.map((r) => (
                      <tr key={r.id} className="border-b last:border-b-0 hover:bg-gray-50 align-top">
                        <td className="py-2 px-3 font-medium text-gray-900 whitespace-nowrap">{r.name}</td>
                        <td className="py-2 px-3 text-gray-700 tabular-nums whitespace-nowrap">{r.hours.toFixed(1)}</td>
                        <td className="py-2 px-3 text-gray-600 leading-relaxed">
                          {r.slotLabels.length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-x-2 gap-y-1">
                              {r.slotLabels.map((s, i) => (
                                <span key={i} className="whitespace-nowrap">
                                  <span className="text-gray-700">{s.loc}</span>{' '}
                                  <span dir="ltr" className="inline-block tabular-nums text-gray-500">
                                    {s.start}-{s.end}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {r.stateLabels.map((lbl) => (
                              <Badge
                                key={lbl}
                                className="bg-purple-100 text-purple-800 text-[10px] whitespace-nowrap"
                              >
                                {lbl}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleMarkSick(r.id)}
                            className="text-red-500 hover:bg-red-50 rounded p-1 inline-flex"
                            title="סמן כלא זמין ושבץ מחדש"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rosterSummary.resting.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b last:border-b-0 hover:bg-gray-50 text-gray-500 align-top"
                      >
                        <td className="py-2 px-3 whitespace-nowrap">{r.name}</td>
                        <td className="py-2 px-3 tabular-nums">0.0</td>
                        <td className="py-2 px-3 italic">מנוחה</td>
                        <td className="py-2 px-3"></td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleMarkSick(r.id)}
                            className="text-red-500 hover:bg-red-50 rounded p-1 inline-flex"
                            title="סמן כלא זמין"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rosterSummary.commanders.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b last:border-b-0 hover:bg-amber-50 align-top bg-amber-50/40"
                      >
                        <td className="py-2 px-3 font-medium text-amber-900 whitespace-nowrap">
                          {r.name}
                        </td>
                        <td className="py-2 px-3 text-amber-700 tabular-nums">—</td>
                        <td className="py-2 px-3">
                          <Badge className="bg-amber-100 text-amber-800 text-[10px]">
                            מפקד · לא משובץ
                          </Badge>
                        </td>
                        <td className="py-2 px-3"></td>
                        <td className="py-2 px-2"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* === Special states — moved up so admin sees them immediately === */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>משמרות מיוחדות</span>
                <span className="text-xs font-normal text-gray-500">
                  הקבוצות שמוקצות לפני מילוי המשבצות
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(SPECIAL_STATE_HE)
                .filter(
                  ([key]) =>
                    key !== 'מנוחה' && key !== 'משמרת_ערב' && key !== 'משמרת_צהריים'
                )
                .map(([key, label]) => {
                const list = schedule.specialStates[key] || [];
                const target = template.specialStateQuotas?.[key];
                const derived = key === 'מנוחה';
                const inactive = !derived && (target ?? 0) === 0;
                const unfilledForState = schedule.unfilledSlots.find(
                  (u) => u.slotId === `special:${key}`
                );
                const filledOk = !derived && target && list.length >= target;
                const countBadge = derived
                  ? `${list.length}`
                  : target
                  ? `${list.length}/${target}`
                  : `${list.length}`;
                const badgeColor = derived
                  ? 'bg-gray-100 text-gray-700'
                  : inactive
                  ? 'bg-gray-100 text-gray-500'
                  : filledOk
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800';
                return (
                  <div
                    key={key}
                    className={`border rounded p-2 ${
                      inactive ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="font-semibold text-sm text-gray-800 mb-1 flex items-center justify-between gap-1">
                      <span>{label}</span>
                      <div className="flex items-center gap-1">
                        {derived && (
                          <span className="text-[10px] text-gray-400 font-normal">(נגזר)</span>
                        )}
                        <Badge className={`${badgeColor} text-[10px]`}>{countBadge}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {inactive ? (
                        <span className="text-[11px] text-gray-400 italic">
                          לא רלוונטי ליום זה
                        </span>
                      ) : list.length === 0 ? (
                        <span className="text-[11px] text-gray-400 italic">— ריק —</span>
                      ) : (
                        list.map((id) => renderSpecialStateChip(id, key))
                      )}
                    </div>
                    {unfilledForState && (
                      <p className="text-[10px] text-red-700 mt-1.5 leading-tight">
                        ⚠ {unfilledForState.reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* === "עד 16:15" panel — shown on days without an evening shift === */}
          {longShiftGroup && (
            <Card className="border-orange-200 bg-orange-50/40">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>
                    עד{' '}
                    <span dir="ltr" className="inline-block tabular-nums">
                      {longShiftGroup.maxEnd}
                    </span>
                  </span>
                  <Badge className="bg-orange-100 text-orange-800 text-[10px]">
                    {longShiftGroup.ids.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="flex flex-wrap gap-1">
                  {longShiftGroup.ids.map((id) => {
                    const person = staffById[id];
                    return (
                      <span
                        key={`longshift-${id}`}
                        className="inline-flex items-center gap-1 bg-orange-100 border border-orange-200 text-orange-900 rounded-full text-xs px-2 py-0.5"
                      >
                        {person?.name || id}
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* === Fairness === */}
          {fairness && (
            <Card>
              <CardContent className="p-3 flex flex-wrap gap-3 items-center text-xs text-gray-700 justify-center">
                <span>שעות ממוצע: <strong>{fairness.average}</strong></span>
                <span>סטיית תקן: <strong>{fairness.stdDev}</strong></span>
                <span>טווח: <strong>{fairness.min}</strong> – <strong>{fairness.max}</strong></span>
                {schedule.unfilledSlots.length > 0 && (
                  <Badge className="bg-red-100 text-red-800">
                    {schedule.unfilledSlots.length} משבצות חסרות
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}

          {/* === Per-location slot grid === */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(slotsByLocation).map(([location, slots]) => (
              <Card key={location}>
                <CardHeader className="p-3 bg-purple-100 border-b border-purple-200">
                  <CardTitle className="text-base text-purple-900 text-center">
                    {location}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-2">
                  {slots.map((slot) => {
                    const assigned = schedule.slotAssignments[slot.id] || [];
                    const unfilled = schedule.unfilledSlots.find((u) => u.slotId === slot.id);
                    const isPickerOpen = pickerSlotId === slot.id;
                    return (
                      <div
                        key={slot.id}
                        className={`p-2 rounded border text-xs ${
                          slot.isReinforcement
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-gray-800">
                            {slot.isReinforcement && 'תגבור · '}
                            <span dir="ltr" className="inline-block">
                              {slot.start}-{slot.end}
                            </span>
                          </span>
                          {slot.everyone ? (
                            <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">
                              כולם
                            </Badge>
                          ) : (
                            <Badge
                              className={`text-[10px] ${
                                assigned.length >= slot.required
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {assigned.length}/{slot.required}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {assigned.length > 0 ? (
                            assigned.map((id) => renderStaffChip(id, slot.id))
                          ) : slot.everyone ? (
                            everyoneWorkingToday.length === 0 ? (
                              <span className="text-gray-400 italic">— אין חיילים פעילים —</span>
                            ) : (
                              everyoneWorkingToday.map((id) => renderDerivedChip(id, slot.id))
                            )
                          ) : (
                            <span className="text-gray-400 italic">— ריק —</span>
                          )}
                        </div>

                        {/* Manual add — picker is a <select> for minimum UI surface */}
                        <div className="mt-1 flex items-center gap-1">
                          {isPickerOpen ? (
                            <>
                              <select
                                autoFocus
                                className="text-xs border border-gray-300 rounded px-1 py-0.5 flex-1"
                                defaultValue=""
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) handleAddToSlot(slot.id, val);
                                }}
                              >
                                <option value="" disabled>
                                  — בחר חייל —
                                </option>
                                {(() => {
                                  const opts = availableForSlot(slot.id);
                                  const scheduled = opts.filter((o) => o.scheduled);
                                  const unscheduled = opts.filter((o) => !o.scheduled);
                                  return (
                                    <>
                                      {scheduled.length > 0 && (
                                        <optgroup label="משובצים ביום זה">
                                          {scheduled.map((s) => (
                                            <option key={s.id} value={s.id} disabled={s.conflict}>
                                              {s.name} ({(schedule.staffHours?.[s.id] || 0).toFixed(1)}h)
                                              {s.conflict ? ' ⛔ חופף בשעות' : ''}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      {unscheduled.length > 0 && (
                                        <optgroup label="לא משובצים ביום זה">
                                          {unscheduled.map((s) => (
                                            <option key={s.id} value={s.id} disabled={s.conflict}>
                                              {s.name} (לא בסידור)
                                              {s.conflict ? ' ⛔ חופף בשעות' : ''}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                    </>
                                  );
                                })()}
                              </select>
                              <button
                                onClick={() => setPickerSlotId(null)}
                                className="text-gray-500 hover:bg-gray-100 rounded p-0.5"
                                title="סגור"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setPickerSlotId(slot.id)}
                              className="text-blue-600 hover:bg-blue-50 rounded p-0.5 inline-flex items-center"
                              title="הוסף חייל למשבצת זו"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {unfilled && (
                          <p className="text-[10px] text-red-700 mt-1">{unfilled.reason}</p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>

        </div>
      )}

      {/* === Export-text preview modal === */}
      {exportText !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          dir="rtl"
          onClick={() => setExportText(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                סידור היום כטקסט
              </h3>
              <button
                onClick={() => setExportText(null)}
                className="text-gray-500 hover:bg-gray-100 rounded p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-auto">
              <p className="text-xs text-gray-500 mb-2">
                העתיקו והדביקו ב-WhatsApp / Telegram. הטקסט כבר מעוצב בפורמט
                המקובל (כולל סימני <code>*bold*</code>).
              </p>
              <textarea
                readOnly
                value={exportText}
                className="w-full h-80 p-3 border border-gray-300 rounded font-mono text-sm bg-gray-50 leading-relaxed"
                dir="rtl"
                onFocus={(e) => e.target.select()}
              />
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setExportText(null)}>
                סגור
              </Button>
              <Button
                onClick={handleCopyExport}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Copy className="w-4 h-4 ml-2" />
                העתק ללוח
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
