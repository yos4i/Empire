import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { Calendar, User, Clock3, ChevronLeft, ChevronRight, Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { WeeklySchedule } from '../../entities/WeeklySchedule';
import { User as UserEntity } from '../../entities/User';
import { ShiftAssignment } from '../../entities/ShiftAssignment';
import { toWeekStartISO } from '../../utils/weekKey';
import { DAYS, SHIFT_NAMES, SHIFT_TYPES_HE } from '../../config/shifts';

const DAYS_HE = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי'
};

export default function WeeklyScheduleView({ soldierMission }) {
  const [selectedDate, setSelectedDate] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [schedule, setSchedule] = useState(null);
  const [users, setUsers] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState({});
  const [expandedCells, setExpandedCells] = useState({});

  const weekStart = toWeekStartISO(selectedDate);

  // Debug: Log the soldier's mission
  console.log('🔍 WeeklyScheduleView - soldierMission prop received:', soldierMission);

  // If soldierMission is undefined or null, log a warning
  if (!soldierMission) {
    console.warn('⚠️ WeeklyScheduleView - No soldierMission provided! All shifts will be shown. User needs to set their mission in Personal Details or re-login.');
  }

  useEffect(() => {
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      // Load the weekly schedule
      const weeklySchedule = await WeeklySchedule.getWeek(weekStart);

      // Load users to show soldier names
      const allUsers = await UserEntity.list();
      const usersMap = allUsers.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});

      // Load shift assignments to check for long shifts
      const weekEndDate = format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd');
      const shiftAssignments = await ShiftAssignment.filter({
        start_date: weekStart,
        end_date: weekEndDate
      });

      setSchedule(weeklySchedule?.schedule || null);
      setUsers(usersMap);
      setAssignments(shiftAssignments);
    } catch (error) {
      console.error('Error loading weekly schedule:', error);
    }
    setLoading(false);
  };

  const navigateWeek = (direction) => {
    setSelectedDate(prev => addDays(prev, direction * 7));
  };

  const toggleDayExpansion = (day) => {
    setExpandedDays(prev => ({
      ...prev,
      [day]: !prev[day]
    }));
  };

  const toggleCellExpansion = (day, shiftKey) => {
    const cellId = `${day}-${shiftKey}`;
    setExpandedCells(prev => ({
      ...prev,
      [cellId]: !prev[cellId]
    }));
  };

  const getShiftStatusColor = (shift) => {
    if (!shift || shift.cancelled) return 'bg-gray-100 border-gray-300';

    const assigned = shift.soldiers?.length || 0;
    const required = shift.required || 0;

    if (assigned === 0) return 'bg-red-50 border-red-200';
    if (assigned < required) return 'bg-yellow-50 border-yellow-200';
    if (assigned === required) return 'bg-green-50 border-green-200';
    return 'bg-blue-50 border-blue-200';
  };

  // Helper to check if a soldier has a long shift assignment
  const isLongShift = (soldierId, shiftKey, day) => {
    const soldier = users[soldierId];
    if (!soldier) {
      console.log('⚠️ isLongShift: Soldier not found for ID:', soldierId);
      return false;
    }

    const dayDate = format(addDays(new Date(weekStart), DAYS.indexOf(day)), 'yyyy-MM-dd');

    // Try to find assignment by both soldier UID and Firestore ID
    const assignment = assignments.find(a =>
      (a.soldier_id === soldier.uid || a.soldier_id === soldierId) &&
      a.shift_type === shiftKey &&
      a.date === dayDate
    );

    console.log(`🔍 isLongShift check for ${soldier.hebrew_name}:`, {
      soldierId,
      soldierUid: soldier.uid,
      day,
      shiftKey,
      dayDate,
      foundAssignment: !!assignment,
      isLongShift: assignment?.isLongShift,
      totalAssignments: assignments.length
    });

    return assignment?.isLongShift || false;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">טוען סידור שבועי...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with week navigation - Always visible */}
      <Card>
        <CardHeader className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center justify-center sm:justify-start gap-2 text-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
              הסידור השבועי
            </CardTitle>
            <div className="flex items-center gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek(-1)}
                className="h-9 w-9 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap px-2">
                {format(selectedDate, 'dd/MM/yyyy')} - {format(addDays(selectedDate, 6), 'dd/MM/yyyy')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek(1)}
                className="h-9 w-9 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* No mission assigned message */}
      {!soldierMission ? (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="text-yellow-900 font-semibold">אין אפשרות לצפות בסידור כרגע</AlertTitle>
          <AlertDescription className="text-yellow-800">
            <p className="mb-2">המשימה שלך טרם הוגדרה על ידי המנהל.</p>
            <p>נא לפנות למנהל המערכת כדי שיקצה אותך למשימה (גבולות או קריית חינוך).</p>
            <p className="mt-3 text-sm">לאחר שהמשימה תוגדר, תוכל לצפות בסידור השבועי שלך.</p>
          </AlertDescription>
        </Alert>
      ) : !schedule ? (
        /* No schedule message */
        <Card>
          <CardContent className="text-center py-8">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">הסידור לשבוע זה עדיין לא פורסם</p>
            <p className="text-sm text-gray-500 mt-2">
              נסה לנווט לשבוע אחר באמצעות החיצים למעלה
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Schedule Grid - Only show if schedule exists AND soldier has a mission */}
      {soldierMission && schedule && (
        <>
          {/* Desktop Table View - Hidden on mobile */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-[1000px]">
                  {/* Header Row - Days */}
                  <div className="grid gap-2 p-4 bg-gray-50 border-b sticky top-0 z-10" style={{ gridTemplateColumns: '150px repeat(6, 1fr)' }}>
                    <div className="font-semibold text-center text-gray-700">סוג משמרת</div>
                    {DAYS.map(day => (
                      <div key={day} className="font-semibold text-center text-gray-700">
                        {DAYS_HE[day]}
                      </div>
                    ))}
                  </div>

                  {/* Schedule Rows - Each shift type */}
                  {Object.keys(SHIFT_NAMES).filter(shiftKey => {
                    // Filter by soldier's mission
                    console.log('🔍 WeeklyScheduleView - Checking shift:', shiftKey, 'soldierMission:', soldierMission);
                    if (soldierMission) {
                      if (soldierMission === 'קריית_חינוך' && !shiftKey.includes('קריית_חינוך')) {
                        console.log('❌ WeeklyScheduleView - Skipping', shiftKey, '(not קריית_חינוך)');
                        return false; // Skip non-kiryat shifts
                      }
                      if (soldierMission === 'גבולות' && !shiftKey.includes('גבולות')) {
                        console.log('❌ WeeklyScheduleView - Skipping', shiftKey, '(not גבולות)');
                        return false; // Skip non-borders shifts
                      }
                    }
                    console.log('✅ WeeklyScheduleView - Including shift:', shiftKey);
                    return true;
                  }).map(shiftKey => (
                  <div key={shiftKey} className="grid gap-2 p-4 border-b" style={{ gridTemplateColumns: '150px repeat(6, 1fr)' }}>
                    {/* Shift Type Header */}
                    <div className="flex items-center justify-center bg-purple-50 rounded-lg p-3">
                      <div className="text-center">
                        <span className="font-medium text-purple-900 block text-sm">
                          {(SHIFT_TYPES_HE[shiftKey]?.name || shiftKey).replace('ק.חינוך ', '').replace('חינוך_', '')}
                        </span>
                      </div>
                    </div>

                    {/* Day Cells */}
                    {DAYS.map(day => {
                      const shift = schedule[day]?.[shiftKey];

                      if (!shift) {
                        return (
                          <div key={`${day}-${shiftKey}`} className="min-h-[120px] bg-gray-100 rounded-lg flex items-center justify-center">
                            <span className="text-gray-400 text-sm">לא זמין</span>
                          </div>
                        );
                      }

                      const assigned = shift.soldiers?.length || 0;
                      const required = shift.required || 0;
                      const cellId = `${day}-${shiftKey}`;
                      const isExpanded = expandedCells[cellId];

                      // Get custom hours if available
                      let timeString = '';
                      if (shift.customStartTime && shift.customEndTime) {
                        timeString = `${shift.customStartTime}-${shift.customEndTime}`;
                      } else {
                        // Extract default times from shift name
                        const shiftDisplayName = SHIFT_NAMES[shiftKey] || '';
                        const timeMatch = shiftDisplayName.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
                        timeString = timeMatch ? `${timeMatch[1]}-${timeMatch[2]}` : '';
                      }

                      return (
                        <div
                          key={`${day}-${shiftKey}`}
                          className={`
                            min-h-[120px] p-2 rounded-lg border-2
                            ${getShiftStatusColor(shift)}
                            ${shift.cancelled ? 'opacity-50' : ''}
                          `}
                        >
                          {/* Shift Header */}
                          <div className="flex flex-col gap-1 mb-2">
                            {timeString && (
                              <div className="text-xs font-semibold text-gray-700 text-center">
                                {timeString}
                              </div>
                            )}
                            <div className="flex items-center justify-center">
                              <Badge
                                className={`text-xs ${
                                  assigned === 0 ? 'bg-red-100 text-red-800' :
                                  assigned < required ? 'bg-yellow-100 text-yellow-800' :
                                  assigned === required ? 'bg-green-100 text-green-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {assigned}/{required}
                              </Badge>
                            </div>
                          </div>

                          {/* Cancelled Notice */}
                          {shift.cancelled && (
                            <div className="bg-gray-200 text-gray-600 text-center py-2 rounded text-xs mb-2">
                              מבוטלת
                            </div>
                          )}

                          {/* Assigned Soldiers */}
                          <div className="space-y-1">
                            {(isExpanded ? shift.soldiers : shift.soldiers?.slice(0, 3))?.map((soldierId, index) => {
                              const soldier = users[soldierId];
                              if (!soldier) return null;

                              const hasLongShift = isLongShift(soldierId, shiftKey, day);

                              return (
                                <div
                                  key={`${soldierId}-${index}`}
                                  className={`p-1.5 rounded border text-xs flex items-center justify-between gap-1 ${hasLongShift ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}
                                >
                                  <div className="flex items-center gap-1 flex-1 min-w-0">
                                    <User className="w-3 h-3 text-gray-500 flex-shrink-0" />
                                    <span className="font-medium text-gray-900 truncate">
                                      {soldier.hebrew_name || soldier.displayName}
                                    </span>
                                  </div>
                                  {hasLongShift && (
                                    <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1 py-0 flex items-center gap-0.5">
                                      <Clock3 className="w-2.5 h-2.5" />
                                      15:30
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                            {shift.soldiers?.length > 3 && (
                              <button
                                onClick={() => toggleCellExpansion(day, shiftKey)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium text-center w-full py-1 hover:bg-blue-50 rounded transition-colors"
                              >
                                {isExpanded ? 'הצג פחות' : `+${shift.soldiers.length - 3} נוספים`}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Card View - Visible only on mobile/tablet */}
          <div className="lg:hidden space-y-3">
            {DAYS.map(day => {
              const dayShifts = Object.keys(SHIFT_NAMES).filter(shiftKey => {
                // Filter by soldier's mission
                if (soldierMission) {
                  if (soldierMission === 'קריית_חינוך' && !shiftKey.includes('קריית_חינוך')) {
                    return false;
                  }
                  if (soldierMission === 'גבולות' && !shiftKey.includes('גבולות')) {
                    return false;
                  }
                }
                return schedule[day]?.[shiftKey]; // Only show days with shifts
              });

              if (dayShifts.length === 0) return null;

              const isExpanded = expandedDays[day];

              return (
                <Card key={day}>
                  <CardHeader
                    className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleDayExpansion(day)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold text-gray-800">
                        {DAYS_HE[day]}
                      </CardTitle>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="space-y-3 pt-0">
                    {dayShifts.map(shiftKey => {
                      const shift = schedule[day][shiftKey];
                      const assigned = shift.soldiers?.length || 0;
                      const required = shift.required || 0;

                      // Get custom hours if available
                      let timeString = '';
                      if (shift.customStartTime && shift.customEndTime) {
                        timeString = `${shift.customStartTime}-${shift.customEndTime}`;
                      } else {
                        const shiftDisplayName = SHIFT_NAMES[shiftKey] || '';
                        const timeMatch = shiftDisplayName.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
                        timeString = timeMatch ? `${timeMatch[1]}-${timeMatch[2]}` : '';
                      }

                      return (
                        <div
                          key={shiftKey}
                          className={`
                            p-3 rounded-lg border-2
                            ${getShiftStatusColor(shift)}
                            ${shift.cancelled ? 'opacity-50' : ''}
                          `}
                        >
                          {/* Shift Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-sm text-gray-900">
                                {(SHIFT_TYPES_HE[shiftKey]?.name || shiftKey).replace('ק.חינוך ', '').replace('חינוך_', '')}
                              </span>
                              {timeString && (
                                <span className="text-xs text-gray-600">
                                  {timeString}
                                </span>
                              )}
                            </div>
                            <Badge
                              className={`text-sm ${
                                assigned === 0 ? 'bg-red-100 text-red-800' :
                                assigned < required ? 'bg-yellow-100 text-yellow-800' :
                                assigned === required ? 'bg-green-100 text-green-800' :
                                'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {assigned}/{required}
                            </Badge>
                          </div>

                          {/* Cancelled Notice */}
                          {shift.cancelled && (
                            <div className="bg-gray-200 text-gray-600 text-center py-2 rounded text-sm mb-3">
                              מבוטלת
                            </div>
                          )}

                          {/* Assigned Soldiers */}
                          {shift.soldiers && shift.soldiers.length > 0 ? (
                            <div className="space-y-2">
                              {[...shift.soldiers]
                                .sort((a, b) => {
                                  const soldierA = users[a];
                                  const soldierB = users[b];

                                  if (!soldierA || !soldierB) return 0;

                                  const nameA = soldierA.hebrew_name || soldierA.displayName || '';
                                  const nameB = soldierB.hebrew_name || soldierB.displayName || '';

                                  // Priority names to appear at top
                                  const isPriorityA = nameA === 'עידן איזיקסון' || nameA === 'שלומי ממן';
                                  const isPriorityB = nameB === 'עידן איזיקסון' || nameB === 'שלומי ממן';

                                  // Long shift status
                                  const hasLongShiftA = isLongShift(a, shiftKey, day);
                                  const hasLongShiftB = isLongShift(b, shiftKey, day);

                                  // Priority users first
                                  if (isPriorityA && !isPriorityB) return -1;
                                  if (!isPriorityA && isPriorityB) return 1;

                                  // Long shifts last (only among non-priority)
                                  if (!isPriorityA && !isPriorityB) {
                                    if (!hasLongShiftA && hasLongShiftB) return -1;
                                    if (hasLongShiftA && !hasLongShiftB) return 1;
                                  }

                                  // Otherwise maintain original order
                                  return 0;
                                })
                                .map((soldierId, index) => {
                                const soldier = users[soldierId];
                                if (!soldier) return null;

                                const hasLongShift = isLongShift(soldierId, shiftKey, day);

                                return (
                                  <div
                                    key={`${soldierId}-${index}`}
                                    className={`p-2 rounded border text-sm flex items-center justify-between gap-2 ${hasLongShift ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                      <span className="font-medium text-gray-900">
                                        {soldier.hebrew_name || soldier.displayName}
                                      </span>
                                    </div>
                                    {hasLongShift && (
                                      <Badge className="bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 flex items-center gap-1">
                                        <Clock3 className="w-3 h-3" />
                                        עד 15:30
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center text-sm text-gray-500 py-2">
                              אין חיילים משובצים
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}
