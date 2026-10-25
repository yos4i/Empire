import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import {
  AlertTriangle,
  CalendarOff,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { AdminPage } from '../components/admin/AdminShell';
import SoldierPicker from '../components/admin/daily/SoldierPicker';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PageHeader } from '../components/ui/page-header';
import { PageLoader, Spinner } from '../components/ui/spinner';
import { EmptyState } from '../components/ui/empty-state';
import { toast } from '../components/ui/toaster';
import { useConfirm } from '../components/ui/confirm-dialog';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { cn } from '../lib/utils';
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
import { DAY_KEYS, DAY_NAMES_HE, toLocalDate } from '../utils/days';

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
//   • `allNames` — id → name for every user (inactive included).
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
  const displayName = (u) => u.hebrew_name || u.displayName || u.full_name || u.id;
  const allActive = allUsers
    .filter((u) => u.is_active !== false)
    .map((u) => ({
      id: u.id,
      name: displayName(u),
    }));

  // id → name for every user, active or not — lets the export (and chips)
  // resolve any id that ended up in the schedule, not just the day's roster.
  const allNames = {};
  for (const u of allUsers) allNames[u.id] = displayName(u);

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

  return { staff, allActive, allNames, sourceLabel };
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

const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

const ROSTER_SOURCE = {
  draft: { label: 'רוסטר: טיוטה מקומית של הסידור השבועי', variant: 'warning' },
  published: { label: 'רוסטר: סידור שבועי שפורסם', variant: 'success' },
  assignments: { label: 'רוסטר: מאגר השיבוצים', variant: 'info' },
};

// 7.5 → "7.5", 8 → "8"
const fmtHours = (n) => String(Number((n || 0).toFixed(1)));

