import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User } from '../entities/User';
import { ShiftSubmission } from '../entities/ShiftSubmission';
import { WeeklySchedule } from '../entities/WeeklySchedule';
import { ShiftAssignment } from '../entities/ShiftAssignment';
import { format, addDays, addWeeks } from 'date-fns';
import { toWeekStartISO, getDefaultWeekStart } from '../utils/weekKey';
import { Send, Users, Undo2, X, CheckCircle2, PencilLine } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { PageLoader, Spinner } from '../components/ui/spinner';
import { toast } from '../components/ui/toaster';
import { useConfirm } from '../components/ui/confirm-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody,
} from '../components/ui/dialog';
import WeekNavigator from '../components/shared/WeekNavigator';
import ScheduleBoard from '../components/admin/schedule/ScheduleBoard';
import PreferencesPanel from '../components/admin/PreferencesPanel';
import QuickShiftHoursEditor from '../components/admin/schedule/QuickShiftHoursEditor';
import { deriveDayOff } from '../components/soldier/dayOff';
import { DAYS, SHIFT_NAMES } from '../config/shifts';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { shiftDefinitionsService } from '../services/shiftDefinitions';
import * as shiftsConfig from '../config/shifts';
import {
  getShiftRequirements,
  buildAssignment,
  readDraft,
  writeDraft,
  clearDraft,
} from '../utils/scheduleHelpers';
import { cn } from '../lib/utils';
import { toLocalDate } from '../utils/days';
import { SWAP_REQUESTS_ENABLED } from '../config/app';

const MAX_SHIFTS = 6;

