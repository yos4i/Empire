import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { 
  Calendar, 
  Clock, 
  MapPin, 
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

  // Debug helper - expose to window for console debugging
  React.useEffect(() => {
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
  }, [user?.uid, weekStart, assignments, stats, fetchAssignments]);

  // Load assignments
  const fetchAssignments = useCallback(async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 MyAssignments: Fetching assignments for soldier:', user.uid, 'week:', weekStart);
      console.log('🔍 MyAssignments: User object:', user);

      const [assignmentsData, statsData] = await Promise.all([
        SoldierApiService.getMyAssignments(user.uid, weekStart),
        SoldierApiService.getMyStats(user.uid, weekStart,
          format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd')
        )
      ]);

      setAssignments(assignmentsData);
      setStats(statsData);

      console.log('✅ MyAssignments: Loaded', assignmentsData.length, 'assignments');
      console.log('📋 MyAssignments: Assignment details:', assignmentsData);
    } catch (error) {
      console.error('MyAssignments: Error fetching assignments:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, weekStart]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

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
        return <Badge variant="outline" className="bg-blue-50 text-blue-800">ממתין לאישור</Badge>;
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800">אושר</Badge>;
      case 'swap_requested':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-800">בקשת החלפה</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800">הושלם</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">המשמרות שלי</h1>
                <p className="text-gray-600">
                  שבוע {format(selectedDate, 'dd/MM/yyyy')} - {format(addDays(selectedDate, 6), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navigateWeek(-1)}
              >
                <ChevronRight className="w-4 h-4" />
                שבוע קודם
              </Button>
              
              <Button
                variant="outline" 
                onClick={() => setSelectedDate(addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7))}
              >
                השבוע הבא
              </Button>
              
              <Button
                variant="outline"
                onClick={() => navigateWeek(1)}
              >
                שבוע הבא
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <Button
                variant="outline"
                onClick={fetchAssignments}
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4" />
                רענן
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">סה״כ משמרות</p>
                  <p className="text-2xl font-bold">{stats.total_shifts || 0}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">אושרו</p>
                  <p className="text-2xl font-bold text-green-600">{stats.confirmed_shifts || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">ממתינים</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending_shifts || 0}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">הושלמו</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.completed_shifts || 0}</p>
                </div>
                <User className="w-8 h-8 text-gray-500" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
            {WEEKDAYS_HE.map((dayName, index) => {
              const day = WEEKDAYS[index];
              const dayAssignments = assignmentsByDay[day] || [];
              const dayDate = addDays(selectedDate, index);
              
              return (
                <Card key={day} className="h-fit">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-center">
                      <div>{dayName}</div>
                      <div className="text-sm font-normal text-gray-500">
                        {format(dayDate, 'dd/MM')}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    {dayAssignments.length > 0 ? (
                      dayAssignments.map(assignment => (
                        <div
                          key={assignment.id}
                          className="p-3 bg-white border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">
                              {assignment.shift_display_name}
                            </h4>
                            {getStatusBadge(assignment.status)}
                          </div>
                          
                          <div className="space-y-1 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                {assignment.start_time} - {assignment.end_time}
                              </span>
                            </div>
                            
                            {assignment.shift_definition?.unit && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span>{assignment.shift_definition.unit.replace('_', ' ')}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2 mt-3">
                            {assignment.status === 'assigned' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfirmAssignment(assignment.id)}
                                disabled={actionLoading[assignment.id]}
                                className="flex-1 text-xs"
                              >
                                {actionLoading[assignment.id] ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3 h-3" />
                                )}
                                אשר
                              </Button>
                            )}
                            
                            {(assignment.status === 'assigned' || assignment.status === 'confirmed') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRequestSwap(assignment.id)}
                                disabled={actionLoading[assignment.id]}
                                className="flex-1 text-xs"
                              >
                                {actionLoading[assignment.id] ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3" />
                                )}
                                החלפה
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
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
      </div>
    </div>
  );
}