import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { Calendar, User, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { WeeklySchedule } from '../../entities/WeeklySchedule';
import { User as UserEntity } from '../../entities/User';
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

export default function WeeklyScheduleView() {
  const [selectedDate, setSelectedDate] = useState(() =>
    addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7)
  );
  const [schedule, setSchedule] = useState(null);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);

  const weekStart = toWeekStartISO(selectedDate);

  useEffect(() => {
    loadSchedule();
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

      setSchedule(weeklySchedule?.schedule || null);
      setUsers(usersMap);
    } catch (error) {
      console.error('Error loading weekly schedule:', error);
    }
    setLoading(false);
  };

  const navigateWeek = (direction) => {
    setSelectedDate(prev => addDays(prev, direction * 7));
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              הסידור השבועי
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek(-1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-600 min-w-[200px] text-center">
                {format(selectedDate, 'dd/MM/yyyy')} - {format(addDays(selectedDate, 6), 'dd/MM/yyyy')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek(1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* No schedule message */}
      {!schedule && (
        <Card>
          <CardContent className="text-center py-8">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">הסידור לשבוע זה עדיין לא פורסם</p>
            <p className="text-sm text-gray-500 mt-2">
              נסה לנווט לשבוע אחר באמצעות החיצים למעלה
            </p>
          </CardContent>
        </Card>
      )}

      {/* Schedule Grid - Only show if schedule exists */}
      {schedule && (
        <Card>
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
                {Object.keys(SHIFT_NAMES).map(shiftKey => (
                <div key={shiftKey} className="grid gap-2 p-4 border-b" style={{ gridTemplateColumns: '150px repeat(6, 1fr)' }}>
                  {/* Shift Type Header */}
                  <div className="flex items-center justify-center bg-purple-50 rounded-lg p-3">
                    <div className="text-center">
                      <span className="font-medium text-purple-900 block text-sm">
                        {SHIFT_TYPES_HE[shiftKey]?.name || shiftKey}
                      </span>
                      <span className="text-xs text-purple-600">
                        {SHIFT_NAMES[shiftKey]?.split('(')[1]?.replace(')', '') || ''}
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
                        <div className="flex items-center justify-between mb-2">
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

                        {/* Cancelled Notice */}
                        {shift.cancelled && (
                          <div className="bg-gray-200 text-gray-600 text-center py-2 rounded text-xs mb-2">
                            מבוטלת
                          </div>
                        )}

                        {/* Assigned Soldiers */}
                        <div className="space-y-1">
                          {shift.soldiers?.slice(0, 3).map((soldierId, index) => {
                            const soldier = users[soldierId];
                            if (!soldier) return null;

                            return (
                              <div
                                key={`${soldierId}-${index}`}
                                className="p-1.5 bg-white rounded border text-xs flex items-center gap-1"
                              >
                                <User className="w-3 h-3 text-gray-500 flex-shrink-0" />
                                <span className="font-medium text-gray-900 truncate">
                                  {soldier.hebrew_name || soldier.displayName}
                                </span>
                              </div>
                            );
                          })}
                          {shift.soldiers?.length > 3 && (
                            <div className="text-xs text-gray-500 text-center">
                              +{shift.soldiers.length - 3} נוספים
                            </div>
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
      )}

      {/* Summary - Only show if schedule exists */}
      {schedule && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">סיכום סידור</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.keys(SHIFT_NAMES).map(shiftKey => {
              const totalAssigned = DAYS.reduce((sum, day) =>
                sum + (schedule[day]?.[shiftKey]?.soldiers?.length || 0), 0
              );
              const totalRequired = DAYS.reduce((sum, day) =>
                sum + (schedule[day]?.[shiftKey]?.required || 0), 0
              );

              return (
                <div key={shiftKey} className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">
                    {SHIFT_TYPES_HE[shiftKey]?.name || shiftKey}
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>משובצים:</span>
                      <span className={totalAssigned >= totalRequired ? 'text-green-600' : 'text-red-600'}>
                        {totalAssigned}/{totalRequired}
                      </span>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
