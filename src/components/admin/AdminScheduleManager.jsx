import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format, addDays, startOfWeek } from 'date-fns';
import { 
  Calendar, 
  Users, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Eye,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { AdminApiService } from '../../services/adminApi';
import { ShiftDefinition } from '../../entities/ShiftDefinition';
import { useAuth } from '../../contexts/AuthContext';
import { toWeekStartISO } from '../../utils/weekKey';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function AdminScheduleManager() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [preferences, setPreferences] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [stats, setStats] = useState({});
  const [error, setError] = useState(null);

  const weekStart = toWeekStartISO(selectedDate);

  // Load data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('AdminScheduleManager: Fetching data for week:', weekStart);
      
      const [prefsData, assignmentsData, shiftsData, statsData] = await Promise.all([
        AdminApiService.getShiftPreferences(weekStart),
        AdminApiService.getAssignments(weekStart, 
          format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd')
        ),
        ShiftDefinition.list(),
        AdminApiService.getDashboardStats(weekStart)
      ]);
      
      setPreferences(prefsData);
      setAssignments(assignmentsData);
      setShifts(shiftsData);
      setStats(statsData);
      
      console.log('AdminScheduleManager: Data loaded successfully');
    } catch (error) {
      console.error('AdminScheduleManager: Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigate weeks
  const navigateWeek = (direction) => {
    setSelectedDate(prev => addDays(prev, direction * 7));
  };

  // Handle drag and drop
  const handleDragEnd = async (result) => {
    const { destination, draggableId } = result;
    
    if (!destination) return;
    
    // Parse draggable ID (format: "soldier-{id}")
    const soldierId = draggableId.replace('soldier-', '');
    
    // Parse destination ID (format: "{day}-{shiftType}")
    const [day, shiftType] = destination.droppableId.split('-');
    
    if (!day || !shiftType || day === 'unassigned') return;
    
    try {
      setAssigning(true);
      
      // Calculate date for the day
      const dayIndex = WEEKDAYS.indexOf(day);
      const assignmentDate = format(addDays(new Date(weekStart), dayIndex), 'yyyy-MM-dd');
      
      console.log('AdminScheduleManager: Assigning soldier', soldierId, 'to', shiftType, 'on', assignmentDate);
      
      await AdminApiService.assignShift({
        soldierId,
        date: assignmentDate,
        shiftType,
        assignedBy: user.uid
      });
      
      // Refresh data
      await fetchData();
      
    } catch (error) {
      console.error('AdminScheduleManager: Assignment error:', error);
      setError(error.message);
    } finally {
      setAssigning(false);
    }
  };

  // Auto assign based on preferences
  const handleAutoAssign = async () => {
    try {
      setAssigning(true);
      
      const result = await AdminApiService.autoAssignShifts(weekStart, user.uid);
      
      console.log('AdminScheduleManager: Auto-assignment result:', result);
      
      // Refresh data
      await fetchData();
      
      alert(`שיבוץ אוטומטי הושלם!\nנוצרו: ${result.assignments.length} שיבוצים\nקונפליקטים: ${result.conflicts.length}`);
      
    } catch (error) {
      console.error('AdminScheduleManager: Auto-assignment error:', error);
      setError(error.message);
    } finally {
      setAssigning(false);
    }
  };

  // Remove assignment
  const handleRemoveAssignment = async (assignmentId) => {
    try {
      await AdminApiService.removeAssignment(assignmentId);
      await fetchData();
    } catch (error) {
      console.error('AdminScheduleManager: Remove assignment error:', error);
      setError(error.message);
    }
  };

  // Get soldiers with preferences but no assignments
  const getUnassignedSoldiers = () => {
    const assignedSoldierIds = new Set(assignments.map(a => a.soldier_id));
    return preferences.filter(pref => 
      pref.soldier && !assignedSoldierIds.has(pref.soldier_id)
    );
  };

  // Get assignments for a specific day and shift
  const getAssignmentsForSlot = (day, shiftType) => {
    const dayIndex = WEEKDAYS.indexOf(day);
    const targetDate = format(addDays(new Date(weekStart), dayIndex), 'yyyy-MM-dd');
    
    return assignments.filter(assignment => 
      assignment.date === targetDate && assignment.shift_type === shiftType
    );
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">טוען נתוני שיבוץ...</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="p-4 md:p-6 bg-gray-50 min-h-screen" dir="rtl">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">ניהול שיבוץ משמרות</h1>
                  <p className="text-gray-600">שבוע {format(selectedDate, 'dd/MM/yyyy')} - {format(addDays(selectedDate, 6), 'dd/MM/yyyy')}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigateWeek(-1)}
                  disabled={assigning}
                >
                  <ChevronRight className="w-4 h-4" />
                  שבוע קודם
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setSelectedDate(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                  disabled={assigning}
                >
                  השבוע הנוכחי
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => navigateWeek(1)}
                  disabled={assigning}
                >
                  שבוע הבא
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">סה״כ חיילים</p>
                    <p className="text-2xl font-bold">{stats.total_soldiers || 0}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500" />
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">הגישו העדפות</p>
                    <p className="text-2xl font-bold text-green-600">{stats.submitted_preferences || 0}</p>
                  </div>
                  <Eye className="w-8 h-8 text-green-500" />
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">שיבוצים פעילים</p>
                    <p className="text-2xl font-bold text-blue-600">{assignments.length}</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-500" />
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">אחוז הגשה</p>
                    <p className="text-2xl font-bold text-purple-600">{stats.submission_rate || 0}%</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-purple-500" />
                </div>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleAutoAssign}
                disabled={assigning || preferences.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {assigning ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <Sparkles className="w-4 h-4 ml-2" />
                )}
                שיבוץ אוטומטי
              </Button>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Unassigned Soldiers Panel */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    חיילים לשיבוץ ({getUnassignedSoldiers().length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <Droppable droppableId="unassigned">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[200px] space-y-2 ${
                          snapshot.isDraggingOver ? 'bg-blue-50' : ''
                        }`}
                      >
                        {getUnassignedSoldiers().map((preference, index) => (
                          <Draggable
                            key={preference.soldier_id}
                            draggableId={`soldier-${preference.soldier_id}`}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-3 bg-white border border-gray-200 rounded-lg cursor-move transition-shadow ${
                                  snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'
                                }`}
                              >
                                <div className="font-medium text-sm">
                                  {preference.soldier_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {preference.soldier_unit?.replace('_', ' ')}
                                </div>
                                <div className="text-xs text-green-600">
                                  הגיש העדפות
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        {getUnassignedSoldiers().length === 0 && (
                          <div className="text-center text-gray-500 py-8">
                            <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">כל החיילים שובצו</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            </div>

            {/* Schedule Board */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    לוח משמרות
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                      
                      {/* Days Header */}
                      <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
                        <div className="p-4 font-medium text-gray-900">משמרת</div>
                        {WEEKDAYS_HE.map((day, index) => (
                          <div key={day} className="p-4 text-center font-medium text-gray-900">
                            <div>{day}</div>
                            <div className="text-xs text-gray-500">
                              {format(addDays(selectedDate, index), 'dd/MM')}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Shift Rows */}
                      {shifts.filter(shift => !shift.unit_specific).map(shift => (
                        <div key={shift.id} className="grid grid-cols-8 border-b border-gray-200">
                          
                          {/* Shift Info */}
                          <div className="p-4 bg-gray-50 border-l border-gray-200">
                            <div className="font-medium text-sm">{shift.name}</div>
                            <div className="text-xs text-gray-500">
                              {shift.start_time} - {shift.end_time}
                            </div>
                            <div className="text-xs text-blue-600">
                              נדרש: {shift.required_soldiers}
                            </div>
                          </div>

                          {/* Days */}
                          {WEEKDAYS.map(day => {
                            const slotAssignments = getAssignmentsForSlot(day, shift.name_en || shift.id);
                            const droppableId = `${day}-${shift.name_en || shift.id}`;
                            
                            return (
                              <Droppable key={droppableId} droppableId={droppableId}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`p-2 min-h-[100px] border-l border-gray-200 ${
                                      snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-white'
                                    } ${
                                      slotAssignments.length >= shift.required_soldiers ? 'bg-green-50' : ''
                                    }`}
                                  >
                                    <div className="space-y-1">
                                      {slotAssignments.map((assignment, index) => (
                                        <div
                                          key={assignment.id}
                                          className="p-2 bg-blue-100 border border-blue-200 rounded text-xs"
                                        >
                                          <div className="font-medium">
                                            {assignment.soldier_name}
                                          </div>
                                          <div className="text-blue-600">
                                            {assignment.soldier_unit?.replace('_', ' ')}
                                          </div>
                                          <button
                                            onClick={() => handleRemoveAssignment(assignment.id)}
                                            className="text-red-600 hover:text-red-800 text-xs mt-1"
                                          >
                                            הסר
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                    {provided.placeholder}
                                    
                                    {/* Status Indicator */}
                                    <div className="mt-2 text-xs text-center">
                                      {slotAssignments.length < shift.required_soldiers ? (
                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                                          דרוש: {shift.required_soldiers - slotAssignments.length}
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-green-100 text-green-800">
                                          מלא
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Droppable>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DragDropContext>
  );
}