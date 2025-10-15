import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { SoldierApiService } from '../../services/soldierApi';
import { useAuth } from '../../contexts/AuthContext';
import { toWeekStartISO } from '../../utils/weekKey';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function MyAssignments() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() =>
    addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7)
  );
  const [assignments, setAssignments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const weekStart = toWeekStartISO(selectedDate);

  // Load assignments
  const fetchAssignments = useCallback(async () => {
    if (!user?.uid) {
      console.log('⚠️ MyAssignments: No user.uid available, cannot fetch assignments');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 MyAssignments: Fetching assignments...');
      console.log('  - User UID (Auth ID):', user.uid);
      console.log('  - Week start:', weekStart);
      console.log('  - Full user object:', user);
      console.log('  - Query will look for: soldier_id =', user.uid);

      const [assignmentsData, statsData] = await Promise.all([
        SoldierApiService.getMyAssignments(user.uid, weekStart),
        SoldierApiService.getMyStats(user.uid, weekStart,
          format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd')
        )
      ]);

      setAssignments(assignmentsData);
      setStats(statsData);

      console.log('✅ MyAssignments: Query completed');
      console.log('  - Found assignments:', assignmentsData.length);
      console.log('  - Assignment details:', assignmentsData);

      if (assignmentsData.length === 0) {
        console.log('⚠️ No assignments found! Check:');
        console.log('  1. Does shift_assignments collection have documents?');
        console.log('  2. Do any documents have soldier_id =', user.uid, '?');
        console.log('  3. Are the dates in range', weekStart, 'to', format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd'), '?');
      }
    } catch (error) {
      console.error('❌ MyAssignments: Error fetching assignments:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [user, weekStart]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Debug helper - expose to window for console debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.debugMyAssignments = {
        userId: user?.uid,
        weekStart,
        assignments,
        stats,
        user: user,
        fetchAssignments: () => {
          console.log('🔧 Manual fetch triggered');
          fetchAssignments();
        },
        testQuery: async () => {
          console.log('🧪 Testing direct query to Firestore...');
          console.log('🔍 User ID:', user?.uid);
          console.log('🔍 Week Start:', weekStart);

          try {
            const result = await SoldierApiService.getMyAssignments(user?.uid, weekStart);
            console.log('✅ Query result:', result);
            return result;
          } catch (err) {
            console.error('❌ Query error:', err);
            return err;
          }
        }
      };
      console.log('🔧 Debug helper available: window.debugMyAssignments');
      console.log('🔧 Run window.debugMyAssignments.testQuery() to test the query');
    }
  }, [user, weekStart, assignments, stats, fetchAssignments]);

  // Navigate weeks
  const navigateWeek = (direction) => {
    setSelectedDate(prev => addDays(prev, direction * 7));
  };

  // Confirm assignment
  const handleConfirmAssignment = async (assignmentId) => {
    try {
      setActionLoading(prev => ({ ...prev, [assignmentId]: true }));
      
      await SoldierApiService.confirmAssignment(assignmentId);
      await fetchAssignments(); // Refresh
      
    } catch (error) {
      console.error('MyAssignments: Error confirming assignment:', error);
      setError(error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  // Request swap
  const handleRequestSwap = async (assignmentId) => {
    const reason = prompt('אנא הכנס סיבה לבקשת החלפה:');
    if (!reason) return;
    
    try {
      setActionLoading(prev => ({ ...prev, [assignmentId]: true }));
      
      await SoldierApiService.requestSwap(assignmentId, reason);
      await fetchAssignments(); // Refresh
      
      alert('בקשת החלפה נשלחה בהצלחה');
      
    } catch (error) {
      console.error('MyAssignments: Error requesting swap:', error);
      setError(error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'assigned':
        return <Badge variant="outline" className="bg-blue-50 text-blue-800 text-xs px-2 py-0.5">ממתין</Badge>;
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 text-xs px-2 py-0.5">אושר</Badge>;
      case 'swap_requested':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-800 text-xs px-2 py-0.5">החלפה</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5">הושלם</Badge>;
      default:
        return <Badge variant="outline" className="text-xs px-2 py-0.5">{status}</Badge>;
    }
  };

  // Group assignments by day
  const getAssignmentsByDay = () => {
    const byDay = {};
    
    WEEKDAYS.forEach(day => {
      const dayIndex = WEEKDAYS.indexOf(day);
      const targetDate = format(addDays(new Date(weekStart), dayIndex), 'yyyy-MM-dd');
      
      byDay[day] = assignments.filter(assignment => assignment.date === targetDate);
    });
    
    return byDay;
  };

  const assignmentsByDay = getAssignmentsByDay();

  if (loading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">טוען שיבוצי משמרות...</p>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-4 md:mb-6">
          {/* Title - Mobile Centered */}
          <div className="flex flex-col items-center justify-center mb-3 md:mb-4">

            <p className="text-sm md:text-base text-gray-600 text-center">
              שבוע {format(selectedDate, 'dd/MM/yyyy')} - {format(addDays(selectedDate, 6), 'dd/MM/yyyy')}
            </p>
          </div>

          {/* Navigation Buttons - Mobile Responsive */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek(-1)}
              className="px-2 md:px-4"
            >
              <ChevronRight className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">קודם</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7))}
              className="px-2 md:px-4 text-xs md:text-sm"
            >
              השבוע הבא
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek(1)}
              className="px-2 md:px-4"
            >
              <span className="hidden sm:inline mr-1">הבא</span>
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchAssignments}
              disabled={loading}
              className="px-2 md:px-3"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4">
            <Card className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">סה״כ משמרות</p>
                  <p className="text-xl md:text-2xl font-bold">{stats.total_shifts || 0}</p>
                </div>
                <Clock className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">אושרו</p>
                  <p className="text-xl md:text-2xl font-bold text-green-600">{stats.confirmed_shifts || 0}</p>
                </div>
                <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">ממתינים</p>
                  <p className="text-xl md:text-2xl font-bold text-yellow-600">{stats.pending_shifts || 0}</p>
                </div>
                <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
              </div>
            </Card>

            <Card className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">הושלמו</p>
                  <p className="text-xl md:text-2xl font-bold text-gray-600">{stats.completed_shifts || 0}</p>
                </div>
                <User className="w-6 h-6 md:w-8 md:h-8 text-gray-500" />
              </div>
            </Card>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* No assignments message */}
        {assignments.length === 0 && !loading && (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500 mb-2">אין משמרות לשבוע זה</h3>
              <p className="text-gray-400">נראה שעדיין לא שובצת למשמרות השבוע</p>
            </CardContent>
          </Card>
        )}

        {/* Weekly Calendar */}
        {assignments.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3 md:gap-4">
            {WEEKDAYS_HE.map((dayName, index) => {
              const day = WEEKDAYS[index];
              const dayAssignments = assignmentsByDay[day] || [];
              const dayDate = addDays(selectedDate, index);

              return (
                <Card key={day} className="h-fit">
                  <CardHeader className="pb-2 md:pb-3 pt-3 md:pt-4 px-3 md:px-4">
                    <CardTitle className="text-base md:text-lg text-center">
                      <div className="font-bold">{dayName}</div>
                      <div className="text-xs md:text-sm font-normal text-gray-500">
                        {format(dayDate, 'dd/MM')}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="space-y-2 p-2 md:p-3">
                    {dayAssignments.length > 0 ? (
                      dayAssignments.map(assignment => (
                        <div
                          key={assignment.id}
                          className={`p-2.5 md:p-3 rounded-lg border-r-4 ${
                            assignment.status === 'confirmed'
                              ? 'bg-green-50 border-green-500'
                              : assignment.status === 'assigned'
                              ? 'bg-blue-50 border-blue-500'
                              : 'bg-gray-50 border-gray-300'
                          }`}
                        >
                          <div className="space-y-1.5 md:space-y-2">
                            <div className="font-semibold text-xs md:text-sm text-gray-900 leading-tight">
                              {assignment.shift_name?.replace(/_/g, ' ') ||
                               assignment.shift_type?.replace(/_/g, ' ') ||
                               'משמרת'}
                            </div>

                            <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                              <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                              <span className="text-[11px] md:text-xs">
                                {assignment.start_time} - {assignment.end_time}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              {getStatusBadge(assignment.status)}

                              <div className="flex gap-1">
                                {assignment.status === 'assigned' && (
                                  <button
                                    onClick={() => handleConfirmAssignment(assignment.id)}
                                    disabled={actionLoading[assignment.id]}
                                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                                    title="אשר משמרת"
                                  >
                                    {actionLoading[assignment.id] ? '...' : '✓'}
                                  </button>
                                )}

                                {(assignment.status === 'assigned' || assignment.status === 'confirmed') && (
                                  <button
                                    onClick={() => handleRequestSwap(assignment.id)}
                                    disabled={actionLoading[assignment.id]}
                                    className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 transition-colors"
                                    title="בקש החלפה"
                                  >
                                    {actionLoading[assignment.id] ? '...' : '↻'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 md:py-8 text-gray-400">
                        <Clock className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-xs">אין משמרות</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Shift Type Breakdown */}
        {assignments.length > 0 && stats.shift_breakdown && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                פילוח משמרות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.shift_breakdown).map(([shiftType, count]) => (
                  <div key={shiftType} className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{count}</p>
                    <p className="text-sm text-gray-600">{shiftType}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assignments Table View */}
        {assignments.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                רשימת שיבוצים - תצוגת טבלה
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-right p-3 font-semibold text-gray-700">תאריך</th>
                      <th className="text-right p-3 font-semibold text-gray-700">יום</th>
                      <th className="text-right p-3 font-semibold text-gray-700">סוג משמרת</th>
                      <th className="text-right p-3 font-semibold text-gray-700">שעות</th>
                      <th className="text-right p-3 font-semibold text-gray-700">סטטוס</th>
                      <th className="text-right p-3 font-semibold text-gray-700">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assignment, index) => {
                      const assignmentDate = new Date(assignment.date);
                      const dayIndex = WEEKDAYS.indexOf(assignment.day_name);
                      const dayNameHe = dayIndex >= 0 ? WEEKDAYS_HE[dayIndex] : assignment.day_name;

                      return (
                        <tr
                          key={assignment.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          }`}
                        >
                          <td className="p-3 text-gray-900">
                            {format(assignmentDate, 'dd/MM/yyyy')}
                          </td>
                          <td className="p-3 text-gray-900 font-medium">
                            {dayNameHe}
                          </td>
                          <td className="p-3 text-gray-900">
                            {assignment.shift_name || assignment.shift_type}
                          </td>
                          <td className="p-3 text-gray-700">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span>{assignment.start_time} - {assignment.end_time}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            {getStatusBadge(assignment.status)}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              {assignment.status === 'assigned' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleConfirmAssignment(assignment.id)}
                                  disabled={actionLoading[assignment.id]}
                                  className="text-xs"
                                >
                                  {actionLoading[assignment.id] ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3 h-3 ml-1" />
                                      אשר
                                    </>
                                  )}
                                </Button>
                              )}

                              {(assignment.status === 'assigned' || assignment.status === 'confirmed') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRequestSwap(assignment.id)}
                                  disabled={actionLoading[assignment.id]}
                                  className="text-xs"
                                >
                                  {actionLoading[assignment.id] ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      <RefreshCw className="w-3 h-3 ml-1" />
                                      החלפה
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Summary */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600">
                <div>
                  <strong>סה״כ:</strong> {assignments.length} משמרות
                </div>
                <div className="flex gap-4">
                  <span><strong>ממתינים לאישור:</strong> {assignments.filter(a => a.status === 'assigned').length}</span>
                  <span><strong>אושרו:</strong> {assignments.filter(a => a.status === 'confirmed').length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}