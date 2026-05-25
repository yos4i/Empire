import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../entities/User';
import { ShiftSubmission } from '../entities/ShiftSubmission';
import { WeeklySchedule } from '../entities/WeeklySchedule';
import { ShiftAssignment } from '../entities/ShiftAssignment';
import { format, addDays, addWeeks } from 'date-fns';
import { toWeekStartISO, getDefaultWeekStart } from '../utils/weekKey';
import { Calendar, Home, Users, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import ScheduleBoard from '../components/admin/schedule/ScheduleBoard';
import AssignSoldierDialog from '../components/admin/schedule/AssignSoldierDialog';
import PreferencesPanel from '../components/admin/PreferencesPanel';
import QuickShiftHoursEditor from '../components/admin/schedule/QuickShiftHoursEditor';
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

export default function ScheduleManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState({});
  const [schedule, setSchedule] = useState({});
  const [soldierNotes, setSoldierNotes] = useState({});
  const [weeklyScheduleEntity, setWeeklyScheduleEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [shiftAssignments, setShiftAssignments] = useState([]);
  const [draftActive, setDraftActive] = useState(false); // is current view from local draft?

  // Preferences panel state
  const [rawSubmissions, setRawSubmissions] = useState([]);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [selectedSoldierId, setSelectedSoldierId] = useState(null);

  // Quick shift hours editor state
  const [editingShift, setEditingShift] = useState(null);

  // Dynamic shift definitions state
  const [dynamicShiftNames, setDynamicShiftNames] = useState(SHIFT_NAMES);

  // Week navigation state
  const [weekOffset, setWeekOffset] = useState(0);

  const [dialogShift, setDialogShift] = useState(null);

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

  const handleToggleAssign = (soldierId) => {
    if (!dialogShift) return;
    const currentCount = soldierShiftCounts[soldierId] || 0;
    const isAssigned = schedule[dialogShift.day][dialogShift.shiftKey].soldiers.includes(soldierId);
    if (!isAssigned && currentCount >= 6) {
      if (!window.confirm(`החייל ${users[soldierId]?.hebrew_name} כבר משובץ ל-6 משמרות. האם אתה בטוח שברצונך להוסיף משמרת נוספת?`)) {
        return;
      }
    }
    const { day, shiftKey } = dialogShift;
    setSchedule((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const soldiers = next[day][shiftKey].soldiers;
      const idx = soldiers.indexOf(soldierId);
      if (idx > -1) soldiers.splice(idx, 1); else soldiers.push(soldierId);
      next[day][shiftKey].soldiers = soldiers;
      return next;
    });
  };

  // Local-only mutation: remove a soldier from a shift OR toggle a shift's cancelled flag.
  // Persists nothing remote — only the local draft picks it up.
  const handleCancelShift = (day, shiftKey, soldierId = null) => {
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

    if (!window.confirm('האם אתה בטוח שברצונך לבטל את המשמרת הזו?')) return;
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

  // Save = persist admin's working copy to localStorage. Soldiers see NOTHING.
  const handleManualSave = () => {
    setSaving(true);
    setSaveStatus('שומר...');
    try {
      const ok = writeDraft(nextWeekStartStr, schedule);
      if (!ok) throw new Error('localStorage write failed');
      setDraftActive(true);
      setSaveStatus('✅ נשמר מקומית (טיוטה)');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (e) {
      console.error('Error saving local draft:', e);
      setSaveStatus('❌ שגיאה בשמירה מקומית');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Publish = push the local draft to BOTH weekly_schedules (for the grid soldiers
  // see in WeeklyScheduleView) AND shift_assignments (for each soldier's dashboard).
  // This is the only action that exposes admin changes outside the admin browser.
  const handlePublishToSoldiers = async () => {
    if (!window.confirm('האם לפרסם את הסידור לכל החיילים? לאחר הפרסום החיילים יראו את השיבוצים שלהם.')) {
      return;
    }
    setPublishing(true);
    setSaveStatus('מפרסם לחיילים...');
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
      for (const old of oldAssignments) {
        await ShiftAssignment.delete(old.id);
      }

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

      setSaveStatus('✅ פורסם לחיילים');
      setTimeout(() => setSaveStatus(''), 2500);
      alert(`הסידור פורסם בהצלחה! ${assignments.length} שיבוצים נשלחו לחיילים.`);
    } catch (e) {
      console.error('Error publishing to soldiers:', e);
      setSaveStatus('❌ שגיאה בפרסום');
      setTimeout(() => setSaveStatus(''), 3000);
      alert('שגיאה בפרסום הסידור לחיילים: ' + e.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleEditShiftHours = (day, shiftKey, shiftName) => {
    setEditingShift({ day, shiftKey, shiftName });
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
  const handleShiftSlotClick = (day, shiftKey) => {
    if (!selectedSoldierId) return;
    const soldier = users[selectedSoldierId];
    if (!soldier) return;

    setSchedule((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const cell = next[day]?.[shiftKey];
      if (!cell) return prev;

      const idx = cell.soldiers.indexOf(selectedSoldierId);
      if (idx !== -1) {
        cell.soldiers.splice(idx, 1);
        if (Array.isArray(cell.longShiftSoldiers)) {
          cell.longShiftSoldiers = cell.longShiftSoldiers.filter((id) => id !== selectedSoldierId);
        }
      } else {
        const currentCount = soldierShiftCounts[selectedSoldierId] || 0;
        if (currentCount >= 6) {
          if (!window.confirm(`החייל ${soldier.hebrew_name} כבר משובץ ל-6 משמרות. האם אתה בטוח שברצונך להוסיף משמרת נוספת?`)) {
            return prev;
          }
        }
        cell.soldiers.push(selectedSoldierId);
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

  if (loading) return <div className="p-6 text-center">טוען נתונים...</div>;

  const availableSoldiers = Object.values(users).filter((u) => u.is_active);

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] bg-gray-100 overflow-hidden" dir="rtl">
        <PreferencesPanel
          isOpen={true}
          onClose={() => {}}
          submissions={normalizedSubmissions}
          weekStart={nextWeekStartStr}
          loading={preferencesLoading}
          soldierShiftCounts={soldierShiftCounts}
          users={users}
          isDragging={false}
          onSelectSoldier={handleSelectSoldier}
          selectedSoldierId={selectedSoldierId}
        />
        <div className="flex-grow p-4 md:p-6 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <Button variant="outline" size="icon" onClick={() => navigate('/admin')}>
              <Home className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl md:text-2xl font-bold text-black">ניהול סידור עבודה</h1>
            </div>
            <div className="w-10" />
          </div>

          <div className="flex items-center gap-2 justify-center mb-4 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <p className="text-gray-600 min-w-[150px] text-center text-sm">
              שבוע מתאריך: {format(selectedWeekStart, 'dd/MM/yyyy')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          {saveStatus && (
            <div className="text-center mb-2 flex-shrink-0">
              <p
                className={`text-sm ${
                  saveStatus.includes('✅')
                    ? 'text-green-600'
                    : saveStatus.includes('❌')
                    ? 'text-red-600'
                    : 'text-blue-600'
                }`}
              >
                {saveStatus}
              </p>
            </div>
          )}

          {draftActive && (
            <div className="text-center mb-2 flex-shrink-0">
              <p className="text-xs text-amber-700 bg-amber-50 inline-block px-2 py-1 rounded border border-amber-200">
                טיוטה מקומית — שינויים עדיין לא פורסמו לחיילים
              </p>
            </div>
          )}

          {/* Action buttons — only Save (local draft) and Publish (push to soldiers). */}
          <div className="mb-4 flex-shrink-0">
            <div className="flex gap-2 items-center justify-center flex-wrap">
              <Button
                variant="default"
                onClick={handleManualSave}
                disabled={saving || publishing}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Save className="w-4 h-4 ml-2" />
                {saving ? 'שומר...' : 'שמור סידור'}
              </Button>
              <Button
                onClick={handlePublishToSoldiers}
                disabled={saving || publishing}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Users className="w-4 h-4 ml-2" />
                {publishing ? 'מפרסם...' : 'פרסם לחיילים'}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto pb-4 min-h-0">
            <ScheduleBoard
              schedule={schedule}
              users={users}
              soldierShiftCounts={soldierShiftCounts}
              soldierNotes={soldierNotes}
              isPublished={isPublished}
              onCancelShift={handleCancelShift}
              onShiftSlotClick={handleShiftSlotClick}
              selectedSoldierId={selectedSoldierId}
              onEditShiftHours={handleEditShiftHours}
              dynamicShiftNames={dynamicShiftNames}
              shiftAssignments={shiftAssignments}
              onToggleLongShift={handleToggleLongShift}
            />
          </div>
        </div>
      </div>

      <AssignSoldierDialog
        isOpen={!!dialogShift}
        onClose={() => setDialogShift(null)}
        shiftInfo={dialogShift}
        allSoldiers={availableSoldiers}
        assignedSoldiers={
          dialogShift ? schedule[dialogShift.day][dialogShift.shiftKey].soldiers : []
        }
        onToggleAssign={handleToggleAssign}
      />

      <QuickShiftHoursEditor
        isOpen={!!editingShift}
        onClose={() => setEditingShift(null)}
        day={editingShift?.day}
        shiftKey={editingShift?.shiftKey}
        shiftName={editingShift?.shiftName}
        onSave={handleSaveShiftHours}
      />
    </>
  );
}
