import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../entities/User';
import { ShiftSubmission } from '../entities/ShiftSubmission';
import { WeeklySchedule } from '../entities/WeeklySchedule';
import { ShiftAssignment } from '../entities/ShiftAssignment';
import { format, addDays, startOfWeek } from 'date-fns';
import { toWeekStartISO } from '../utils/weekKey';
import { Calendar, Save, Sparkles, Home, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import ScheduleBoard from '../components/admin/schedule/ScheduleBoard';
import AssignSoldierDialog from '../components/admin/schedule/AssignSoldierDialog';
import PreferencesPanel from '../components/admin/PreferencesPanel';
import { useMediaQuery } from '../components/hooks/useMediaQuery';
import { DAYS, SHIFT_NAMES, SHIFT_REQUIREMENTS } from '../config/shifts';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function ScheduleManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState({});
  const [schedule, setSchedule] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [weeklyScheduleEntity, setWeeklyScheduleEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Preferences panel state
  const [rawSubmissions, setRawSubmissions] = useState([]);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [selectedSoldierId, setSelectedSoldierId] = useState(null);
  
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [dialogShift, setDialogShift] = useState(null);

  const nextWeekStart = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7);
  const nextWeekStartStr = toWeekStartISO(nextWeekStart);

  const initializeSchedule = useCallback(() => {
    const newSchedule = {};
    for (const day of DAYS) {
      newSchedule[day] = {};
      for (const shiftKey in SHIFT_NAMES) {
        newSchedule[day][shiftKey] = { 
          soldiers: [],
          cancelled: false,
          ...SHIFT_REQUIREMENTS[shiftKey]
        };
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

      const [allSubmissions, schedules] = await Promise.all([
        ShiftSubmission.filter({ week_start: nextWeekStartStr }),
        WeeklySchedule.filter({ week_start: nextWeekStartStr })
      ]);

      const usersMap = allUsers.reduce((acc, user) => { acc[user.id] = user; return acc; }, {});
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
            const existingShiftData = loadedSchedule[day]?.[shiftKey] || {};
            const latestRequirements = SHIFT_REQUIREMENTS[shiftKey];

            updatedSchedule[day][shiftKey] = {
              ...latestRequirements,
              soldiers: existingShiftData.soldiers || [],
              cancelled: existingShiftData.cancelled || false,
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
  }, [nextWeekStartStr, initializeSchedule]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-save schedule when it changes (with debounce)
  useEffect(() => {
    if (loading) return; // Don't save during initial load

    const timeoutId = setTimeout(async () => {
      try {
        if (weeklyScheduleEntity) {
          await WeeklySchedule.update(weeklyScheduleEntity.id, { schedule });
          console.log('Auto-saved schedule');
        } else if (Object.keys(schedule).length > 0) {
          // Only create if schedule has data
          const hasAssignments = DAYS.some(day =>
            Object.values(schedule[day] || {}).some(shift =>
              shift?.soldiers?.length > 0
            )
          );
          if (hasAssignments) {
            const newEntity = await WeeklySchedule.create({
              week_start: nextWeekStartStr,
              schedule: schedule,
              is_published: false
            });
            setWeeklyScheduleEntity(newEntity);
            console.log('Auto-saved new schedule');
          }
        }
      } catch (e) {
        console.error("Error auto-saving:", e);
      }
    }, 2000); // Save 2 seconds after last change

    return () => clearTimeout(timeoutId);
  }, [schedule, weeklyScheduleEntity, loading, nextWeekStartStr]);

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

  const handleCancelShift = (day, shiftKey, soldierId = null) => {
    if (soldierId) {
      // Remove specific soldier from shift
      setSchedule(prev => {
        const newSchedule = JSON.parse(JSON.stringify(prev));
        if (newSchedule[day]?.[shiftKey]?.soldiers) {
          newSchedule[day][shiftKey].soldiers = newSchedule[day][shiftKey].soldiers.filter(id => id !== soldierId);
        }
        return newSchedule;
      });
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

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
        console.log('💾 Saving draft...', { schedule, weeklyScheduleEntity: weeklyScheduleEntity?.id });
        if (weeklyScheduleEntity) {
            await WeeklySchedule.update(weeklyScheduleEntity.id, { schedule });
            console.log('✅ Draft updated successfully');
        } else {
            const newEntity = await WeeklySchedule.create({ week_start: nextWeekStartStr, schedule: schedule, is_published: false });
            setWeeklyScheduleEntity(newEntity);
            console.log('✅ New draft created successfully:', newEntity.id);
        }
        alert("טיוטה נשמרה בהצלחה");
    } catch (e) {
        console.error("Error saving draft:", e);
        alert("שגיאה בשמירת הטיוטה");
    }
    setSaving(false);
  };
  

  const handlePublishToSoldiers = async () => {
    if (!window.confirm("האם לפרסם את הסידור לכל החיילים? החיילים יוכלו לראות את השיבוצים שלהם.")) return;
    setSaving(true);
    try {
      console.log('Publishing schedule to soldiers...');
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
                assignments.push({
                  soldier_id: soldierId,
                  soldier_name: soldier.hebrew_name || soldier.displayName || soldier.full_name,
                  date: dateStr,
                  day_name: day,
                  shift_type: shiftKey,
                  shift_name: SHIFT_NAMES[shiftKey],
                  week_start: nextWeekStartStr,
                  status: 'assigned'
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
  
  const autoAssign = () => {
     alert("שיבוץ אוטומטי - יפותח בגרסה הבאה. בינתיים, בוא נשבץ לפי הגשות.");
     setSchedule(prev => {
        const newSchedule = initializeSchedule();
        const assignedSoldiers = new Set();
        for (const userId in submissions) {
            for (const day in submissions[userId]) {
                for(const shiftType of submissions[userId][day]) {
                    const unit = users[userId]?.unit;
                    if (!unit) continue;
                    const key = `${unit}_${shiftType}`;
                    if(newSchedule[day] && newSchedule[day][key]) {
                        if (newSchedule[day][key].soldiers.length < newSchedule[day][key].required) {
                            if (!assignedSoldiers.has(userId)) {
                                newSchedule[day][key].soldiers.push(userId);
                                assignedSoldiers.add(userId);
                            }
                        }
                    }
                }
            }
        }
        return newSchedule;
    });
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
      console.log('✅ Soldier selected:', users[soldierId]?.hebrew_name, soldierId);
    }
  };

  // Handle clicking on a shift slot to assign/remove selected soldier
  const handleShiftSlotClick = async (day, shiftKey) => {
    if (!selectedSoldierId) {
      console.log('⚠️ No soldier selected. Click on a soldier first.');
      return;
    }

    const soldier = users[selectedSoldierId];
    if (!soldier) {
      console.error('❌ Soldier not found:', selectedSoldierId);
      return;
    }

    let updatedSchedule = null;
    let isAdding = false;
    let isRemoving = false;

    setSchedule(prev => {
      const newSchedule = JSON.parse(JSON.stringify(prev));

      if (newSchedule[day]?.[shiftKey]) {
        const soldierIndex = newSchedule[day][shiftKey].soldiers.indexOf(selectedSoldierId);

        if (soldierIndex !== -1) {
          // Soldier is already in this shift - remove them
          newSchedule[day][shiftKey].soldiers.splice(soldierIndex, 1);
          console.log('🗑️ Soldier removed from shift:', soldier.hebrew_name);
          isRemoving = true;
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
          isAdding = true;
        }
        updatedSchedule = newSchedule;
      } else {
        console.log('❌ Shift not found:', shiftKey);
      }

      return newSchedule;
    });

    // Save immediately with the updated schedule
    if (updatedSchedule) {
      setTimeout(async () => {
        try {
          console.log('💾 Auto-saving after assignment...');

          // 1. Save to weekly_schedules collection
          if (weeklyScheduleEntity) {
            await WeeklySchedule.update(weeklyScheduleEntity.id, { schedule: updatedSchedule });
            console.log('✅ Weekly schedule updated successfully!');
          } else {
            const newEntity = await WeeklySchedule.create({
              week_start: nextWeekStartStr,
              schedule: updatedSchedule,
              is_published: false
            });
            setWeeklyScheduleEntity(newEntity);
            console.log('✅ New schedule created and saved!');
          }

          // 2. Calculate the date for this day
          const dayIndex = DAYS.indexOf(day);
          const shiftDate = format(addDays(nextWeekStart, dayIndex), 'yyyy-MM-dd');

          // 3. Create or delete shift_assignment for the soldier
          if (isAdding) {
            console.log('🔍 Creating shift assignment for soldier:', {
              selectedSoldierId,
              soldier,
              day,
              shiftKey,
              shiftDate
            });

            // Extract start and end times from shift key (e.g., "קריית_חינוך_בוקר_07_1430" -> "07:00", "14:30")
            const timeMatch = shiftKey.match(/(\d{2})_(\d{2,4})$/);
            let startTime = '00:00';
            let endTime = '23:59';

            if (timeMatch) {
              const start = timeMatch[1];
              const end = timeMatch[2];
              startTime = `${start}:00`;
              if (end.length === 4) {
                endTime = `${end.substring(0, 2)}:${end.substring(2)}`;
              } else {
                endTime = `${end}:00`;
              }
            }

            // Use soldier.uid if available (Firebase Auth ID), otherwise use the document ID
            const soldierIdToUse = soldier.uid || selectedSoldierId;

            // Create a new shift assignment so soldier can see it
            const assignmentData = {
              soldier_id: soldierIdToUse,
              soldier_name: soldier.hebrew_name || soldier.displayName || soldier.full_name,
              date: shiftDate,
              day_name: day,
              shift_type: shiftKey,
              shift_name: SHIFT_NAMES[shiftKey],
              start_time: startTime,
              end_time: endTime,
              week_start: nextWeekStartStr,
              status: 'assigned'
            };

            console.log('📝 Assignment data to save:', assignmentData);

            const result = await ShiftAssignment.create(assignmentData);
            console.log('✅ Shift assignment created successfully!', result);
          } else if (isRemoving) {
            // Use soldier.uid if available (Firebase Auth ID), otherwise use the document ID
            const soldierIdToUse = soldier.uid || selectedSoldierId;

            // Delete the shift assignment for this soldier/date/shift
            console.log('🗑️ Removing shift assignment:', {
              soldier_id: soldierIdToUse,
              date: shiftDate,
              shift_type: shiftKey
            });

            const existingAssignments = await ShiftAssignment.filter({
              soldier_id: soldierIdToUse,
              date: shiftDate,
              shift_type: shiftKey
            });

            console.log('Found assignments to delete:', existingAssignments);

            for (const assignment of existingAssignments) {
              await ShiftAssignment.delete(assignment.id);
              console.log('✅ Shift assignment deleted:', assignment.id);
            }
          }

        } catch (e) {
          console.error('❌ Error auto-saving:', e);
          alert('שגיאה בשמירת השיבוץ. אנא נסה שוב.');
        }
      }, 1000);
    }
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
        weekStart: sub.weekStart
      };

      console.log('Normalized submission with days:', normalized);

      // Keep only the latest submission per user
      const existing = submissionsByUserId.get(sub.userId);
      if (!existing || normalized.updatedAt > existing.updatedAt) {
        submissionsByUserId.set(sub.userId, normalized);
      }
    });

    console.log('ScheduleManagement: Submissions by userId:', Array.from(submissionsByUserId.keys()));

    // Get all roster soldiers
    const allSoldiers = Object.values(users).filter(user => user.role === 'soldier' || user.role === 'user');
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
        <div className="flex h-[calc(100vh-4rem)] bg-gray-100" dir="rtl">
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
            <div className="flex-grow p-4 md:p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <Button
                        variant="outline"
                        onClick={() => navigate('/admin')}
                        className="flex items-center gap-2"
                    >
                        <Home className="w-4 h-4"/>
                        חזרה לדף הבית
                    </Button>

                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-8 h-8 text-blue-600"/>
                            <div className="text-center">
                                <h1 className="text-2xl md:text-3xl font-bold text-black">ניהול סידור עבודה</h1>
                                <p className="text-gray-600">שבוע מתאריך: {format(nextWeekStart, 'dd/MM/yyyy')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 items-center">
                        <Button variant="outline" onClick={autoAssign}><Sparkles className="w-4 h-4 ml-2"/>שיבוץ חכם</Button>
                        <Button variant="outline" onClick={handleSaveDraft} disabled={saving}><Save className="w-4 h-4 ml-2"/>שמור טיוטה</Button>
                        <Button onClick={handlePublishToSoldiers} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white"><Users className="w-4 h-4 ml-2"/>פרסם לחיילים</Button>
                    </div>
                </div>

                 <div className="flex-grow overflow-x-auto pb-4">
                    <ScheduleBoard
                        schedule={schedule}
                        users={users}
                        submissions={submissions}
                        soldierShiftCounts={soldierShiftCounts}
                        isPublished={isPublished}
                        onCancelShift={handleCancelShift}
                        onShiftClick={handleShiftClick}
                        isMobile={isMobile}
                        onShiftSlotClick={handleShiftSlotClick}
                        selectedSoldierId={selectedSoldierId}
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
    </>
  );
}