const parseDateParam = (value) => {
  if (!value || !DATE_PARAM_RE.test(value)) return null;
  const d = toLocalDate(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export default function DailyAutoSchedulePage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(
    () => parseDateParam(searchParams.get('date')) || new Date()
  );
  const [staff, setStaff] = useState([]);
  // Full active-user roster, used as a name-resolution fallback for ids that
  // may appear in older saved schedules but aren't on today's roster.
  const [allActive, setAllActive] = useState([]);
  // id → display name for EVERY loaded user (active or not). Used by the text
  // export and as a last-resort name lookup so no raw ids leak into the UI.
  const [allNames, setAllNames] = useState({});
  // 'draft' | 'published' | 'assignments' | '' — surfaced in the UI so the
  // admin can see whether the roster came from their local edits or a
  // published weekly schedule.
  const [rosterSource, setRosterSource] = useState('');
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  // '' | 'auto' | 'save' — which action is in flight
  const [busy, setBusy] = useState('');
  // True when the on-screen schedule differs from what was loaded / saved.
  const [dirty, setDirty] = useState(false);
  // slotId currently showing its "+" picker (null = none open)
  const [pickerSlotId, setPickerSlotId] = useState(null);
  // Export-to-text preview modal
  const [exportText, setExportText] = useState(null);
  // "חיילי היום" panel — open by default from tablet width up.
  const [rosterOpen, setRosterOpen] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia
      ? true
      : window.matchMedia('(min-width: 768px)').matches
  );

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayKey = DAY_KEYS[selectedDate.getDay()];
  const template = DAILY_TEMPLATES[dayKey];

  // Latest schedule, so an async save can tell whether edits happened mid-flight.
  const scheduleRef = useRef(schedule);
  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  // Keep ?date= in sync with the selected day (and follow it if the URL is
  // changed from outside, e.g. a link from the weekly page while mounted).
  const syncedDateRef = useRef(dateStr);
  useEffect(() => {
    const param = searchParams.get('date');
    if (param === dateStr) {
      syncedDateRef.current = dateStr;
      return;
    }
    const fromUrl = parseDateParam(param);
    if (fromUrl && syncedDateRef.current === dateStr) {
      setSelectedDate(fromUrl);
      return;
    }
    syncedDateRef.current = dateStr;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('date', dateStr);
        return next;
      },
      { replace: true }
    );
  }, [dateStr, searchParams, setSearchParams]);

  // Resolve names for any id that might appear in the schedule. Anyone in the
  // full active roster lands in the map first; the scheduled subset overwrites
  // them so shiftWindow / earliestStart from the solver pipeline wins.
  const staffById = useMemo(() => {
    const m = {};
    for (const u of allActive) m[u.id] = u;
    for (const s of staff) m[s.id] = s;
    return m;
  }, [staff, allActive]);

  const nameOf = useCallback(
    (id) => staffById[id]?.name || allNames[id] || id,
    [staffById, allNames]
  );

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
        setAllNames(rosters.allNames);
        setRosterSource(rosters.sourceLabel || '');
        setSchedule(existing);
        setDirty(false);
        setPickerSlotId(null);
      } catch (e) {
        console.error('DailyAutoSchedulePage load error:', e);
        if (!cancelled) toast.error('שגיאה בטעינת נתוני היום');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateStr, dayKey]);

  // Warn before closing / reloading the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // --- Day navigation -------------------------------------------------------

  const changeDay = useCallback(
    async (nextDate) => {
      if (!nextDate || Number.isNaN(nextDate.getTime())) return;
      // Native date inputs emit intermediate values (e.g. year "0002") while typing.
      if (nextDate.getFullYear() < 2000) return;
      if (format(nextDate, 'yyyy-MM-dd') === dateStr) return;
      if (dirty) {
        const ok = await confirm({
          title: 'יש שינויים שלא נשמרו. לעבור יום בלי לשמור?',
          confirmText: 'מעבר בלי שמירה',
          destructive: true,
        });
        if (!ok) return;
      }
      setSelectedDate(nextDate);
    },
    [dateStr, dirty, confirm]
  );

  // --- Auto / save / reset --------------------------------------------------

  const handleAutoAssign = useCallback(async () => {
    if (!template) {
      toast.error('אין תבנית זמינה ליום זה.');
      return;
    }
    setBusy('auto');
    try {
      const yesterday = format(addDays(selectedDate, -1), 'yyyy-MM-dd');
      const prev = await loadDaySchedule(yesterday);
      const result = generateSchedule(selectedDate, staff, template, {
        previousDaySchedule: prev || undefined,
      });
      setSchedule(result);
      setDirty(true);
      toast.success('הסידור נוצר. אפשר לערוך ידנית ולשמור.');
    } catch (e) {
      console.error('Auto-assign failed:', e);
      toast.error('שגיאה ביצירת הסידור: ' + e.message);
    } finally {
      setBusy('');
    }
  }, [selectedDate, staff, template]);

  const handleSave = useCallback(async () => {
    if (!schedule) return;
    const saving = schedule;
    setBusy('save');
    try {
      await saveDaySchedule(saving);
      // Only clear the flag if nothing was edited while the save was in flight.
      if (scheduleRef.current === saving) setDirty(false);
      toast.success('הסידור נשמר');
    } catch (e) {
      console.error('Save failed:', e);
      toast.error('שגיאה בשמירה: ' + e.message);
    } finally {
      setBusy('');
    }
  }, [schedule]);

  const handleReset = useCallback(async () => {
    const ok = await confirm({
      title: 'לאפס את הסידור של היום?',
      description: 'כל השיבוצים שלא נשמרו יאבדו.',
      confirmText: 'איפוס',
      destructive: true,
    });
    if (!ok) return;
    setSchedule(null);
    setPickerSlotId(null);
    setDirty(true);
  }, [confirm]);

  const handleExportText = useCallback(() => {
    if (!schedule || !template) return;
    // The exporter wants name-by-id only. Resolve from every loaded user (so
    // manually added, non-rostered soldiers get names too), then let the
    // day's roster names win.
    const nameMap = { ...allNames };
    for (const s of staff) nameMap[s.id] = s.name;
    const text = exportDayScheduleToText(schedule, template, nameMap);
    setExportText(text);
  }, [schedule, template, staff, allNames]);

  const handleCopyExport = useCallback(async () => {
    if (!exportText) return;
    try {
      await navigator.clipboard.writeText(exportText);
      toast.success('הועתק ללוח');
    } catch (e) {
      console.error('Clipboard write failed:', e);
      toast.error('ההעתקה נכשלה. סמנו את הטקסט והעתיקו ידנית.');
    }
  }, [exportText]);

  // --- Manual edit ----------------------------------------------------------

  const closePicker = useCallback(() => setPickerSlotId(null), []);

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
      setDirty(true);
    },
    [schedule, template, staff]
  );

  const handleAddToSlot = useCallback(
    async (slotId, staffId) => {
      if (!schedule || !template) return;
      const existing = schedule.slotAssignments[slotId] || [];
      if (existing.includes(staffId)) return;
      // Block same-hour double-booking: if the soldier already holds a slot
      // that overlaps this one, require explicit confirmation.
      const slot = template.slots.find((s) => s.id === slotId);
      if (slot && staffSlotConflicts(schedule, template, staffId, slot)) {
        const name = staffById[staffId]?.name || staffId;
        const ok = await confirm({
          title: `${name} כבר משובץ/ת בשעות חופפות`,
          description: `המשבצת ${slot.start}-${slot.end} חופפת לשיבוץ קיים. לשבץ בכל זאת?`,
          confirmText: 'לשבץ בכל זאת',
          destructive: true,
        });
        if (!ok) {
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
      setDirty(true);
      setPickerSlotId(null);
    },
    [schedule, template, staff, staffById, confirm]
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
      setDirty(true);
    },
    [schedule, template, staff]
  );

  const handleMarkSick = useCallback(
    async (staffId) => {
      if (!schedule || !template) return;
      const person = staffById[staffId];
      if (!person) return;
      const ok = await confirm({
        title: `לסמן את ${person.name} כחולה/לא זמין?`,
        description: 'החייל/ת יוסר/ו מהסידור והמשבצות ישובצו מחדש.',
        confirmText: 'סימון ושיבוץ מחדש',
        destructive: true,
      });
      if (!ok) return;
      try {
        const patched = reassignAfterDropout(schedule, staffId, staff, template);
        setSchedule(patched);
        setDirty(true);
        toast.success(`${person.name} סומן/ה כלא זמין/ה. הסידור עודכן.`);
      } catch (e) {
        console.error('Reassign failed:', e);
        toast.error('שגיאה בשיבוץ מחדש: ' + e.message);
      }
    },
    [schedule, template, staff, staffById, confirm]
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
          name: nameOf(id),
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
      .map((id) => ({ id, name: nameOf(id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));

    // Commanders — rostered for the day but not placed anywhere by the solver.
    const commanders = staff
      .filter((s) => s.isCommander)
      .map((s) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));

    const total = working.length + resting.length + commanders.length;

    return { working, resting, commanders, total };
  }, [schedule, template, nameOf, staff]);

  // Candidates for the manual slot picker: ALL active users (not just the
  // scheduled subset) — admins explicitly need to be able to drop in a
  // soldier who wasn't rostered for the day. Scheduled folks are listed
  // first; the picker groups them into "משובצים היום" / "לא משובצים".
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
          hours: schedule?.staffHours?.[u.id] || 0,
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

  // --- Render helpers -------------------------------------------------------

  const renderStaffChip = (staffId, slotId) => {
    const name = nameOf(staffId);
    return (
      <span
        key={`${slotId}-${staffId}`}
        className="inline-flex h-7 max-w-full items-center gap-0.5 rounded-full border bg-card pl-0.5 pr-2.5 text-xs font-medium text-slate-800 shadow-sm"
      >
        <span className="truncate">{name}</span>
        <button
          type="button"
          onClick={() => handleRemoveFromSlot(slotId, staffId)}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
          aria-label={`הסרת ${name} מהמשבצת`}
          title="הסרה מהמשבצת"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  };

  // Read-only chip used for derived "כולם" rosters — these aren't real
  // assignments stored in slotAssignments, so there's no per-chip remove.
  const renderDerivedChip = (staffId, slotId) => (
    <span
      key={`derived-${slotId}-${staffId}`}
      className="inline-flex h-7 items-center rounded-full bg-muted px-2.5 text-xs font-medium text-slate-700"
    >
      {nameOf(staffId)}
    </span>
  );

  const renderSpecialStateChip = (staffId, role) => {
    const name = nameOf(staffId);
    return (
      <span
        key={`special-${role}-${staffId}`}
        className={cn(
          'inline-flex h-7 items-center gap-0.5 rounded-full border bg-card text-xs font-medium text-slate-800 shadow-sm',
          role !== 'מנוחה' ? 'pl-0.5 pr-2.5' : 'px-2.5'
        )}
      >
        <span className="truncate">{name}</span>
        {role !== 'מנוחה' && (
          <button
            type="button"
            onClick={() => handleToggleSpecialState(role, staffId)}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
            aria-label={`הסרת ${name} מ${SPECIAL_STATE_HE[role]}`}
            title={`הסרה מ${SPECIAL_STATE_HE[role]}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    );
  };

  const sickButton = (id, title) => (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => handleMarkSick(id)}
      className="h-7 w-7 shrink-0 text-danger hover:bg-danger-soft hover:text-danger"
      title={title}
      aria-label={title}
    >
      <UserX className="h-3.5 w-3.5" />
    </Button>
  );

  const renderRosterPanel = () => {
    const { working, resting, commanders, total } = rosterSummary;
    const counts = (
      <>
        סה״כ {total} · עובדים {working.length} · במנוחה {resting.length}
        {commanders.length > 0 && <> · מפקדים {commanders.length}</>}
      </>
    );
    return (
      <aside
        className={cn(
          'mb-4 xl:sticky xl:top-24 xl:mb-0 xl:shrink-0',
          rosterOpen ? 'xl:w-80' : 'xl:w-12'
        )}
      >
        {/* Collapsed rail — xl only (below xl the card header itself is the toggle) */}
        {!rosterOpen && (
          <button
            type="button"
            onClick={() => setRosterOpen(true)}
            className="hidden w-12 flex-col items-center gap-2 rounded-2xl border bg-card py-3 text-muted-foreground shadow-soft transition-colors hover:text-foreground xl:flex"
            aria-label="הצגת חיילי היום"
            title="הצגת חיילי היום"
          >
            <PanelRightOpen className="h-5 w-5" />
            <Users className="h-5 w-5" />
            <span className="text-xs font-semibold tabular-nums">{total}</span>
          </button>
        )}

        <Card className={cn(!rosterOpen && 'xl:hidden')}>
          <button
            type="button"
            onClick={() => setRosterOpen((o) => !o)}
            aria-expanded={rosterOpen}
            className="flex w-full items-center justify-between gap-2 rounded-2xl p-3 text-right"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-bold">
                <Users className="h-4 w-4 text-muted-foreground" />
                חיילי היום
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{counts}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {rosterOpen ? (
                <>
                  <ChevronUp className="h-5 w-5 xl:hidden" />
                  <PanelRightClose className="hidden h-5 w-5 xl:block" />
                </>
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </span>
          </button>

          {rosterOpen && (
            <div className="max-h-[60vh] overflow-y-auto border-t p-2 xl:max-h-[calc(100vh-12rem)]">
              {total === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  אין חיילים בסידור
                </p>
              ) : (
                <ul className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
                  {working.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">
                            {r.name}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {r.hours.toFixed(1)} ש׳
                          </span>
                        </div>
                        {(r.slotLabels.length > 0 || r.stateLabels.length > 0) && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                            {r.slotLabels.map((s, i) => (
                              <span key={i} className="whitespace-nowrap">
                                {s.loc}{' '}
                                <span dir="ltr" className="inline-block tabular-nums">
                                  {s.start}-{s.end}
                                </span>
                              </span>
                            ))}
                            {r.stateLabels.map((lbl) => (
                              <Badge
                                key={lbl}
                                variant="secondary"
                                className="whitespace-nowrap px-1.5 py-0 text-[10px]"
                              >
                                {lbl}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {sickButton(r.id, 'סימון כלא זמין ושיבוץ מחדש')}
                    </li>
                  ))}
                  {resting.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm">{r.name}</span>
                          <span className="shrink-0 text-xs tabular-nums">0.0 ש׳</span>
                        </div>
                        <div className="mt-0.5 text-[11px] italic">מנוחה</div>
                      </div>
                      {sickButton(r.id, 'סימון כלא זמין')}
                    </li>
                  ))}
                  {commanders.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-warning-soft/50 px-2 py-1.5"
                    >
                      <span className="truncate text-sm font-medium text-amber-900">
                        {r.name}
                      </span>
                      <Badge variant="warning" className="shrink-0 px-1.5 py-0 text-[10px]">
                        מפקד · לא משובץ
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      </aside>
    );
  };

  const renderSlot = (slot) => {
    const assigned = schedule.slotAssignments[slot.id] || [];
    const unfilled = schedule.unfilledSlots.find((u) => u.slotId === slot.id);
    const isPickerOpen = pickerSlotId === slot.id;
    const countVariant =
      assigned.length >= slot.required
        ? 'success'
        : assigned.length === 0
          ? 'destructive'
          : 'warning';
    return (
      <div
        key={slot.id}
        className={cn(
          'rounded-xl border p-2',
          slot.isReinforcement ? 'border-warning/40 bg-warning-soft' : 'bg-card'
        )}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-800">
            {slot.isReinforcement && (
              <span className="rounded-md bg-warning/20 px-1.5 py-px text-[10px] font-bold text-amber-800">
                תגבור
              </span>
            )}
            <span dir="ltr" className="inline-block tabular-nums">
              {slot.start}-{slot.end}
            </span>
          </span>
          {slot.everyone ? (
            <Badge variant="secondary" className="px-2 py-0 text-[10px]">
              כולם
            </Badge>
          ) : (
            <Badge variant={countVariant} className="px-2 py-0 text-[10px] tabular-nums">
              {assigned.length}/{slot.required}
            </Badge>
          )}
        </div>

        <div className="relative flex flex-wrap items-center gap-1">
          {assigned.length > 0 ? (
            assigned.map((id) => renderStaffChip(id, slot.id))
          ) : slot.everyone ? (
            everyoneWorkingToday.length === 0 ? (
              <span className="text-xs text-muted-foreground">אין חיילים פעילים</span>
            ) : (
              everyoneWorkingToday.map((id) => renderDerivedChip(id, slot.id))
            )
          ) : (
            <span className="text-xs text-muted-foreground">ריק</span>
          )}

          <button
            type="button"
            // While open, keep this press from reaching the picker's
            // outside-click handler (which would close it and then re-open).
            onMouseDown={(e) => isPickerOpen && e.stopPropagation()}
            onTouchStart={(e) => isPickerOpen && e.stopPropagation()}
            onClick={() => setPickerSlotId(isPickerOpen ? null : slot.id)}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed text-primary transition-colors hover:bg-primary/10',
              isPickerOpen ? 'border-primary bg-primary/10' : 'border-primary/40'
            )}
            aria-label="הוספת חייל למשבצת"
            aria-expanded={isPickerOpen}
            title="הוספת חייל למשבצת"
          >
            <Plus className="h-4 w-4" />
          </button>

          {isPickerOpen && (
            <SoldierPicker
              options={availableForSlot(slot.id)}
              onPick={(id) => handleAddToSlot(slot.id, id)}
              onClose={closePicker}
              className="left-0 w-auto min-w-[13rem]"
            />
          )}
        </div>

        {unfilled && (
          <p className="mt-1 text-[11px] leading-tight text-danger">{unfilled.reason}</p>
        )}
      </div>
    );
  };

  const renderSpecialStates = () => (
    <Card>
      <CardHeader className="p-3 pb-2 sm:p-3 sm:pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>משמרות מיוחדות</span>
          <span className="text-xs font-normal text-muted-foreground">
            מוקצות לפני מילוי המשבצות
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 p-3 pt-0 sm:p-3 sm:pt-0">
        {Object.entries(SPECIAL_STATE_HE)
          .filter(
            ([key]) => key !== 'מנוחה' && key !== 'משמרת_ערב' && key !== 'משמרת_צהריים'
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
            const badgeVariant =
              derived || inactive
                ? 'secondary'
                : filledOk
                  ? 'success'
                  : list.length === 0
                    ? 'destructive'
                    : 'warning';
            return (
              <div
                key={key}
                className={cn('rounded-xl border p-2', inactive ? 'bg-muted/50 opacity-60' : 'bg-card')}
              >
                <div className="mb-1.5 flex items-center justify-between gap-1 text-sm font-semibold text-slate-800">
                  <span>{label}</span>
                  <div className="flex items-center gap-1">
                    {derived && (
                      <span className="text-[10px] font-normal text-muted-foreground">(נגזר)</span>
                    )}
                    <Badge variant={badgeVariant} className="px-2 py-0 text-[10px] tabular-nums">
                      {countBadge}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {inactive ? (
                    <span className="text-xs text-muted-foreground">לא רלוונטי ליום זה</span>
                  ) : list.length === 0 ? (
                    <span className="text-xs text-muted-foreground">ריק</span>
                  ) : (
                    list.map((id) => renderSpecialStateChip(id, key))
                  )}
                </div>
                {unfilledForState && (
                  <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-tight text-danger">
                    <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                    {unfilledForState.reason}
                  </p>
                )}
              </div>
            );
          })}
      </CardContent>
    </Card>
  );

  const renderLongShift = () => (
    <Card className="border-warning/40 bg-warning-soft/40">
      <CardHeader className="p-3 pb-2 sm:p-3 sm:pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>
            משמרת ארוכה · עד{' '}
            <span dir="ltr" className="inline-block tabular-nums">
              {longShiftGroup.maxEnd}
            </span>
          </span>
          <Badge variant="warning" className="px-2 py-0 text-[10px] tabular-nums">
            {longShiftGroup.ids.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-3 sm:pt-0">
        <div className="flex flex-wrap gap-1">
          {longShiftGroup.ids.map((id) => (
            <span
              key={`longshift-${id}`}
              className="inline-flex h-7 items-center rounded-full border border-warning/40 bg-card px-2.5 text-xs font-medium text-amber-900"
            >
              {nameOf(id)}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  // --- Render ---------------------------------------------------------------

  const sourceInfo = ROSTER_SOURCE[rosterSource];
  const unfilledCount = schedule?.unfilledSlots?.length || 0;
  const actionsDisabled = !!busy || loading;

  return (
    <AdminPage>
      <PageHeader
        className="mb-2"
        title="סידור יומי"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>שיבוץ אוטומטי לפי הסידור השבועי, עם עריכה ידנית</span>
            {sourceInfo && !loading && (
              <Badge variant={sourceInfo.variant}>{sourceInfo.label}</Badge>
            )}
          </span>
        }
      />

      {/* === Sticky action bar === */}
      <div className="sticky top-14 z-20 -mx-4 mb-4 border-b bg-background/95 px-4 py-2.5 backdrop-blur lg:top-0 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* RTL: the right-hand arrow steps back a day */}
            <div className="inline-flex h-10 items-center rounded-xl border bg-card shadow-sm">
              <Button
                variant="ghost"
                size="icon-sm"
                className="mx-1"
                onClick={() => changeDay(addDays(selectedDate, -1))}
                aria-label="יום קודם"
                title="יום קודם"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="min-w-[7.5rem] text-center text-sm font-semibold">
                יום {DAY_NAMES_HE[dayKey]} ·{' '}
                <span dir="ltr" className="inline-block tabular-nums">
                  {format(selectedDate, 'dd/MM')}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="mx-1"
                onClick={() => changeDay(addDays(selectedDate, 1))}
                aria-label="יום הבא"
                title="יום הבא"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => e.target.value && changeDay(toLocalDate(e.target.value))}
              aria-label="בחירת תאריך"
              className="h-10 rounded-xl border border-input bg-card px-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {dirty && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-amber-800">
                <span className="h-2 w-2 rounded-full bg-warning" aria-hidden />
                יש שינויים שלא נשמרו
              </span>
            )}
            <Button size="sm" onClick={handleAutoAssign} disabled={actionsDisabled || !template}>
              {busy === 'auto' ? (
                <Spinner className="h-4 w-4 text-current" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {busy === 'auto' ? 'משבץ...' : 'שיבוץ אוטומטי'}
            </Button>
            <Button
              size="sm"
              variant="success"
              onClick={handleSave}
              disabled={actionsDisabled || !schedule}
              className={cn(
                dirty && schedule && 'shadow-md ring-2 ring-warning ring-offset-2 ring-offset-background'
              )}
            >
              {busy === 'save' ? (
                <Spinner className="h-4 w-4 text-current" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              שמור
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportText}
              disabled={actionsDisabled || !schedule}
              aria-label="ייצוא לטקסט"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">ייצוא לטקסט</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              disabled={actionsDisabled || !schedule}
              className="text-danger hover:bg-danger-soft hover:text-danger"
              aria-label="איפוס"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">איפוס</span>
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <>
          {!template && (
            <Card className="mx-auto max-w-2xl">
              <EmptyState
                icon={CalendarOff}
                title={`אין תבנית ליום ${DAY_NAMES_HE[dayKey]}`}
                description="תבניות סידור יומי זמינות לימים א׳–ה׳."
              />
            </Card>
          )}

          {template && staff.length === 0 && (
            <Card className="mx-auto mb-4 max-w-2xl">
              <EmptyState
                icon={Users}
                title="אין חיילים משובצים ליום זה"
                description="שבצו חיילים לתאריך הזה בסידור השבועי, ואז חזרו לכאן ליצירת הסידור היומי."
                action={
                  <Button variant="outline" onClick={() => navigate('/schedule-management')}>
                    <CalendarRange className="h-4 w-4" />
                    לסידור השבועי
                  </Button>
                }
              />
            </Card>
          )}

          {template && staff.length > 0 && !schedule && (
            <Card className="mx-auto max-w-2xl">
              <EmptyState
                icon={Sparkles}
                title="עדיין אין סידור ליום זה"
                description={
                  <>
                    לחצו על "שיבוץ אוטומטי" כדי ליצור טיוטה.
                    <span className="mt-1 block text-xs">
                      רשומים לתאריך:{' '}
                      <strong>{staff.filter((s) => s.shiftWindow === 'morning').length}</strong>{' '}
                      בוקר ·{' '}
                      <strong>{staff.filter((s) => s.shiftWindow === 'evening').length}</strong>{' '}
                      ערב
                    </span>
                  </>
                }
                action={
                  <Button onClick={handleAutoAssign} disabled={actionsDisabled}>
                    <Sparkles className="h-4 w-4" />
                    שיבוץ אוטומטי
                  </Button>
                }
              />
            </Card>
          )}

          {template && schedule && (
            <div className="xl:flex xl:items-start xl:gap-4">
              {renderRosterPanel()}

              <div className="min-w-0 flex-1 space-y-4">
                {/* === Fairness strip === */}
                {fairness && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border/70 bg-card px-4 py-2.5 text-sm text-slate-700 shadow-soft">
                    <span>
                      ממוצע שעות:{' '}
                      <strong className="tabular-nums text-slate-900">
                        {fmtHours(fairness.average)}
                      </strong>
                    </span>
                    <span className="text-muted-foreground" aria-hidden>
                      ·
                    </span>
                    <span>
                      פער בין הכי עמוס להכי פנוי:{' '}
                      <strong className="tabular-nums text-slate-900">
                        {fmtHours(fairness.max - fairness.min)}
                      </strong>{' '}
                      שעות
                    </span>
                    <span className="sm:mr-auto">
                      {unfilledCount > 0 ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {unfilledCount} משבצות חסרות
                        </Badge>
                      ) : (
                        <Badge variant="success">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          כל המשבצות מאוישות
                        </Badge>
                      )}
                    </span>
                  </div>
                )}

                {/* === Special states + long shift === */}
                <div className={cn('grid gap-3', longShiftGroup && 'md:grid-cols-2')}>
                  {renderSpecialStates()}
                  {longShiftGroup && renderLongShift()}
                </div>

                {/* === Per-location slot grid === */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {Object.entries(slotsByLocation).map(([location, slots]) => (
                    <Card key={location}>
                      <div className="rounded-t-2xl border-b bg-muted px-3 py-2 text-center text-sm font-bold text-slate-800">
                        {location}
                      </div>
                      <div className="space-y-2 p-2">{slots.map(renderSlot)}</div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* === Export-text preview === */}
      <Dialog
        open={exportText !== null}
        onOpenChange={(open) => {
          if (!open) setExportText(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              סידור היום כטקסט
            </DialogTitle>
            <DialogDescription>
              מוכן להדבקה ב-WhatsApp או Telegram, כולל הדגשות בפורמט <code>*bold*</code>.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <textarea
              readOnly
              value={exportText || ''}
              dir="rtl"
              onFocus={(e) => e.target.select()}
              className="h-80 w-full resize-y rounded-xl border border-input bg-muted/40 p-3 font-mono text-base leading-relaxed sm:text-sm"
            />
          </DialogBody>
          <DialogFooter>
            <Button onClick={handleCopyExport}>
              <Copy className="h-4 w-4" />
              העתקה ללוח
            </Button>
            <Button variant="outline" onClick={() => setExportText(null)}>
              סגירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