export default function ScheduleManagementPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  // Deep link from the preferences page: ?week=yyyy-MM-dd&soldier=<doc id>
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState({});
  const [schedule, setSchedule] = useState({});
  const [soldierNotes, setSoldierNotes] = useState({});
  const [weeklyScheduleEntity, setWeeklyScheduleEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [shiftAssignments, setShiftAssignments] = useState([]);
  const [draftActive, setDraftActive] = useState(false); // is current view from local draft?

  // Preferences panel state
  const [rawSubmissions, setRawSubmissions] = useState([]);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [selectedSoldierId, setSelectedSoldierId] = useState(() => searchParams.get('soldier'));

  // Quick shift hours editor state
  const [editingShift, setEditingShift] = useState(null);

  // Dynamic shift definitions state
  const [dynamicShiftNames, setDynamicShiftNames] = useState(SHIFT_NAMES);

  // Week navigation state
  const [weekOffset, setWeekOffset] = useState(() => {
    const week = searchParams.get('week');
    if (!week) return 0;
    const base = toLocalDate(toWeekStartISO(getDefaultWeekStart()));
    return Math.round((toLocalDate(week) - base) / (7 * 24 * 60 * 60 * 1000));
  });

  // Soldier panel visibility (collapsible on desktop, sheet on small screens)
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelSheetOpen, setPanelSheetOpen] = useState(false);
  const [noteView, setNoteView] = useState(null); // { soldier, note, assignment }

  // Tracks which week the data currently in `schedule` belongs to. The auto-save
  // effect uses this to refuse writing stale data into the wrong week's key when
  // the user navigates between weeks faster than loadData can complete.
  const scheduleWeekRef = useRef(null);
  // Set to true right before a load updates `schedule`; the next auto-save
  // effect tick consumes the flag and skips, so loading a week never echoes
  // back to localStorage as a fresh draft.
  const skipNextAutoSaveRef = useRef(false);

  const selectedWeekStart = useMemo(
    () => addWeeks(getDefaultWeekStart(), weekOffset),
    [weekOffset]
  );
  const nextWeekStartStr = useMemo(
    () => toWeekStartISO(selectedWeekStart),
    [selectedWeekStart]
  );

  // Build a fresh blank schedule for the week using shared rules.
  const initializeSchedule = useCallback(() => {
    const blank = {};
    for (const day of DAYS) {
      blank[day] = {};
      for (const shiftKey in SHIFT_NAMES) {
        if (shiftKey === 'קריית_חינוך_ערב' && (day === 'tuesday' || day === 'friday')) {
          continue;
        }
        blank[day][shiftKey] = {
          soldiers: [],
          longShiftSoldiers: [],
          cancelled: false,
          ...getShiftRequirements(day, shiftKey),
        };
      }
    }
    return blank;
  }, []);

  // Load remote (published) schedule, then overlay any local admin draft.
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let allUsers = [];
      try {
        allUsers = await User.list();
      } catch (error) {
        console.error('ScheduleManagement: Could not load users:', error);
      }

      const weekEndDate = format(addDays(selectedWeekStart, 6), 'yyyy-MM-dd');
      const [allSubmissions, schedules, assignments] = await Promise.all([
        ShiftSubmission.filter({ week_start: nextWeekStartStr }),
        WeeklySchedule.filter({ week_start: nextWeekStartStr }),
        ShiftAssignment.filter({ start_date: nextWeekStartStr, end_date: weekEndDate }),
      ]);

      setShiftAssignments(assignments);

      const usersMap = {};
      allUsers.forEach((user) => {
        usersMap[user.id] = user;
        if (user.uid && user.uid !== user.id) usersMap[user.uid] = user;
      });
      setUsers(usersMap);

      // Reconcile submissions for the preferences pane (unchanged shape).
      const submissionsMap = {};
      allUsers.forEach((user) => {
        const userShifts = user.weekly_shifts?.[nextWeekStartStr]?.shifts;
        if (userShifts) submissionsMap[user.id] = userShifts;
      });
      allSubmissions.forEach((sub) => {
        if (!submissionsMap[sub.user_id]) submissionsMap[sub.user_id] = {};
        for (const day in sub.shifts) {
          if (!submissionsMap[sub.user_id][day]) submissionsMap[sub.user_id][day] = [];
          submissionsMap[sub.user_id][day].push(...sub.shifts[day]);
        }
      });

      const publishedEntity = schedules[0] || null;
      setWeeklyScheduleEntity(publishedEntity);

      // Build the baseline schedule (blank ∪ published) so unknown days/shifts
      // always exist as empty cells. Then overlay any saved draft.
      const baseline = initializeSchedule();
      if (publishedEntity?.schedule) {
        for (const day of DAYS) {
          for (const shiftKey in SHIFT_NAMES) {
            if (!baseline[day]?.[shiftKey]) continue;
            const remoteShift = publishedEntity.schedule[day]?.[shiftKey];
            if (!remoteShift) continue;
            baseline[day][shiftKey] = {
              ...baseline[day][shiftKey],
              soldiers: remoteShift.soldiers || [],
              longShiftSoldiers:
                remoteShift.longShiftSoldiers ||
                // Backward compat: derive long-shift soldiers from prior assignments
                assignments
                  .filter(
                    (a) =>
                      a.day_name === day &&
                      a.shift_type === shiftKey &&
                      a.isLongShift
                  )
                  .map((a) => {
                    // Reverse-lookup the soldier doc id used in the schedule
                    const u = Object.values(usersMap).find(
                      (x) => x.uid === a.soldier_id || x.id === a.soldier_id
                    );
                    return u?.id || a.soldier_id;
                  }),
              cancelled: remoteShift.cancelled || false,
              ...(remoteShift.customStartTime && { customStartTime: remoteShift.customStartTime }),
              ...(remoteShift.customEndTime && { customEndTime: remoteShift.customEndTime }),
            };
          }
        }
      }

      // Mark this state mutation as a "load" so the auto-save effect skips it,
      // and tag which week `schedule` now belongs to.
      skipNextAutoSaveRef.current = true;
      scheduleWeekRef.current = nextWeekStartStr;

      const draft = readDraft(nextWeekStartStr);
      if (draft) {
        setSchedule(draft);
        setDraftActive(true);
      } else {
        setSchedule(baseline);
        setDraftActive(false);
      }
    } catch (error) {
      console.error('Error loading schedule data:', error);
    }
    setLoading(false);
  }, [nextWeekStartStr, selectedWeekStart, initializeSchedule]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to remote shift definitions for live name updates. Fixes a prior
  // leak where the cleanup never registered because the outer callback was async.
  useEffect(() => {
    let unsubscribe = null;
    (async () => {
      try {
        await shiftDefinitionsService.initializeFromConfig(shiftsConfig);
        unsubscribe = shiftDefinitionsService.subscribeToShiftDefinitions((updated) => {
          if (updated?.SHIFT_NAMES) setDynamicShiftNames(updated.SHIFT_NAMES);
        });
      } catch (error) {
        console.error('ScheduleManagement: Error initializing shift definitions:', error);
      }
    })();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Soldier preferences (shift_preferences collection) — read-only side panel data.
  useEffect(() => {
    setPreferencesLoading(true);
    const fetchSubmissions = async () => {
      try {
        const q = query(
          collection(db, 'shift_preferences'),
          where('weekStart', '==', nextWeekStartStr)
        );
        const snapshot = await getDocs(q);
        const submissions = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            userName: d.userName,
            userId: d.userId,
            days: d.days || {},
            longShiftDays: d.longShiftDays || {},
            notes: d.notes || '',
            updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate() : d.updatedAt || null,
            createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : d.createdAt || null,
            weekStart: d.weekStart,
          };
        });
        setRawSubmissions(submissions);
      } catch (error) {
        console.error('Error fetching submissions:', error);
      }
      setPreferencesLoading(false);
    };
    fetchSubmissions();
  }, [nextWeekStartStr]);

  // Index soldier notes by every known identifier (id + uid + raw submission userId)
  useEffect(() => {
    if (Object.keys(users).length === 0 || rawSubmissions.length === 0) return;
    const notesMap = {};
    rawSubmissions.forEach((sub) => {
      if (!sub.notes) return;
      notesMap[sub.userId] = sub.notes;
      const user = Object.values(users).find(
        (u) => u.uid === sub.userId || u.id === sub.userId
      );
      if (user) {
        if (user.id) notesMap[user.id] = sub.notes;
        if (user.uid) notesMap[user.uid] = sub.notes;
      }
    });
    setSoldierNotes(notesMap);
  }, [users, rawSubmissions]);

  // Auto-persist every schedule change to the admin's local draft. This is the
  // safety net: the admin's progress is never lost if the tab closes.
  //
  // Two guards prevent cross-week corruption:
  //   • scheduleWeekRef must agree with the currently-selected week — when the
  //     user navigates to a new week the ref still points at the old one until
  //     loadData updates it, so we refuse to save the old data into the new key.
  //   • skipNextAutoSaveRef is set immediately before a load updates `schedule`,
  //     so the post-load tick of this effect doesn't echo the fresh data back to
  //     localStorage (which would otherwise mark every loaded week as a draft).
  useEffect(() => {
    if (loading) return;
    if (!schedule || Object.keys(schedule).length === 0) return;
    if (scheduleWeekRef.current !== nextWeekStartStr) return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    writeDraft(nextWeekStartStr, schedule);
    setDraftActive(true);
  }, [schedule, nextWeekStartStr, loading]);

  const soldierShiftCounts = useMemo(() => {
    const counts = {};
    if (!schedule || Object.keys(schedule).length === 0) return counts;
    Object.values(schedule).forEach((dayShifts) => {
      if (!dayShifts) return;
      Object.values(dayShifts).forEach((shiftData) => {
        if (shiftData && Array.isArray(shiftData.soldiers)) {
          shiftData.soldiers.forEach((soldierId) => {
            counts[soldierId] = (counts[soldierId] || 0) + 1;
          });
        }
      });
    });
    return counts;
  }, [schedule]);

  // Local-only mutation: remove a soldier from a shift OR toggle a shift's cancelled flag.
  // Persists nothing remote — only the local draft picks it up.
  const handleCancelShift = async (day, shiftKey, soldierId = null) => {
    if (soldierId) {
      setSchedule((prev) => {
        const next = JSON.parse(JSON.stringify(prev));
        const cell = next[day]?.[shiftKey];
        if (cell?.soldiers) {
          cell.soldiers = cell.soldiers.filter((id) => id !== soldierId);
        }
        if (Array.isArray(cell?.longShiftSoldiers)) {
          cell.longShiftSoldiers = cell.longShiftSoldiers.filter((id) => id !== soldierId);
        }
        return next;
      });
      return;
    }

    // Restoring a cancelled shift needs no confirmation.
    if (!schedule[day]?.[shiftKey]?.cancelled) {
      const ok = await confirm({
        title: 'לבטל את המשמרת?',
        description: 'המשמרת תסומן כמבוטלת ולא תישלח לחיילים בפרסום.',
        confirmText: 'ביטול משמרת',
        destructive: true,
      });
      if (!ok) return;
    }
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [shiftKey]: {
          ...prev[day][shiftKey],
          cancelled: !prev[day][shiftKey].cancelled,
        },
      },
    }));
  };

  // Local-only: toggle long-shift state on a soldier in a given cell.
  const handleToggleLongShift = (day, shiftKey, soldierId, isLong) => {
    setSchedule((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const cell = next[day]?.[shiftKey];
      if (!cell) return prev;
      const current = Array.isArray(cell.longShiftSoldiers) ? cell.longShiftSoldiers : [];
      cell.longShiftSoldiers = isLong
        ? Array.from(new Set([...current, soldierId]))
        : current.filter((id) => id !== soldierId);
      return next;
    });
  };

  // Throw away the local draft and reload what soldiers currently see.
  const handleDiscardDraft = async () => {
    const ok = await confirm({
      title: 'לבטל את הטיוטה?',
      description: weeklyScheduleEntity
        ? 'כל השינויים שלא פורסמו יימחקו והלוח יחזור לגרסה שפורסמה.'
        : 'כל השיבוצים בטיוטה יימחקו והלוח יתרוקן.',
      confirmText: 'ביטול טיוטה',
      destructive: true,
    });
    if (!ok) return;
    clearDraft(nextWeekStartStr);
    setSelectedSoldierId(null);
    await loadData();
    toast.success('הטיוטה בוטלה');
  };

  // Publish = push the local draft to BOTH weekly_schedules (for the grid soldiers
  // see in WeeklyScheduleView) AND shift_assignments (for each soldier's dashboard).
  // This is the only action that exposes admin changes outside the admin browser.
  const handlePublishToSoldiers = async () => {
    const ok = await confirm({
      title: 'לפרסם את הסידור?',
      description: 'כל החיילים יראו את השיבוצים שלהם לשבוע הזה.',
      confirmText: 'פרסום',
    });
    if (!ok) return;
    setPublishing(true);
    try {
      // 1) Persist the full schedule document to weekly_schedules
      if (weeklyScheduleEntity) {
        await WeeklySchedule.update(weeklyScheduleEntity.id, {
          schedule,
          is_published: true,
        });
      } else {
        const newEntity = await WeeklySchedule.create({
          week_start: nextWeekStartStr,
          schedule,
          is_published: true,
        });
        setWeeklyScheduleEntity(newEntity);
      }

      // 2) Rewrite shift_assignments for the week from scratch.
      // Delete existing first to avoid duplicates.
      const weekEndDate = format(addDays(selectedWeekStart, 6), 'yyyy-MM-dd');
      const oldAssignments = await ShiftAssignment.filter({
        start_date: nextWeekStartStr,
        end_date: weekEndDate,
      });
      await ShiftAssignment.bulkDelete(oldAssignments.map((old) => old.id));

      const assignments = [];
      for (const day of DAYS) {
        const cells = schedule[day] || {};
        for (const shiftKey in cells) {
          const shiftData = cells[shiftKey];
          if (!shiftData?.soldiers?.length || shiftData.cancelled) continue;
          const longSet = new Set(shiftData.longShiftSoldiers || []);

          for (const soldierId of shiftData.soldiers) {
            const soldier = users[soldierId];
            if (!soldier?.uid) continue;

            // Long-shift = admin manual toggle OR soldier's submitted preference (morning only)
            const isMorning = shiftKey.includes('בוקר');
            const longByAdmin = longSet.has(soldierId);
            const longByPref = !!normalizedSubmissions.find(
              (s) => s.userId === soldierId || s.userId === soldier.uid
            )?.longShiftDays?.[day];
            const isLongShift = isMorning && (longByAdmin || longByPref);

            assignments.push(
              buildAssignment({
                soldier,
                day,
                shiftKey,
                shiftData,
                weekStart: nextWeekStartStr,
                isLongShift,
                dynamicNames: dynamicShiftNames,
              })
            );
          }
        }
      }

      if (assignments.length > 0) {
        await ShiftAssignment.bulkCreate(assignments);
      }

      // 3) Clear the local draft — board now reflects what soldiers see.
      clearDraft(nextWeekStartStr);
      setDraftActive(false);

      // Refresh assignments cache for swap-request decoration.
      const refreshed = await ShiftAssignment.filter({
        start_date: nextWeekStartStr,
        end_date: weekEndDate,
      });
      setShiftAssignments(refreshed);

      toast.success(`הסידור פורסם · ${assignments.length} שיבוצים נשלחו לחיילים`);
    } catch (e) {
      console.error('Error publishing to soldiers:', e);
      toast.error('שגיאה בפרסום הסידור: ' + e.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleEditShiftHours = (day, shiftKey, shiftName, shift) => {
    setEditingShift({ day, shiftKey, shiftName, shift });
  };

  // Editing per-shift custom hours stays LOCAL until the admin hits "Publish".
  const handleSaveShiftHours = (day, shiftKey, startTime, endTime) => {
    setSchedule((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next[day]?.[shiftKey]) {
        next[day][shiftKey].customStartTime = startTime;
        next[day][shiftKey].customEndTime = endTime;
      }
      return next;
    });
    return { success: true };
  };

  const isPublished = weeklyScheduleEntity?.is_published && !draftActive;

  const handleSelectSoldier = (soldierId) => {
    setSelectedSoldierId((prev) => (prev === soldierId ? null : soldierId));
  };

  // Local-only: add/remove the currently-selected soldier from a shift slot.
  const handleShiftSlotClick = async (day, shiftKey) => {
    if (!selectedSoldierId) return;
    const soldier = users[selectedSoldierId];
    const cell = schedule[day]?.[shiftKey];
    if (!soldier || !cell) return;

    const isAssigned = cell.soldiers.includes(selectedSoldierId);
    if (!isAssigned && (soldierShiftCounts[selectedSoldierId] || 0) >= MAX_SHIFTS) {
      const ok = await confirm({
        title: 'יותר מ-6 משמרות',
        description: `${soldier.hebrew_name} כבר משובץ/ת ל-${soldierShiftCounts[selectedSoldierId]} משמרות השבוע. להוסיף בכל זאת?`,
        confirmText: 'הוספה',
      });
      if (!ok) return;
    }

    setSchedule((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const target = next[day]?.[shiftKey];
      if (!target) return prev;
      const idx = target.soldiers.indexOf(selectedSoldierId);
      if (idx !== -1) {
        target.soldiers.splice(idx, 1);
        if (Array.isArray(target.longShiftSoldiers)) {
          target.longShiftSoldiers = target.longShiftSoldiers.filter((id) => id !== selectedSoldierId);
        }
      } else {
        target.soldiers.push(selectedSoldierId);
      }
      return next;
    });
  };

  const normalizedSubmissions = useMemo(() => {
    const byUserId = new Map();
    rawSubmissions.forEach((sub) => {
      const normalized = {
        id: sub.id,
        userId: sub.userId,
        uid: sub.userId,
        userName: sub.userName || 'ללא שם',
        updatedAt: sub.updatedAt || new Date(),
        days: {
          sunday: sub.days?.sunday || [],
          monday: sub.days?.monday || [],
          tuesday: sub.days?.tuesday || [],
          wednesday: sub.days?.wednesday || [],
          thursday: sub.days?.thursday || [],
          friday: sub.days?.friday || [],
          saturday: sub.days?.saturday || [],
        },
        weekStart: sub.weekStart,
        longShiftDays: sub.longShiftDays || {},
        notes: sub.notes || '',
      };
      const existing = byUserId.get(sub.userId);
      if (!existing || normalized.updatedAt > existing.updatedAt) {
        byUserId.set(sub.userId, normalized);
      }
    });

    const soldiersMap = new Map();
    Object.values(users).forEach((user) => {
      if ((user.role === 'soldier' || user.role === 'user') && !soldiersMap.has(user.id)) {
        soldiersMap.set(user.id, user);
      }
    });
    const allSoldiers = Array.from(soldiersMap.values());

    const submitted = [];
    const notSubmitted = [];
    allSoldiers.forEach((soldier) => {
      let submission = byUserId.get(soldier.id);
      if (!submission && soldier.uid) submission = byUserId.get(soldier.uid);
      if (submission) {
        submitted.push({
          ...submission,
          userName:
            soldier.hebrew_name ||
            soldier.displayName ||
            soldier.full_name ||
            submission.userName ||
            'ללא שם',
          userId: soldier.id,
          uid: soldier.id,
        });
      } else {
        notSubmitted.push({
          id: `missing_${soldier.id}`,
          uid: soldier.id,
          userId: soldier.id,
          userName:
            soldier.hebrew_name || soldier.displayName || soldier.full_name || 'ללא שם',
          weekStart: nextWeekStartStr,
          updatedAt: new Date(0),
          days: {
            sunday: [], monday: [], tuesday: [], wednesday: [],
            thursday: [], friday: [], saturday: [],
          },
        });
      }
    });
    return [...submitted, ...notSubmitted];
  }, [rawSubmissions, users, nextWeekStartStr]);

  // Requested day-off per soldier doc id (derived from the submission's empty day).
  const dayOffBySoldier = useMemo(() => {
    const map = {};
    normalizedSubmissions.forEach((s) => {
      if (String(s.id).startsWith('missing_')) return;
      const off = deriveDayOff(s);
      if (off) map[s.userId] = off;
    });
    return map;
  }, [normalizedSubmissions]);

  // Keyboard: Esc clears the selection; arrows switch weeks (RTL: → is previous).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [role="dialog"], [role="alertdialog"]')) return;
      if (e.key === 'Escape') setSelectedSoldierId(null);
      if (e.key === 'ArrowRight') setWeekOffset((o) => o - 1);
      if (e.key === 'ArrowLeft') setWeekOffset((o) => o + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) return <PageLoader label="טוען סידור..." />;

  const selectedSoldier = selectedSoldierId ? users[selectedSoldierId] : null;
  const selectedCount = selectedSoldierId ? soldierShiftCounts[selectedSoldierId] || 0 : 0;
  const totals = DAYS.reduce(
    (acc, day) => {
      Object.values(schedule[day] || {}).forEach((cell) => {
        if (cell.cancelled) return;
        acc.assigned += cell.soldiers?.length || 0;
        acc.required += cell.required || 0;
      });
      return acc;
    },
    { assigned: 0, required: 0 }
  );

  const panel = (
    <PreferencesPanel
      submissions={normalizedSubmissions}
      loading={preferencesLoading}
      soldierShiftCounts={soldierShiftCounts}
      dayOffBySoldier={dayOffBySoldier}
      onSelectSoldier={(id) => { handleSelectSoldier(id); setPanelSheetOpen(false); }}
      selectedSoldierId={selectedSoldierId}
    />
  );

  return (
    <>
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden lg:h-screen">
        {/* Soldier panel — RTL: first child sits on the right */}
        {panelOpen && <aside className="hidden w-72 shrink-0 border-l xl:block">{panel}</aside>}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-3 lg:px-6">
            <Button variant="outline" size="sm" className="xl:hidden" onClick={() => setPanelSheetOpen(true)}>
              <Users className="h-4 w-4" /> חיילים
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden xl:inline-flex"
              onClick={() => setPanelOpen((v) => !v)}
              title={panelOpen ? 'הסתרת רשימת החיילים' : 'הצגת רשימת החיילים'}
            >
              <Users className="h-4 w-4" /> {panelOpen ? 'הסתרה' : 'חיילים'}
            </Button>
            <h1 className="text-xl font-bold">סידור שבועי</h1>
            <WeekNavigator
              compact
              className="w-64"
              weekStart={selectedWeekStart}
              onPrev={() => setWeekOffset(weekOffset - 1)}
              onNext={() => setWeekOffset(weekOffset + 1)}
              onToday={() => setWeekOffset(0)}
              isToday={weekOffset === 0}
            />
            {draftActive ? (
              <Badge variant="warning" className="h-7">
                <PencilLine className="h-3.5 w-3.5" /> טיוטה · לא פורסם
              </Badge>
            ) : isPublished ? (
              <Badge variant="success" className="h-7">
                <CheckCircle2 className="h-3.5 w-3.5" /> פורסם
              </Badge>
            ) : (
              <Badge variant="secondary" className="h-7">טרם פורסם</Badge>
            )}
            <span className="text-sm tabular-nums text-muted-foreground">
              שובצו {totals.assigned}/{totals.required}
            </span>
            <div className="flex-1" />
            {draftActive && (
              <Button variant="ghost" size="sm" onClick={handleDiscardDraft} disabled={publishing}>
                <Undo2 className="h-4 w-4" /> ביטול טיוטה
              </Button>
            )}
            <Button
              onClick={handlePublishToSoldiers}
              disabled={publishing}
              size="sm"
              className={cn(draftActive && 'shadow-md shadow-primary/30')}
            >
              {publishing ? <Spinner className="text-primary-foreground" /> : <Send className="h-4 w-4" />}
              {publishing ? 'מפרסם...' : 'פרסום לחיילים'}
            </Button>
          </div>

          {/* Assign-mode banner */}
          {selectedSoldier && (
            <div className="flex items-center gap-3 border-b bg-primary px-4 py-2 text-sm text-primary-foreground lg:px-6">
              <span>
                משבצים את <strong>{selectedSoldier.hebrew_name}</strong> · {selectedCount} משמרות השבוע
                {dayOffBySoldier[selectedSoldierId] && ' · יום החופש שביקש/ה מסומן בפסים'}
              </span>
              <span className="hidden text-primary-foreground/70 md:inline">לחיצה על משמרת מוסיפה/מסירה · Esc לסיום</span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setSelectedSoldierId(null)}
                className="flex h-8 items-center gap-1 rounded-lg px-2 hover:bg-white/15"
              >
                <X className="h-4 w-4" /> סיום
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto p-3 lg:p-4">
            <ScheduleBoard
              schedule={schedule}
              weekStart={selectedWeekStart}
              users={users}
              soldierShiftCounts={soldierShiftCounts}
              soldierNotes={soldierNotes}
              dayOffBySoldier={dayOffBySoldier}
              onCancelShift={handleCancelShift}
              onRemoveSoldier={(day, shiftKey, soldierId) => handleCancelShift(day, shiftKey, soldierId)}
              onShiftSlotClick={handleShiftSlotClick}
              selectedSoldierId={selectedSoldierId}
              onEditShiftHours={handleEditShiftHours}
              dynamicShiftNames={dynamicShiftNames}
              shiftAssignments={shiftAssignments}
              onToggleLongShift={handleToggleLongShift}
              onShowNote={(soldier, note, assignment) => setNoteView({ soldier, note, assignment })}
              onOpenDay={(date) => navigate(`/daily-auto-schedule?date=${date}`)}
            />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-warning-soft ring-1 ring-warning/40" /> משמרת ארוכה
              </span>
              {SWAP_REQUESTS_ENABLED && (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-swap-soft ring-1 ring-swap/40" /> בקשת החלפה
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-danger-soft ring-1 ring-danger/40" /> ביום החופש / מעל 6 משמרות
              </span>
              <span>לחיצה על שם יום פותחת את הסידור היומי · ← → מעבר שבוע</span>
            </div>
          </div>
        </div>
      </div>

      {/* Soldier list as a sheet on smaller screens */}
      <Dialog open={panelSheetOpen} onOpenChange={setPanelSheetOpen}>
        <DialogContent side="right" className="w-80 sm:w-80" hideClose>
          <DialogTitle className="sr-only">חיילים</DialogTitle>
          {panel}
        </DialogContent>
      </Dialog>

      <Dialog open={!!noteView} onOpenChange={(open) => !open && setNoteView(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{noteView?.soldier.hebrew_name}</DialogTitle>
            <DialogDescription>הערה מההגשה</DialogDescription>
          </DialogHeader>
          <DialogBody className="pb-5">
            <p className="whitespace-pre-wrap text-sm">{noteView?.note}</p>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <QuickShiftHoursEditor
        isOpen={!!editingShift}
        onClose={() => setEditingShift(null)}
        day={editingShift?.day}
        shiftKey={editingShift?.shiftKey}
        shiftName={editingShift?.shiftName}
        shift={editingShift?.shift}
        onSave={handleSaveShiftHours}
      />
    </>
  );
}
