import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../entities/User';
import { ShiftSubmission } from '../entities/ShiftSubmission';
import { WeeklySchedule } from '../entities/WeeklySchedule';
import { ShiftAssignment } from '../entities/ShiftAssignment';
import { format, addDays, startOfWeek, addWeeks } from 'date-fns';
import { toWeekStartISO } from '../utils/weekKey';
import { Calendar, Home, Users, Trash2, Edit2, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import ScheduleBoard from '../components/admin/schedule/ScheduleBoard';
import AssignSoldierDialog from '../components/admin/schedule/AssignSoldierDialog';
import PreferencesPanel from '../components/admin/PreferencesPanel';
import QuickShiftHoursEditor from '../components/admin/schedule/QuickShiftHoursEditor';
import { useMediaQuery } from '../components/hooks/useMediaQuery';
import { DAYS, SHIFT_NAMES, SHIFT_REQUIREMENTS, DAY_END_TIMES } from '../config/shifts';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { clearAllShiftAssignments, initializeShiftAssignmentsCollection, clearAllShiftData, removeTuesdayFridayEveningShifts } from '../utils/dbUtils';
import { shiftDefinitionsService } from '../services/shiftDefinitions';
import * as shiftsConfig from '../config/shifts';

export default function ScheduleManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState({});
  const [schedule, setSchedule] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [soldierNotes, setSoldierNotes] = useState({}); // Store soldier notes by user ID/UID
  const [weeklyScheduleEntity, setWeeklyScheduleEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // For showing save feedback
  const [shiftAssignments, setShiftAssignments] = useState([]); // Store all shift assignments with their statuses

  // Preferences panel state
  const [rawSubmissions, setRawSubmissions] = useState([]);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [selectedSoldierId, setSelectedSoldierId] = useState(null);

  // Edit mode state - controls whether cancel shift button is visible
  const [isEditMode, setIsEditMode] = useState(false);

  // Quick shift hours editor state
  const [editingShift, setEditingShift] = useState(null); // { shiftKey, shiftName }

  // Dynamic shift definitions state
  const [dynamicShiftNames, setDynamicShiftNames] = useState(SHIFT_NAMES);

  // Mission filter state
  const [missionFilter, setMissionFilter] = useState("הכל"); // "הכל", "קריית_חינוך", "גבולות"

  // Week navigation state
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, 1 = next week, etc.

  const isMobile = useMediaQuery("(max-width: 768px)");
  const [dialogShift, setDialogShift] = useState(null);

  const selectedWeekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), weekOffset);
  const nextWeekStart = selectedWeekStart; // For backwards compatibility
  const nextWeekStartStr = toWeekStartISO(selectedWeekStart);

  const initializeSchedule = useCallback(() => {
    const newSchedule = {};
    for (const day of DAYS) {
      newSchedule[day] = {};
      const dayEndTime = DAY_END_TIMES[day];

      for (const shiftKey in SHIFT_NAMES) {
        // Skip evening shifts on Tuesday and Friday
        if (shiftKey === 'קריית_חינוך_ערב' && (day === 'tuesday' || day === 'friday')) {
          continue;
        }

        const shiftData = {
          soldiers: [],
          cancelled: false,
          ...SHIFT_REQUIREMENTS[shiftKey]
        };

        // Add custom end times for morning shifts based on the day
        if (shiftKey.includes('בוקר')) {
          shiftData.customStartTime = '07:00';
          shiftData.customEndTime = dayEndTime;
        }

        newSchedule[day][shiftKey] = shiftData;
      }
    }
    return newSchedule;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load users from Firestore only
      let allUsers = [];
      try {
        allUsers = await User.list();
        console.log('ScheduleManagement: Loaded users:', allUsers);
      } catch (error) {
        console.error('ScheduleManagement: Could not load users:', error);
        allUsers = []; // Empty array if loading fails
      }

      const weekEndDate = format(addDays(nextWeekStart, 6), 'yyyy-MM-dd');
      const [allSubmissions, schedules, assignments] = await Promise.all([
        ShiftSubmission.filter({ week_start: nextWeekStartStr }),
        WeeklySchedule.filter({ week_start: nextWeekStartStr }),
        ShiftAssignment.filter({ start_date: nextWeekStartStr, end_date: weekEndDate })
      ]);

      // Store shift assignments
      setShiftAssignments(assignments);
      console.log('ScheduleManagement: Loaded shift assignments:', assignments);

      // Create usersMap with BOTH id and uid as keys for compatibility
      const usersMap = {};
      allUsers.forEach(user => {
        usersMap[user.id] = user; // Map by Firestore doc ID
        if (user.uid && user.uid !== user.id) {
          usersMap[user.uid] = user; // Also map by Firebase Auth UID
        }
      });
      setUsers(usersMap);
      
      // Create submissions map from user weekly_shifts data
      const submissionsMap = {};
      allUsers.forEach(user => {
        if (user.weekly_shifts && user.weekly_shifts[nextWeekStartStr]) {
          const userShifts = user.weekly_shifts[nextWeekStartStr].shifts;
          if (userShifts) {
            submissionsMap[user.id] = userShifts;
            console.log(`ScheduleManagement: Found shifts for user ${user.id}:`, userShifts);
          }
        }
      });
      
      // Also include data from shift_submissions collection as fallback
      allSubmissions.forEach(sub => {
        if (!submissionsMap[sub.user_id]) {
          submissionsMap[sub.user_id] = {};
        }
        for(const day in sub.shifts) {
            if(!submissionsMap[sub.user_id][day]) submissionsMap[sub.user_id][day] = [];
            submissionsMap[sub.user_id][day].push(...sub.shifts[day]);
        }
      });
      
      console.log('ScheduleManagement: Final submissions map:', submissionsMap);
      setSubmissions(submissionsMap);
      
      if (schedules.length > 0) {
        console.log('📥 Loading existing schedule from DB:', schedules[0]);
        const loadedSchedule = schedules[0].schedule;
        console.log('📥 Loaded schedule data:', loadedSchedule);
        const updatedSchedule = {};

        for (const day of DAYS) {
          updatedSchedule[day] = {};
          for (const shiftKey in SHIFT_NAMES) {
            // Skip evening shifts on Tuesday and Friday
            if (shiftKey === 'קריית_חינוך_ערב' && (day === 'tuesday' || day === 'friday')) {
              continue;
            }

            const existingShiftData = loadedSchedule[day]?.[shiftKey] || {};
            const latestRequirements = SHIFT_REQUIREMENTS[shiftKey];

            updatedSchedule[day][shiftKey] = {
              ...latestRequirements,
              soldiers: existingShiftData.soldiers || [],
              cancelled: existingShiftData.cancelled || false,
              // Preserve custom shift hours if they exist
              ...(existingShiftData.customStartTime && { customStartTime: existingShiftData.customStartTime }),
              ...(existingShiftData.customEndTime && { customEndTime: existingShiftData.customEndTime }),
            };

            if (existingShiftData.soldiers && existingShiftData.soldiers.length > 0) {
              console.log(`📥 Loaded soldiers for ${day} ${shiftKey}:`, existingShiftData.soldiers);
            }
          }
        }

        console.log('📥 Final updated schedule:', updatedSchedule);
        setWeeklyScheduleEntity(schedules[0]);
        setSchedule(updatedSchedule);
      } else {
        console.log('📥 No existing schedule found, initializing new one');
        setSchedule(initializeSchedule());
        setWeeklyScheduleEntity(null);
      }
    } catch (error) {
      console.error("Error loading schedule data:", error);
    }
    setLoading(false);
    // nextWeekStart is derived from nextWeekStartStr, so we don't need it in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextWeekStartStr, initializeSchedule]);

  useEffect(() => { loadData(); }, [loadData]);

  // Initialize shift definitions from config and subscribe to real-time updates
  useEffect(() => {
    const initializeShiftDefinitions = async () => {
      try {
        // Initialize Firestore with static config if needed
        await shiftDefinitionsService.initializeFromConfig(shiftsConfig);

        // Subscribe to real-time updates
        const unsubscribe = shiftDefinitionsService.subscribeToShiftDefinitions((updatedShifts) => {
          console.log('ScheduleManagement: Received shift definitions update:', updatedShifts);
          setDynamicShiftNames(updatedShifts.SHIFT_NAMES);

          // Reload schedule to reflect new shift definitions
          loadData();
        });

        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error('ScheduleManagement: Error initializing shift definitions:', error);
      }
    };

    initializeShiftDefinitions();
  }, [loadData]);

  // NOTE: Auto-save is now handled directly in handleShiftSlotClick function
  // This ensures shift_assignments are created immediately when soldiers are assigned

  // Fetch shift submissions for Preferences Panel - Always load automatically
  useEffect(() => {
    setPreferencesLoading(true);

    const fetchSubmissions = async () => {
      try {
        // Fetch from shift_preferences collection (not shift_submissions)
        const q = query(
          collection(db, 'shift_preferences'),
          where('weekStart', '==', nextWeekStartStr)
        );
        const snapshot = await getDocs(q);
        const submissions = snapshot.docs.map(doc => {
          const d = doc.data();
          console.log('Fetched shift_preferences document:', doc.id, d);
          return {
            id: doc.id,
            userName: d.userName,
            userId: d.userId,  // Note: userId not user_id
            days: d.days || {},
            longShiftDays: d.longShiftDays || {}, // Include long shift preferences
            notes: d.notes || '', // Include soldier notes
            updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate() : (d.updatedAt || null),
            createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : (d.createdAt || null),
            weekStart: d.weekStart
          };
        });
        console.log('Fetched shift preferences submissions:', submissions);

        setRawSubmissions(submissions);
      } catch (error) {
        console.error('Error fetching submissions:', error);
      }
      setPreferencesLoading(false);
    };

    fetchSubmissions();
  }, [nextWeekStartStr]);

  // Map soldier notes by all possible user identifiers after both users and submissions are loaded
  useEffect(() => {
    if (Object.keys(users).length === 0 || rawSubmissions.length === 0) return;

    const notesMap = {};
    rawSubmissions.forEach(sub => {
      if (!sub.notes) return;

      // Map by the original userId from the submission
      notesMap[sub.userId] = sub.notes;

      // Find the user and map by all their identifiers
      const user = Object.values(users).find(u => u.uid === sub.userId || u.id === sub.userId);
      if (user) {
        if (user.id) notesMap[user.id] = sub.notes;
        if (user.uid) notesMap[user.uid] = sub.notes;
        console.log(`✅ Mapped notes for ${user.hebrew_name}:`, {
          originalUserId: sub.userId,
          userId: user.id,
          userUid: user.uid,
          notes: sub.notes
        });
      } else {
        console.warn(`⚠️ Could not find user for userId: ${sub.userId}`);
      }
    });

    console.log('📝 Final soldier notes map:', notesMap);
    setSoldierNotes(notesMap);
  }, [users, rawSubmissions]);

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

  const handleShiftClick = (day, shiftKey, shiftName, dayName) => {
    if (!isMobile || isPublished) return;
    setDialogShift({ day, shiftKey, shiftName, dayName });
  };
  
  const handleToggleAssign = (soldierId) => {
    if (!dialogShift) return;
    const currentCount = soldierShiftCounts[soldierId] || 0;
    const isAssigned = dialogShift ? schedule[dialogShift.day][dialogShift.shiftKey].soldiers.includes(soldierId) : false;
    if (!isAssigned && currentCount >= 6) {
        if (!window.confirm(`החייל ${users[soldierId]?.hebrew_name} כבר משובץ ל-6 משמרות. האם אתה בטוח שברצונך להוסיף משמרת נוספת?`)) {
            return;
        }
    }
    const { day, shiftKey } = dialogShift;
    setSchedule(prev => {
      const newSchedule = JSON.parse(JSON.stringify(prev));
      const soldiers = newSchedule[day][shiftKey].soldiers;
      const index = soldiers.indexOf(soldierId);
      if (index > -1) soldiers.splice(index, 1); else soldiers.push(soldierId);
      newSchedule[day][shiftKey].soldiers = soldiers;
      return newSchedule;
    });
  };

  const handleCancelShift = async (day, shiftKey, soldierId = null) => {
    if (soldierId) {
      // Remove specific soldier from shift
      setSchedule(prev => {
        const newSchedule = JSON.parse(JSON.stringify(prev));
        if (newSchedule[day]?.[shiftKey]?.soldiers) {
          newSchedule[day][shiftKey].soldiers = newSchedule[day][shiftKey].soldiers.filter(id => id !== soldierId);
        }
        return newSchedule;
      });

      // Also delete the assignment from the database
      try {
        const soldier = users[soldierId];
        if (!soldier) {
          console.error('Soldier not found:', soldierId);
          return;
        }

        // Calculate the date for this day
        const dayDate = addDays(nextWeekStart, DAYS.indexOf(day));
        const dateStr = format(dayDate, 'yyyy-MM-dd');

        console.log('🗑️ Deleting assignment:', {
          soldier_uid: soldier.uid,
          date: dateStr,
          shift: shiftKey
        });

        // Find and delete the assignment
        const assignments = await ShiftAssignment.filter({
          soldier_id: soldier.uid,
          date: dateStr,
          shift_type: shiftKey
        });

        console.log('Found assignments to delete:', assignments);

        for (const assignment of assignments) {
          await ShiftAssignment.delete(assignment.id);
          console.log('✅ Deleted assignment:', assignment.id);
        }

        // Reload assignments to update the UI
        const weekEndDate = format(addDays(nextWeekStart, 6), 'yyyy-MM-dd');
        const updatedAssignments = await ShiftAssignment.filter({
          start_date: nextWeekStartStr,
          end_date: weekEndDate
        });
        setShiftAssignments(updatedAssignments);

        console.log('✅ Assignment deleted and UI updated');
      } catch (error) {
        console.error('❌ Error deleting assignment:', error);
        alert('שגיאה במחיקת השיבוץ מהמסד נתונים: ' + error.message);
      }
    } else {
      // Cancel/uncanel entire shift
      if (!window.confirm("האם אתה בטוח שברצונך לבטל את המשמרת הזו?")) return;
      setSchedule(prev => ({
        ...prev,
        [day]: {
          ...prev[day],
          [shiftKey]: {
            ...prev[day][shiftKey],
            cancelled: !prev[day][shiftKey].cancelled
          }
        }
      }));
    }
  };

  const handleToggleLongShift = async (day, shiftKey, soldierId, isLong) => {
    console.log('🎯 handleToggleLongShift CALLED:', {
      day,
      shiftKey,
      soldierId,
      isLong,
      usersKeys: Object.keys(users).slice(0, 5)
    });

    try {
      const soldier = users[soldierId];
      if (!soldier) {
        console.error('❌ Soldier not found:', soldierId);
        console.error('Available user keys:', Object.keys(users));
        return;
      }

      console.log('✅ Soldier found:', soldier.hebrew_name);

      // Calculate the date for this day
      const dayDate = addDays(selectedWeekStart, DAYS.indexOf(day));
      const dateStr = format(dayDate, 'yyyy-MM-dd');

      console.log('⏰ Toggling long shift:', {
        soldier_uid: soldier.uid,
        date: dateStr,
        shift: shiftKey,
        isLong
      });

      // Find and update the assignment
      console.log('🔍 Searching for assignment with:', {
        soldier_id: soldier.uid,
        date: dateStr,
        shift_type: shiftKey
      });

      const assignments = await ShiftAssignment.filter({
        soldier_id: soldier.uid,
        date: dateStr,
        shift_type: shiftKey
      });

      console.log('📋 Found assignments:', assignments.length, assignments);

      if (assignments.length > 0) {
        for (const assignment of assignments) {
          console.log('🔄 Updating assignment:', assignment.id, 'with isLongShift:', isLong);
          await ShiftAssignment.update(assignment.id, {
            isLongShift: isLong
          });
          console.log('✅ Updated assignment long shift status:', assignment.id, isLong);
        }

        // Reload assignments to update the UI
        const weekEndDate = format(addDays(selectedWeekStart, 6), 'yyyy-MM-dd');
        console.log('🔄 Reloading assignments for week:', nextWeekStartStr, 'to', weekEndDate);
        const updatedAssignments = await ShiftAssignment.filter({
          start_date: nextWeekStartStr,
          end_date: weekEndDate
        });
        console.log('📋 Reloaded assignments:', updatedAssignments.length);
        setShiftAssignments(updatedAssignments);

        console.log('✅ Long shift status updated successfully');
      } else {
        console.warn('⚠️ No assignment found to update');
        console.warn('💡 This might mean the soldier was not published yet or assignment was deleted');
        alert('לא נמצא שיבוץ לעדכון. אנא וודא שהחייל משובץ למשמרת.');
      }
    } catch (error) {
      console.error('❌ Error toggling long shift:', error);
      alert('שגיאה בעדכון סטטוס משמרת ארוכה: ' + error.message);
    }
  };

  const handleManualSave = async () => {
    setSaving(true);
    setSaveStatus('שומר...');
    try {
        console.log('💾 Manually saving schedule...', { schedule, weeklyScheduleEntity: weeklyScheduleEntity?.id });

        // Save to weekly_schedules collection
        if (weeklyScheduleEntity) {
            await WeeklySchedule.update(weeklyScheduleEntity.id, { schedule });
            console.log('✅ Weekly schedule updated successfully!');
        } else {
            const newEntity = await WeeklySchedule.create({
              week_start: nextWeekStartStr,
              schedule: schedule,
              is_published: false
            });
            setWeeklyScheduleEntity(newEntity);
            console.log('✅ New schedule created and saved!');
        }

        setSaveStatus('✅ נשמר בהצלחה');
        setTimeout(() => setSaveStatus(''), 2000);
        alert("הסידור נשמר בהצלחה!");
    } catch (e) {
        console.error("Error saving schedule:", e);
        setSaveStatus('❌ שגיאה בשמירה');
        setTimeout(() => setSaveStatus(''), 3000);
        alert("שגיאה בשמירת הסידור: " + e.message);
    }
    setSaving(false);
  };
  

  const handlePublishToSoldiers = async () => {
    if (!window.confirm("האם לפרסם את הסידור לכל החיילים? החיילים יוכלו לראות את השיבוצים שלהם.")) return;
    setSaving(true);
    try {
      console.log('Publishing schedule to soldiers...');

      // Load existing assignments to preserve manual isLongShift toggles
      const existingAssignments = await ShiftAssignment.filter({
        start_date: nextWeekStartStr,
        end_date: format(addDays(nextWeekStart, 6), 'yyyy-MM-dd')
      });

      // Create a map of existing long shift statuses (manually toggled by admin)
      const existingLongShifts = {};
      existingAssignments.forEach(assignment => {
        if (assignment.isLongShift) {
          const key = `${assignment.soldier_id}_${assignment.date}_${assignment.shift_type}`;
          existingLongShifts[key] = true;
        }
      });

      console.log('📋 Preserving', Object.keys(existingLongShifts).length, 'manually toggled long shifts');

      const assignments = [];

      // Iterate through the schedule and create assignments
      for (const day of DAYS) {
        const dayDate = addDays(nextWeekStart, DAYS.indexOf(day));
        const dateStr = format(dayDate, 'yyyy-MM-dd');

        for (const shiftKey in schedule[day]) {
          const shift = schedule[day][shiftKey];
          if (shift && shift.soldiers && shift.soldiers.length > 0) {
            for (const soldierId of shift.soldiers) {
              const soldier = users[soldierId];
              if (soldier) {
                // CRITICAL: Use soldier.uid (Firebase Auth UID), not soldierId (Firestore doc ID)
                if (!soldier.uid) {
                  console.error('❌ Soldier missing uid field:', soldier);
                  continue; // Skip this soldier
                }

                console.log('📝 Publishing assignment for:', soldier.hebrew_name, {
                  'Using soldier.uid': soldier.uid,
                  'NOT using soldierId': soldierId,
                  'Are they same?': soldier.uid === soldierId ? 'YES' : 'NO'
                });

                // Extract shift times from the shift data
                const shiftData = schedule[day][shiftKey];
                let startTime = '00:00';
                let endTime = '23:59';

                // Check for custom hours first
                if (shiftData.customStartTime && shiftData.customEndTime) {
                  startTime = shiftData.customStartTime;
                  endTime = shiftData.customEndTime;
                } else {
                  // Extract from shift name
                  const shiftDisplayName = SHIFT_NAMES[shiftKey] || '';
                  const timeMatch = shiftDisplayName.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
                  if (timeMatch) {
                    startTime = timeMatch[1];
                    endTime = timeMatch[2];
                  }
                }

                // Check if soldier has long shift preference for this day
                const soldierSubmission = normalizedSubmissions.find(sub =>
                  sub.userId === soldierId || sub.userId === soldier.uid
                );
                const hasLongShiftPref = soldierSubmission?.longShiftDays?.[day] || false;

                // For morning shifts, check if soldier preferred long shift OR if admin manually toggled it
                const isMorningShift = shiftKey.includes('בוקר');
                const manualToggleKey = `${soldier.uid}_${dateStr}_${shiftKey}`;
                const wasManuallyToggled = existingLongShifts[manualToggleKey] || false;

                // Preserve manual toggle if it exists, otherwise use preference
                const isLongShift = isMorningShift && (wasManuallyToggled || hasLongShiftPref);

                console.log(`📋 Publishing ${soldier.hebrew_name} for ${day} ${shiftKey}:`, {
                  hasLongShiftPref,
                  isMorningShift,
                  wasManuallyToggled,
                  isLongShift
                });

                // Determine end time for long shifts
                let longShiftEndTime = '15:30';
                if (isLongShift && day === 'tuesday') {
                  longShiftEndTime = '16:15';
                }

                assignments.push({
                  soldier_id: soldier.uid,  // ✅ FIXED: Use Auth UID, not Firestore doc ID
                  soldier_name: soldier.hebrew_name || soldier.displayName || soldier.full_name,
                  date: dateStr,
                  day_name: day,
                  shift_type: shiftKey,
                  shift_name: SHIFT_NAMES[shiftKey],
                  start_time: startTime,
                  end_time: isLongShift ? longShiftEndTime : endTime, // Override end time for long shifts (16:15 for Tuesday, 15:30 for others)
                  week_start: nextWeekStartStr,
                  status: 'assigned',
                  isLongShift: isLongShift // Add isLongShift field
                });
              }
            }
          }
        }
      }

      console.log(`Creating ${assignments.length} assignments for soldiers...`);

      // Delete old assignments for this week first
      const oldAssignments = await ShiftAssignment.filter({
        start_date: nextWeekStartStr,
        end_date: format(addDays(nextWeekStart, 6), 'yyyy-MM-dd')
      });

      for (const oldAssignment of oldAssignments) {
        await ShiftAssignment.delete(oldAssignment.id);
      }

      // Create new assignments
      await ShiftAssignment.bulkCreate(assignments);

      alert(`הסידור פורסם בהצלחה! ${assignments.length} שיבוצים נשלחו לחיילים.`);

    } catch (e) {
      console.error("Error publishing to soldiers:", e);
      alert("שגיאה בפרסום הסידור לחיילים: " + e.message);
    }
    setSaving(false);
  };

  const handleResetShiftData = async () => {
    if (!window.confirm("⚠️ האם אתה בטוח שברצונך לאפס את הגדרות המשמרות?\n\nפעולה זו תמחק:\n- הגדרות משמרות (shift_definitions)\n- סוגי משמרות (shift_types)\n- שעות מותאמות אישית (weekly_shift_hours)\n\nהמשמרות יטענו מחדש מההגדרות בקוד עם השעות החדשות.\n\nפעולה זו אינה הפיכה!")) {
      return;
    }

    setSaving(true);
    try {
      console.log('🗑️ Resetting shift data...');

      const results = await clearAllShiftData();

      alert(`✅ הגדרות המשמרות אופסו בהצלחה!\n\nנמחקו:\n- ${results.definitions.deleted} הגדרות משמרות\n- ${results.types.deleted} סוגי משמרות\n- ${results.weeklyHours.deleted} שעות מותאמות\n\nהעמוד ייטען מחדש כעת...`);

      // Reload the page to reinitialize everything
      window.location.reload();
    } catch (error) {
      console.error('❌ Error resetting shift data:', error);
      alert('שגיאה באיפוס הגדרות המשמרות: ' + error.message);
    }
    setSaving(false);
  };

  const handleRemoveTuesdayFridayEveningShifts = async () => {
    if (!window.confirm("האם למחוק את משמרות הערב של יום שלישי ושישי מכל הסידורים? פעולה זו תעדכן את כל הסידורים הקיימים.")) {
      return;
    }

    setSaving(true);
    try {
      console.log('🗑️ Removing Tuesday and Friday evening shifts...');

      const result = await removeTuesdayFridayEveningShifts();

      alert(`✅ הפעולה הושלמה!\n\nעובדו ${result.processed} סידורים\nעודכנו ${result.modified} סידורים\n\nהעמוד ייטען מחדש כעת...`);

      // Reload the page to show updated schedule
      window.location.reload();
    } catch (error) {
      console.error('❌ Error removing evening shifts:', error);
      alert('שגיאה במחיקת משמרות הערב: ' + error.message);
    }
    setSaving(false);
  };

  const handleClearAllAssignments = async () => {
    if (!window.confirm("האם אתה בטוח שברצונך למחוק את כל שיבוצי המשמרות? פעולה זו אינה הפיכה!")) {
      return;
    }

    setSaving(true);
    try {
      console.log('🗑️ Clearing all shift assignments...');

      // Initialize collection if it doesn't exist
      await initializeShiftAssignmentsCollection();

      // Clear all assignments
      const result = await clearAllShiftAssignments();

      alert(`נמחקו ${result.deleted} שיבוצים בהצלחה! כעת אפשר להתחיל מחדש.`);
      console.log('✅ Cleared assignments:', result);
    } catch (e) {
      console.error("Error clearing assignments:", e);
      alert("שגיאה במחיקת שיבוצים: " + e.message);
    }
    setSaving(false);
  };

  const handleEditShiftHours = (day, shiftKey, shiftName) => {
    console.log('Opening shift hours editor for:', day, shiftKey, shiftName);
    setEditingShift({ day, shiftKey, shiftName });
  };

  const handleSaveShiftHours = async (day, shiftKey, startTime, endTime) => {
    try {
      console.log('💾 Saving shift hours for:', day, shiftKey, 'New times:', startTime, '-', endTime);

      // Update the schedule state with new times for this specific day/shift
      const newSchedule = JSON.parse(JSON.stringify(schedule));

      if (newSchedule[day]?.[shiftKey]) {
        // Store the custom hours in the shift data
        newSchedule[day][shiftKey].customStartTime = startTime;
        newSchedule[day][shiftKey].customEndTime = endTime;

        console.log('📝 Updated shift data:', newSchedule[day][shiftKey]);
      }

      setSchedule(newSchedule);

      // Immediately save to database
      try {
        if (weeklyScheduleEntity) {
          await WeeklySchedule.update(weeklyScheduleEntity.id, { schedule: newSchedule });
          console.log('✅ Weekly schedule updated in database!');
        } else {
          const newEntity = await WeeklySchedule.create({
            week_start: nextWeekStartStr,
            schedule: newSchedule,
            is_published: false
          });
          setWeeklyScheduleEntity(newEntity);
          console.log('✅ New schedule created in database!');
        }

        alert(`שעות המשמרת עודכנו בהצלחה עבור יום ${day}!`);
      } catch (saveError) {
        console.error('❌ Error saving to database:', saveError);
        alert('שגיאה בשמירה למאגר: ' + saveError.message);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error saving shift hours:', error);
      throw error;
    }
  };

  const isPublished = weeklyScheduleEntity?.is_published;

  // Handle soldier selection from preferences panel
  const handleSelectSoldier = (soldierId) => {
    if (selectedSoldierId === soldierId) {
      // Deselect if clicking the same soldier
      setSelectedSoldierId(null);
      console.log('❌ Soldier deselected');
    } else {
      setSelectedSoldierId(soldierId);
      const soldierObj = users[soldierId];
      console.log('✅ Soldier selected:', {
        name: soldierObj?.hebrew_name || soldierObj?.displayName,
        selectedSoldierId: soldierId,
        'soldier.id': soldierObj?.id,
        'soldier.uid': soldierObj?.uid,
        'Full soldier object': soldierObj
      });
    }
  };

  // Handle clicking on a shift slot to assign/remove selected soldier
  const handleShiftSlotClick = async (day, shiftKey) => {
    console.log('🎯 handleShiftSlotClick called:', { day, shiftKey, selectedSoldierId });

    if (!selectedSoldierId) {
      console.log('⚠️ No soldier selected. Click on a soldier first.');
      return;
    }

    const soldier = users[selectedSoldierId];
    if (!soldier) {
      console.error('❌ Soldier not found:', selectedSoldierId);
      return;
    }

    console.log('👤 Soldier found:', soldier.hebrew_name || soldier.displayName);

    // Track what action we're performing
    let actionType = null; // 'add' or 'remove'
    let updatedSchedule = null;

    setSchedule(prev => {
      const newSchedule = JSON.parse(JSON.stringify(prev));

      if (newSchedule[day]?.[shiftKey]) {
        const soldierIndex = newSchedule[day][shiftKey].soldiers.indexOf(selectedSoldierId);

        if (soldierIndex !== -1) {
          // Soldier is already in this shift - remove them
          newSchedule[day][shiftKey].soldiers.splice(soldierIndex, 1);
          console.log('🗑️ Soldier removed from shift:', soldier.hebrew_name);
          actionType = 'remove';
        } else {
          // Soldier not in shift - add them (with confirmation if already at 6+ shifts)
          const currentCount = soldierShiftCounts[selectedSoldierId] || 0;
          if (currentCount >= 6) {
            if (!window.confirm(`החייל ${soldier.hebrew_name} כבר משובץ ל-6 משמרות. האם אתה בטוח שברצונך להוסיף משמרת נוספת?`)) {
              return prev; // Return unchanged schedule
            }
          }
          newSchedule[day][shiftKey].soldiers.push(selectedSoldierId);
          console.log('✅ Soldier assigned to shift:', soldier.hebrew_name);
          actionType = 'add';
        }
        updatedSchedule = newSchedule;
      } else {
        console.log('❌ Shift not found:', shiftKey);
      }

      return newSchedule;
    });

    // Auto-save: Create or delete ShiftAssignment immediately
    try {
      const dayDate = addDays(selectedWeekStart, DAYS.indexOf(day));
      const dateStr = format(dayDate, 'yyyy-MM-dd');

      if (actionType === 'add') {
        // Extract shift times
        const shiftData = schedule[day][shiftKey];
        let startTime = '00:00';
        let endTime = '23:59';

        if (shiftData.customStartTime && shiftData.customEndTime) {
          startTime = shiftData.customStartTime;
          endTime = shiftData.customEndTime;
        } else {
          const shiftDisplayName = dynamicShiftNames[shiftKey] || SHIFT_NAMES[shiftKey] || '';
          const timeMatch = shiftDisplayName.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
          if (timeMatch) {
            startTime = timeMatch[1];
            endTime = timeMatch[2];
          }
        }

        // Check if soldier has long shift preference for this day
        const soldierSubmission = normalizedSubmissions.find(sub =>
          sub.userId === selectedSoldierId || sub.userId === soldier.uid
        );
        const hasLongShiftPref = soldierSubmission?.longShiftDays?.[day] || false;

        // For morning shifts, check if soldier preferred long shift
        const isMorningShift = shiftKey.includes('בוקר');
        const isLongShift = isMorningShift && hasLongShiftPref;

        console.log(`📋 Manual assignment for ${soldier.hebrew_name} on ${day}:`, {
          hasLongShiftPref,
          isMorningShift,
          isLongShift
        });

        // Determine end time for long shifts
        let longShiftEndTime = '15:30';
        if (isLongShift && day === 'tuesday') {
          longShiftEndTime = '16:15';
        }

        // Create assignment
        await ShiftAssignment.create({
          soldier_id: soldier.uid,
          soldier_name: soldier.hebrew_name || soldier.displayName || soldier.full_name,
          date: dateStr,
          day_name: day,
          shift_type: shiftKey,
          shift_name: dynamicShiftNames[shiftKey] || SHIFT_NAMES[shiftKey],
          start_time: startTime,
          end_time: isLongShift ? longShiftEndTime : endTime, // 16:15 for Tuesday, 15:30 for others
          week_start: nextWeekStartStr,
          status: 'assigned',
          isLongShift: isLongShift // Add isLongShift based on soldier's preference
        });

        console.log('✅ ShiftAssignment created immediately with isLongShift:', isLongShift);
      } else if (actionType === 'remove') {
        // Delete assignment
        const assignments = await ShiftAssignment.filter({
          soldier_id: soldier.uid,
          date: dateStr,
          shift_type: shiftKey
        });

        for (const assignment of assignments) {
          await ShiftAssignment.delete(assignment.id);
          console.log('✅ ShiftAssignment deleted:', assignment.id);
        }
      }

      // Reload assignments to update the UI
      const weekEndDate = format(addDays(selectedWeekStart, 6), 'yyyy-MM-dd');
      const updatedAssignments = await ShiftAssignment.filter({
        start_date: nextWeekStartStr,
        end_date: weekEndDate
      });
      setShiftAssignments(updatedAssignments);

    } catch (error) {
      console.error('❌ Error auto-saving assignment:', error);
    }

    console.log('📊 After setSchedule:', { hasSchedule: !!updatedSchedule, actionType });
    console.log('✅ Soldier assignment updated and saved.');
  };

  const normalizedSubmissions = useMemo(() => {
    console.log('ScheduleManagement: Raw submissions from Firestore:', rawSubmissions);

    // Create map of submissions by userId for O(1) lookup
    const submissionsByUserId = new Map();

    rawSubmissions.forEach(sub => {
      console.log('Processing submission:', sub);
      console.log('Submission userId:', sub.userId);
      console.log('Submission days:', sub.days);

      // Ensure all days exist in the days object
      const normalizedDays = {
        sunday: sub.days?.sunday || [],
        monday: sub.days?.monday || [],
        tuesday: sub.days?.tuesday || [],
        wednesday: sub.days?.wednesday || [],
        thursday: sub.days?.thursday || [],
        friday: sub.days?.friday || [],
        saturday: sub.days?.saturday || []
      };

      console.log('Normalized days:', normalizedDays);

      const normalized = {
        id: sub.id,
        userId: sub.userId,
        uid: sub.userId,
        userName: sub.userName || 'ללא שם',
        updatedAt: sub.updatedAt || new Date(),
        days: normalizedDays,
        weekStart: sub.weekStart,
        longShiftDays: sub.longShiftDays || {}, // Include long shift preferences
        notes: sub.notes || '' // Include soldier notes
      };

      console.log('Normalized submission with days:', normalized);

      // Keep only the latest submission per user
      const existing = submissionsByUserId.get(sub.userId);
      if (!existing || normalized.updatedAt > existing.updatedAt) {
        submissionsByUserId.set(sub.userId, normalized);
      }
    });

    console.log('ScheduleManagement: Submissions by userId:', Array.from(submissionsByUserId.keys()));

    // Get all roster soldiers - filter out duplicates by using a Map with user.id as key
    const soldiersMap = new Map();
    Object.values(users).forEach(user => {
      if ((user.role === 'soldier' || user.role === 'user') && !soldiersMap.has(user.id)) {
        soldiersMap.set(user.id, user);
      }
    });
    const allSoldiers = Array.from(soldiersMap.values());
    console.log('ScheduleManagement: All soldiers:', allSoldiers.map(s => `${s.id}: ${s.hebrew_name || s.full_name}`));

    // Join roster with submissions
    const submitted = [];
    const notSubmitted = [];

    allSoldiers.forEach(soldier => {
      // Try to match by both id and uid (for new vs old user formats)
      let submission = submissionsByUserId.get(soldier.id);
      if (!submission && soldier.uid) {
        submission = submissionsByUserId.get(soldier.uid);
      }

      if (submission) {
        // Update submission with soldier info for consistency
        submitted.push({
          ...submission,
          userName: soldier.hebrew_name || soldier.displayName || soldier.full_name || submission.userName || 'ללא שם',
          userId: soldier.id,
          uid: soldier.id
        });
      } else {
        // Create empty submission for soldiers who didn't submit
        notSubmitted.push({
          id: `missing_${soldier.id}`,
          uid: soldier.id,
          userId: soldier.id,
          userName: soldier.hebrew_name || soldier.displayName || soldier.full_name || 'ללא שם',
          weekStart: nextWeekStartStr,
          updatedAt: new Date(0), // Very old date to sort last
          days: {
            sunday: [],
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: []
          }
        });
      }
    });

    console.log('ScheduleManagement: Submitted soldiers:', submitted.map(s => `${s.uid}: ${s.userName}`));
    console.log('ScheduleManagement: Not submitted soldiers:', notSubmitted.map(s => `${s.uid}: ${s.userName}`));

    return [...submitted, ...notSubmitted];
  }, [rawSubmissions, users, nextWeekStartStr]);

  if (loading) return <div className="p-6 text-center">טוען נתונים...</div>;

  const availableSoldiers = Object.values(users).filter((u) => u.is_active);

  console.log('ScheduleManagement: Available soldiers:', availableSoldiers);
  console.log('ScheduleManagement: Users:', users);

  return (
    <>
        <div className="flex h-[calc(100vh-4rem)] bg-gray-100 overflow-hidden" dir="rtl">
            {/* Preferences Panel - Always open on left */}
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
                <div className="relative flex items-center justify-center mb-4 flex-shrink-0">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate('/admin')}
                        className="absolute left-0"
                    >
                        <Home className="w-5 h-5"/>
                    </Button>

                    <div className="text-center">
                        <div className="flex items-center gap-3 justify-center">
                            <Calendar className="w-8 h-8 text-blue-600"/>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-black">ניהול סידור עבודה</h1>
                                <div className="flex items-center gap-2 justify-center">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setWeekOffset(weekOffset - 1)}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronRight className="w-4 h-4"/>
                                    </Button>
                                    <p className="text-gray-600 min-w-[150px] text-center">שבוע מתאריך: {format(selectedWeekStart, 'dd/MM/yyyy')}</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setWeekOffset(weekOffset + 1)}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronLeft className="w-4 h-4"/>
                                    </Button>
                                </div>
                                {saveStatus && (
                                    <p className={`text-sm mt-1 ${saveStatus.includes('✅') ? 'text-green-600' : saveStatus.includes('❌') ? 'text-red-600' : 'text-blue-600'}`}>
                                        {saveStatus}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 items-center flex-wrap">
                        <Button
                            variant={isEditMode ? "default" : "outline"}
                            onClick={() => setIsEditMode(!isEditMode)}
                            disabled={saving}
                            className={isEditMode ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                        >
                            <Edit2 className="w-4 h-4 ml-2"/>{isEditMode ? "סיום עריכה" : "ערוך"}
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleManualSave}
                            disabled={saving}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            <Save className="w-4 h-4 ml-2"/>שמור סידור
                        </Button>
                        <Button variant="outline" onClick={handleRemoveTuesdayFridayEveningShifts} disabled={saving} className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"><Trash2 className="w-4 h-4 ml-2"/>מחק ערב שלישי/שישי</Button>
                        <Button variant="outline" onClick={handleClearAllAssignments} disabled={saving} className="border-red-300 text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4 ml-2"/>נקה שיבוצים</Button>
                        <Button variant="outline" onClick={handleResetShiftData} disabled={saving} className="border-orange-300 text-orange-600 hover:bg-orange-50"><Trash2 className="w-4 h-4 ml-2"/>אפס הגדרות משמרות</Button>
                        <Button onClick={handlePublishToSoldiers} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white"><Users className="w-4 h-4 ml-2"/>פרסם לחיילים</Button>
                    </div>
                </div>

                {/* Mission Filter Buttons */}
                <div className="flex gap-2 mb-4 flex-shrink-0">
                    <span className="text-sm font-medium text-gray-700 flex items-center">סינון לפי משימה:</span>
                    <Button
                        variant={missionFilter === "הכל" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMissionFilter("הכל")}
                    >
                        הכל
                    </Button>
                    <Button
                        variant={missionFilter === "קריית_חינוך" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMissionFilter("קריית_חינוך")}
                    >
                        קריית חינוך
                    </Button>
                    <Button
                        variant={missionFilter === "גבולות" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMissionFilter("גבולות")}
                    >
                        גבולות
                    </Button>
                </div>

                 <div className="flex-1 overflow-auto pb-4 min-h-0">
                    <ScheduleBoard
                        schedule={schedule}
                        users={users}
                        submissions={submissions}
                        soldierShiftCounts={soldierShiftCounts}
                        soldierNotes={soldierNotes}
                        isPublished={isPublished}
                        isEditMode={isEditMode}
                        onCancelShift={handleCancelShift}
                        onShiftClick={handleShiftClick}
                        isMobile={isMobile}
                        onShiftSlotClick={handleShiftSlotClick}
                        selectedSoldierId={selectedSoldierId}
                        onEditShiftHours={handleEditShiftHours}
                        dynamicShiftNames={dynamicShiftNames}
                        missionFilter={missionFilter}
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
            assignedSoldiers={dialogShift ? schedule[dialogShift.day][dialogShift.shiftKey].soldiers : []}
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



