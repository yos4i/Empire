import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Eye, Download, Search, Filter, Users, Home } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { User } from '../entities/User';
import { ShiftSubmission } from '../entities/ShiftSubmission';
import { DAYS, SHIFT_NAMES } from '../config/shifts';

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];

export default function ShiftPreferencesPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7));
  const [filterUnit, setFilterUnit] = useState("הכל");

  const selectedWeekStr = format(selectedWeek, 'yyyy-MM-dd');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load users
      const allUsers = await User.list();
      const usersMap = allUsers.reduce((acc, user) => { 
        acc[user.id] = user; 
        return acc; 
      }, {});
      setUsers(usersMap);

      // Load submissions for the selected week
      const submissionsMap = {};
      
      // First, check user weekly_shifts data
      allUsers.forEach(user => {
        if (user.weekly_shifts && user.weekly_shifts[selectedWeekStr]) {
          const userShifts = user.weekly_shifts[selectedWeekStr].shifts;
          if (userShifts) {
            submissionsMap[user.id] = userShifts;
          }
        }
      });

      // Also check shift_submissions collection as fallback
      const allSubmissions = await ShiftSubmission.filter({ week_start: selectedWeekStr });
      allSubmissions.forEach(sub => {
        if (!submissionsMap[sub.user_id]) {
          submissionsMap[sub.user_id] = sub.shifts;
        }
      });

      setSubmissions(submissionsMap);
    } catch (error) {
      console.error("Error loading shift preferences data:", error);
    }
    setLoading(false);
  }, [selectedWeekStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const navigateWeek = (direction) => {
    setSelectedWeek(prev => addDays(prev, direction * 7));
  };

  const getShiftDisplayName = (shiftType, unit) => {
    const fullShiftKey = `${unit}_${shiftType}`;
    return SHIFT_NAMES[fullShiftKey] || `${unit.replace('_', ' ')} ${shiftType}`;
  };

  const exportToCSV = () => {
    const csvData = [];
    const header = ['שם חייל', 'מספר אישי', 'יחידה', ...DAYS_HE];
    csvData.push(header);

    Object.values(users)
      .filter(user => user.role !== 'admin' && user.is_active)
      .filter(user => {
        const matchesSearch = (user.hebrew_name || user.full_name)?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            user.personal_number?.includes(searchTerm);
        const matchesUnit = filterUnit === "הכל" || user.unit === filterUnit;
        return matchesSearch && matchesUnit;
      })
      .forEach(user => {
        const row = [
          user.hebrew_name || user.full_name,
          user.personal_number,
          user.unit?.replace('_', ' ') || ''
        ];
        
        DAYS.forEach(day => {
          const dayShifts = submissions[user.id]?.[day] || [];
          const shiftsDisplay = dayShifts.map(shift => 
            getShiftDisplayName(shift, user.unit)
          ).join('; ');
          row.push(shiftsDisplay);
        });
        
        csvData.push(row);
      });

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shift_preferences_${selectedWeekStr}.csv`;
    link.click();
  };

  const getFilteredUsers = () => {
    return Object.values(users)
      .filter(user => user.role !== 'admin' && user.is_active)
      .filter(user => {
        const matchesSearch = (user.hebrew_name || user.full_name)?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            user.personal_number?.includes(searchTerm);
        const matchesUnit = filterUnit === "הכל" || user.unit === filterUnit;
        return matchesSearch && matchesUnit;
      })
      .sort((a, b) => (a.hebrew_name || a.full_name || '').localeCompare(b.hebrew_name || b.full_name || ''));
  };

  const getSubmissionStats = () => {
    const activeUsers = Object.values(users).filter(user => user.role !== 'admin' && user.is_active);
    const submittedUsers = activeUsers.filter(user => 
      submissions[user.id] && Object.values(submissions[user.id]).some(dayShifts => dayShifts.length > 0)
    );
    
    return {
      total: activeUsers.length,
      submitted: submittedUsers.length,
      pending: activeUsers.length - submittedUsers.length
    };
  };

  const stats = getSubmissionStats();
  const filteredUsers = getFilteredUsers();

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">טוען העדפות משמרות...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
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
                <Eye className="w-8 h-8 text-blue-600" />
                <div className="text-center">
                  <h1 className="text-3xl font-bold text-gray-900">צפייה בהעדפות משמרות</h1>
                  <p className="text-gray-600">סקירת העדפות החיילים לפי שבוע</p>
                </div>
              </div>
            </div>

            <div className="w-32"></div>
          </div>
        </div>

        {/* Week Navigation */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Calendar className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold">בחירת שבוע</h3>
                  <p className="text-sm text-gray-600">
                    {format(selectedWeek, 'dd/MM/yyyy')} - {format(addDays(selectedWeek, 6), 'dd/MM/yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigateWeek(-1)}
                >
                  <ChevronRight className="w-4 h-4" />
                  שבוע קודם
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedWeek(addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7))}
                >
                  השבוע הבא
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigateWeek(1)}
                >
                  שבוע הבא
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">סה״כ חיילים</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">הגישו העדפות</p>
                <p className="text-2xl font-bold text-green-600">{stats.submitted}</p>
              </div>
              <Eye className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">טרם הגישו</p>
                <p className="text-2xl font-bold text-red-600">{stats.pending}</p>
              </div>
              <Calendar className="w-8 h-8 text-red-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">אחוז הגשה</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0}%
                </p>
              </div>
              <Filter className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex flex-col md:flex-row gap-4 flex-1">
                <div className="flex-1 relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="חיפוש לפי שם או מספר אישי..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="pr-10" 
                  />
                </div>
                <div className="flex gap-2">
                  {["הכל", "קריית_חינוך", "גבולות"].map((unit) => (
                    <Button 
                      key={unit} 
                      variant={filterUnit === unit ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setFilterUnit(unit)}
                    >
                      {unit.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>
              <Button 
                onClick={exportToCSV} 
                className="flex items-center gap-2"
                disabled={filteredUsers.length === 0}
              >
                <Download className="w-4 h-4" />
                ייצא לCSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preferences Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              העדפות משמרות ({filteredUsers.length} חיילים)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900 sticky right-0 bg-gray-50 min-w-[120px]">חייל</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900 min-w-[100px]">מ.א</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900 min-w-[100px]">יחידה</th>
                    {DAYS_HE.map((day, index) => (
                      <th key={day} className="px-4 py-3 text-center text-sm font-medium text-gray-900 min-w-[140px]">
                        <div>
                          <div>{day}</div>
                          <div className="text-xs text-gray-500 font-normal">
                            {format(addDays(selectedWeek, index), 'dd/MM')}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => {
                    const userSubmissions = submissions[user.id] || {};
                    const hasSubmissions = Object.values(userSubmissions).some(dayShifts => dayShifts.length > 0);
                    
                    return (
                      <tr key={user.id} className={!hasSubmissions ? 'bg-red-50' : ''}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky right-0 bg-white">
                          <div className="flex items-center gap-2">
                            <span>{user.hebrew_name || user.full_name}</span>
                            {!hasSubmissions && (
                              <Badge variant="outline" className="bg-red-100 text-red-800 text-xs">
                                לא הגיש
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{user.personal_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{user.unit?.replace('_', ' ')}</td>
                        {DAYS.map((day) => {
                          const dayShifts = userSubmissions[day] || [];
                          return (
                            <td key={day} className="px-4 py-3 text-center">
                              <div className="space-y-1">
                                {dayShifts.length > 0 ? (
                                  dayShifts.map((shift, index) => (
                                    <Badge 
                                      key={index} 
                                      variant="outline" 
                                      className="text-xs bg-green-50 text-green-800 border-green-200"
                                    >
                                      {getShiftDisplayName(shift, user.unit)}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-gray-400 text-xs">-</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-500">אין חיילים מתאימים</h3>
                <p className="text-gray-400">נסה לשנות את תנאי החיפוש</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}