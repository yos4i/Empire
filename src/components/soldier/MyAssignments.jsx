import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import {
  Calendar,
  Clock,
  Clock3,
  User,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeftRight,
  X
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { SoldierApiService } from '../../services/soldierApi';
import { useAuth } from '../../contexts/AuthContext';
import { toWeekStartISO, getDefaultWeekStart } from '../../utils/weekKey';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function MyAssignments() {
  const { user } = useAuth();
  // Auto-switch to next week on Fridays
  const [selectedDate, setSelectedDate] = useState(() => getDefaultWeekStart());
  const [assignments, setAssignments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  // Exchange dialog state
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [exchangeReason, setExchangeReason] = useState('');

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

  // Open exchange dialog
  const openExchangeDialog = (assignment) => {
    setSelectedAssignment(assignment);
    setExchangeReason('');
    setExchangeDialogOpen(true);
  };

  // Close exchange dialog
  const closeExchangeDialog = () => {
    setExchangeDialogOpen(false);
    setSelectedAssignment(null);
    setExchangeReason('');
  };

  // Submit exchange request
  const handleSubmitExchange = async () => {
    if (!exchangeReason.trim()) {
      alert('אנא הזן סיבה לבקשת החלפה');
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [selectedAssignment.id]: true }));

      await SoldierApiService.requestSwap(selectedAssignment.id, exchangeReason);
      await fetchAssignments(); // Refresh

      closeExchangeDialog();
      alert('בקשת החלפה נשלחה בהצלחה');

    } catch (error) {
      console.error('MyAssignments: Error requesting swap:', error);
      setError(error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [selectedAssignment.id]: false }));
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'assigned':
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 text-xs px-2 py-0.5">משובץ</Badge>;
      case 'swap_requested':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-800 text-xs px-2 py-0.5">בקשת החלפה</Badge>;
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
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-4 md:mb-6">
          {/* Week Display - Centered */}
          <div className="flex flex-col items-center justify-center mb-4">
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
              onClick={() => setSelectedDate(getDefaultWeekStart())}
              className="px-2 md:px-4 text-xs md:text-sm"
            >
              שבוע ברירת מחדל
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-4 max-w-3xl mx-auto">
            <Card className="p-4 md:p-5">
              <div className="flex flex-col items-center text-center gap-2">
                <Clock className="w-8 h-8 md:w-10 md:h-10 text-blue-500" />
                <div>
                  <p className="text-xs md:text-sm text-gray-600 mb-1">סה״כ משמרות</p>
                  <p className="text-2xl md:text-3xl font-bold text-blue-600">{stats.total_shifts || 0}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 md:p-5">
              <div className="flex flex-col items-center text-center gap-2">
                <ArrowLeftRight className="w-8 h-8 md:w-10 md:h-10 text-orange-500" />
                <div>
                  <p className="text-xs md:text-sm text-gray-600 mb-1">בקשות החלפה</p>
                  <p className="text-2xl md:text-3xl font-bold text-orange-600">{assignments.filter(a => a.status === 'swap_requested').length}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 md:p-5 sm:col-span-2 md:col-span-1">
              <div className="flex flex-col items-center text-center gap-2">
                <User className="w-8 h-8 md:w-10 md:h-10 text-green-500" />
                <div>
                  <p className="text-xs md:text-sm text-gray-600 mb-1">הושלמו</p>
                  <p className="text-2xl md:text-3xl font-bold text-green-600">{stats.completed_shifts || 0}</p>
                </div>
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
                            assignment.isLongShift
                              ? 'bg-amber-50 border-amber-500'
                              : assignment.status === 'confirmed'
                              ? 'bg-green-50 border-green-500'
                              : assignment.status === 'assigned'
                              ? 'bg-blue-50 border-blue-500'
                              : 'bg-gray-50 border-gray-300'
                          }`}
                        >
                          <div className="space-y-1.5 md:space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold text-xs md:text-sm text-gray-900 leading-tight">
                                {assignment.shift_name?.replace(/_/g, ' ') ||
                                 assignment.shift_type?.replace(/_/g, ' ') ||
                                 'משמרת'}
                              </div>
                              {assignment.isLongShift && (
                                <Badge className="bg-amber-100 text-amber-800 text-[10px] md:text-xs px-1.5 py-0.5 flex items-center gap-1">
                                  <Clock3 className="w-3 h-3" />
                                  עד 15:30
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                              <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                              <span className="text-[11px] md:text-xs">
                                {assignment.start_time} - {assignment.isLongShift ? '15:30' : assignment.end_time}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              {getStatusBadge(assignment.status)}

                              {assignment.status !== 'swap_requested' && assignment.status !== 'completed' && (
                                <button
                                  onClick={() => openExchangeDialog(assignment)}
                                  disabled={actionLoading[assignment.id]}
                                  className="px-2.5 py-1.5 text-xs bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                  title="בקש החלפה"
                                >
                                  <ArrowLeftRight className="w-3 h-3" />
                                  <span className="hidden sm:inline">החלפה</span>
                                </button>
                              )}
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
                    <p className="text-sm text-gray-600">{shiftType.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Exchange Request Dialog */}
        {exchangeDialogOpen && selectedAssignment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={closeExchangeDialog}>
            <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowLeftRight className="w-5 h-5 text-orange-600" />
                    בקשת החלפת משמרת
                  </CardTitle>
                  <button
                    onClick={closeExchangeDialog}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Assignment Details */}
                <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-gray-700">משמרת:</span>
                    <span className="text-sm text-gray-900 text-left">
                      {selectedAssignment.shift_name?.replace(/_/g, ' ') || selectedAssignment.shift_type?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-gray-700">תאריך:</span>
                    <span className="text-sm text-gray-900">
                      {format(new Date(selectedAssignment.date), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-gray-700">שעות:</span>
                    <span className="text-sm text-gray-900">
                      {selectedAssignment.start_time} - {selectedAssignment.end_time}
                    </span>
                  </div>
                </div>

                {/* Reason Input */}
                <div className="space-y-2">
                  <Label htmlFor="exchange-reason" className="text-sm font-semibold">
                    סיבת בקשת ההחלפה <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="exchange-reason"
                    value={exchangeReason}
                    onChange={(e) => setExchangeReason(e.target.value)}
                    placeholder="אנא הסבר מדוע אתה מבקש להחליף משמרת זו..."
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500">
                    הסיבה תועבר למנהל לעיון ואישור
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSubmitExchange}
                    disabled={!exchangeReason.trim() || actionLoading[selectedAssignment.id]}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    {actionLoading[selectedAssignment.id] ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        שולח...
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="w-4 h-4 ml-2" />
                        שלח בקשה
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={closeExchangeDialog}
                    variant="outline"
                    disabled={actionLoading[selectedAssignment.id]}
                  >
                    ביטול
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}