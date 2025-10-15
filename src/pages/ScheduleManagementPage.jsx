import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { User } from '../entities/User';
import { ShiftSubmission } from '../entities/ShiftSubmission';
import { WeeklySchedule } from '../entities/WeeklySchedule';
import { format, addDays, startOfWeek } from 'date-fns';
import { toWeekStartISO } from '../utils/weekKey';
import { Calendar, Save, Send, Sparkles, PanelRightOpen, PanelRightClose, Undo, Eye } from 'lucide-react';
import { Button } from '../components/ui/button';
import ScheduleBoard from '../components/admin/schedule/ScheduleBoard';
import AvailableSoldiersPanel from '../components/admin/schedule/AvailableSoldiersPanel';
import AssignSoldierDialog from '../components/admin/schedule/AssignSoldierDialog';
import PreferencesPanel from '../components/admin/PreferencesPanel';
import { useMediaQuery } from '../components/hooks/useMediaQuery';
import { DAYS, SHIFT_NAMES, SHIFT_REQUIREMENTS } from '../config/shifts';
import { groupSubmissionsByUser } from '../utils/preferences';
import { db } from '../config/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';

export default function ScheduleManagementPage() {
  const [users, setUsers] = useState({});
  const [schedule, setSchedule] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [weeklyScheduleEntity, setWeeklyScheduleEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  
  // Preferences panel state
  const [isPreferencesPanelOpen, setIsPreferencesPanelOpen] = useState(false);
  const [rawSubmissions, setRawSubmissions] = useState([]);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  
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
        const loadedSchedule = schedules[0].schedule;
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
          }
        }

        setWeeklyScheduleEntity(schedules[0]);
        setSchedule(updatedSchedule);
      } else {
        setSchedule(initializeSchedule());
        setWeeklyScheduleEntity(null);
      }
    } catch (error) {
      console.error("Error loading schedule data:", error);
    }
    setLoading(false);
  }, [nextWeekStartStr, initializeSchedule]);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch shift submissions for Preferences Panel
  useEffect(() => {
    if (!isPreferencesPanelOpen) return;
    setPreferencesLoading(true);

    const fetchSubmissions = async () => {
      try {
        const q = query(
          collection(db, 'shift_submissions'),
          where('week_start', '==', nextWeekStartStr),
          orderBy('updated_at', 'desc')
        );
        const snapshot = await getDocs(q);
        const submissions = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            userName: d.userName,
            userId: d.user_id,
            days: d.days,
            shifts: d.shifts,
            updatedAt: d.updated_at?.toDate ? d.updated_at.toDate() : null,
            weekStart: d.week_start
          };
        });
        setRawSubmissions(submissions);
      } catch (error) {
        console.error('Error fetching submissions:', error);
      }
      setPreferencesLoading(false);
    };

    fetchSubmissions();
  }, [isPreferencesPanelOpen, nextWeekStartStr]);
  
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

  const onDragEnd = (result) => {
    if (isMobile) return;
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const soldierId = draggableId.split('|')[0];
    const currentCount = soldierShiftCounts[soldierId] || 0;
    if (currentCount >= 6) {
        if (!window.confirm(`החייל ${users[soldierId]?.hebrew_name} כבר משובץ ל-6 משמרות. האם אתה בטוח שברצונך להוסיף משמרת נוספת?`)) {
            return;
        }
    }
    setSchedule(prev => {
        const newSchedule = JSON.parse(JSON.stringify(prev));
        if (source.droppableId !== 'available') {
            const [day, shiftKey] = source.droppableId.split('|');
            if (newSchedule[day]?.[shiftKey]) {
                newSchedule[day][shiftKey].soldiers = newSchedule[day][shiftKey].soldiers.filter((id) => id !== soldierId);
            }
        }
        if (destination.droppableId !== 'available') {
            const [day, shiftKey] = destination.droppableId.split('|');
            if (newSchedule[day]?.[shiftKey]) {
                if (!newSchedule[day][shiftKey].soldiers.includes(soldierId)) {
                    newSchedule[day][shiftKey].soldiers.push(soldierId);
                }
            }
        }
        return newSchedule;
    });
  };
  
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
        if (weeklyScheduleEntity) {
            await WeeklySchedule.update(weeklyScheduleEntity.id, { schedule });
        } else {
            const newEntity = await WeeklySchedule.create({ week_start: nextWeekStartStr, schedule: schedule, is_published: false });
            setWeeklyScheduleEntity(newEntity);
        }
        alert("טיוטה נשמרה בהצלחה");
    } catch (e) {
        console.error("Error saving draft:", e);
        alert("שגיאה בשמירת הטיוטה");
    }
    setSaving(false);
  };
  
  const handlePublish = async () => {
    if (!window.confirm("האם אתה בטוח שברצונך לפרסם את הסידור? לא ניתן יהיה לערוך אותו לאחר מכן.")) return;
    setSaving(true);
    try {
      const dataToSave = { schedule, is_published: true, published_date: new Date().toISOString() };
      if (weeklyScheduleEntity) {
        await WeeklySchedule.update(weeklyScheduleEntity.id, dataToSave);
      } else {
        const newEntity = await WeeklySchedule.create({ week_start: nextWeekStartStr, ...dataToSave });
        setWeeklyScheduleEntity(newEntity);
      }
      alert("הסידור פורסם בהצלחה!");
      loadData();
    } catch (e) {
      console.error("Error publishing schedule:", e);
      alert("שגיאה בפרסום הסידור");
    }
    setSaving(false);
  };

  const handleUnpublish = async () => {
    if (!window.confirm("האם אתה בטוח שברצונך לבטל את פרסום הסידור? הסידור יחזור למצב טיוטה.")) return;
    setSaving(true);
    try {
      if (weeklyScheduleEntity) {
        await WeeklySchedule.update(weeklyScheduleEntity.id, { is_published: false });
        alert("הפרסום בוטל והסידור חזר למצב טיוטה.");
        loadData();
      }
    } catch(e) {
      console.error("Error un-publishing schedule:", e);
      alert("שגיאה בביטול הפרסום.");
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

  // Handle preferences panel
  const handleViewPreferences = () => {
    setIsPreferencesPanelOpen(true);
  };

  const normalizedSubmissions = useMemo(() => {
    // First normalize the raw submissions to have consistent field names
    const normalizedRaw = rawSubmissions.map(sub => {
      console.log('Raw submission:', sub);
      
      // Convert the Firestore data structure to the expected format
      const normalizedDays = {};
      
      // Initialize all days
      ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].forEach(day => {
        normalizedDays[day] = [];
      });

      // Process each day's data
      Object.entries(sub).forEach(([key, value]) => {
        if (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(key)) {
          if (typeof value === 'object') {
            // Get all true shifts for this day
            const shifts = Object.entries(value)
              .filter(([_, isSelected]) => isSelected === true)
              .map(([shiftName]) => shiftName);
            normalizedDays[key] = shifts;
          }
        }
      });

      console.log('Normalized days:', normalizedDays);

      const normalized = {
        id: sub.id,
        userId: sub.user_id || sub.uid || sub.userId,
        uid: sub.user_id || sub.uid || sub.userId,
        userName: sub.userName || sub.name || 'ללא שם',
        updatedAt: sub.updated_at?.toDate?.() || sub.updatedAt || new Date(),
        days: normalizedDays,
        weekStart: sub.week_start || sub.weekStart
      };

      console.log('Normalized submission:', normalized);
      return normalized;
    });
    
    // Group by latest submission per user
    const submissionsMap = groupSubmissionsByUser(normalizedRaw);
    
    // Create map of submissions by UID for O(1) lookup
    const submissionsByUid = new Map(submissionsMap.map(sub => [sub.userId, sub]));
    
    console.log('ScheduleManagement: Normalized submissions:', normalizedRaw);
    console.log('ScheduleManagement: Submissions by UID:', Array.from(submissionsByUid.keys()));
    
    // Get all roster soldiers 
    const allSoldiers = Object.values(users).filter(user => user.role === 'soldier' || user.role === 'user');
    
    // Join roster with submissions
    const submitted = [];
    const notSubmitted = [];
    
    allSoldiers.forEach(soldier => {
      const submission = submissionsByUid.get(soldier.id);
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
  
  const assignedSoldierIds = new Set(Object.values(schedule).flatMap((day) => Object.values(day).flatMap((shift) => shift.soldiers || [])));
  const availableSoldiers = Object.values(users).filter((u) => u.is_active);
  
  console.log('ScheduleManagement: Available soldiers:', availableSoldiers);
  console.log('ScheduleManagement: Users:', users);
  console.log('ScheduleManagement: Panel open:', isPanelOpen);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex h-[calc(100vh-4rem)] bg-gray-100" dir="rtl">
            <div className="flex-grow p-4 md:p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-blue-600"/>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold">ניהול סידור עבודה</h1>
                            <p className="text-gray-600">שבוע מתאריך: {format(nextWeekStart, 'dd/MM/yyyy')}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Button 
                            variant="outline" 
                            onClick={handleViewPreferences}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                            <Eye className="w-4 h-4 ml-2"/>
                            צפה בהעדפות
                        </Button>
                        {isPublished ? (
                            <Button variant="destructive" onClick={handleUnpublish} disabled={saving}>
                                <Undo className="w-4 h-4 ml-2"/> בטל פרסום
                            </Button>
                        ) : (
                            <>
                               <Button variant="outline" onClick={autoAssign}><Sparkles className="w-4 h-4 ml-2"/>שיבוץ חכם</Button>
                               <Button variant="outline" onClick={handleSaveDraft} disabled={saving}><Save className="w-4 h-4 ml-2"/>שמור טיוטה</Button>
                               <Button onClick={handlePublish} disabled={saving} className="bg-green-600 hover:bg-green-700"><Send className="w-4 h-4 ml-2"/>פרסם סידור</Button>
                            </>
                        )}
                        <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={() => setIsPanelOpen(!isPanelOpen)}>
                            {isPanelOpen ? <PanelRightClose /> : <PanelRightOpen />}
                        </Button>
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
                        onDragEnd={onDragEnd}
                        isMobile={isMobile}
                    />
                 </div>
            </div>
            {/* Soldiers Panel - Always show when not published */}
            {!isPublished && (
                <div className="w-80 bg-white border-l border-gray-200 h-full flex-shrink-0">
                    <AvailableSoldiersPanel 
                        soldiers={availableSoldiers} 
                        users={users} 
                        assignedSoldierIds={assignedSoldierIds}
                        soldierShiftCounts={soldierShiftCounts}
                        submissions={submissions}
                        day=""
                        shift=""
                        isOpen={true}
                        onToggle={() => setIsPanelOpen(!isPanelOpen)}
                    />
                </div>
            )}
        </div>
        
        <AssignSoldierDialog
            isOpen={!!dialogShift}
            onClose={() => setDialogShift(null)}
            shiftInfo={dialogShift}
            allSoldiers={availableSoldiers}
            assignedSoldiers={dialogShift ? schedule[dialogShift.day][dialogShift.shiftKey].soldiers : []}
            onToggleAssign={handleToggleAssign}
        />
        
        <PreferencesPanel
            isOpen={isPreferencesPanelOpen}
            onClose={() => setIsPreferencesPanelOpen(false)}
            submissions={normalizedSubmissions}
            weekStart={nextWeekStartStr}
            loading={preferencesLoading}
        />
    </DragDropContext>
  );
}



