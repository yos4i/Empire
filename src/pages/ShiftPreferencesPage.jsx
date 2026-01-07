import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Eye, Search, Filter, Users, Home } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { User } from '../entities/User';
import { getDefaultWeekStart } from '../utils/weekKey';

export default function ShiftPreferencesPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [soldierNotes, setSoldierNotes] = useState({}); // Store soldier notes by user ID
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(() => getDefaultWeekStart());
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

      // Load day-off requests from shift_preferences collection
      const submissionsMap = {}; // Now stores { dayOffRequest, updatedAt }
      const notesMap = {};

      try {
        const { collection: firestoreCollection, query: firestoreQuery, where: firestoreWhere, getDocs: firestoreGetDocs } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');

        const q = firestoreQuery(
          firestoreCollection(db, 'shift_preferences'),
          firestoreWhere('weekStart', '==', selectedWeekStr)
        );
        const snapshot = await firestoreGetDocs(q);

        console.log('ShiftPreferencesPage: Loaded', snapshot.docs.length, 'day-off requests from shift_preferences collection');

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log('Preference document:', doc.id, data);

          // Map the userId from the document to the user
          if (data.userId) {
            // Find the user by matching uid or id
            const user = allUsers.find(u => u.uid === data.userId || u.id === data.userId);
            if (user) {
              // Store day-off request with timestamp
              submissionsMap[user.id] = {
                dayOffRequest: data.dayOffRequest || null,
                updatedAt: data.updatedAt?.toDate() || null
              };
              // Store notes if available
              if (data.notes) {
                notesMap[user.id] = data.notes;
              }
              console.log(`Mapped day-off request for ${user.hebrew_name}:`, data.dayOffRequest);
            }
          }
        });
      } catch (error) {
        console.error('Error loading from shift_preferences:', error);
      }

      // No fallbacks needed for day-off system - only use shift_preferences

      console.log('ShiftPreferencesPage: Final submissions map:', submissionsMap);
      console.log('ShiftPreferencesPage: Final notes map:', notesMap);
      setSubmissions(submissionsMap);
      setSoldierNotes(notesMap);
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
      submissions[user.id] !== undefined && submissions[user.id] !== null
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
        <div className="mb-6 md:mb-8">
          <div className="relative flex items-center justify-center mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/admin')}
              className="absolute left-0"
            >
              <Home className="w-5 h-5"/>
            </Button>
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">צפייה בבקשות יום חופש</h1>
              <p className="text-sm md:text-base text-gray-600">שבוע {format(selectedWeek, 'dd/MM/yyyy')} - {format(addDays(selectedWeek, 6), 'dd/MM/yyyy')}</p>
            </div>
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
                  onClick={() => setSelectedWeek(getDefaultWeekStart())}
                >
                  שבוע ברירת מחדל
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <Card className="p-4 md:p-5">
            <div className="flex flex-col items-center text-center gap-2">
              <Users className="w-8 h-8 md:w-10 md:h-10 text-blue-500" />
              <div>
                <p className="text-xs md:text-sm text-gray-600 mb-1">סה״כ חיילים</p>
                <p className="text-2xl md:text-3xl font-bold text-blue-600">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 md:p-5">
            <div className="flex flex-col items-center text-center gap-2">
              <Eye className="w-8 h-8 md:w-10 md:h-10 text-green-500" />
              <div>
                <p className="text-xs md:text-sm text-gray-600 mb-1">הגישו בקשה</p>
                <p className="text-2xl md:text-3xl font-bold text-green-600">{stats.submitted}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 md:p-5">
            <div className="flex flex-col items-center text-center gap-2">
              <Calendar className="w-8 h-8 md:w-10 md:h-10 text-red-500" />
              <div>
                <p className="text-xs md:text-sm text-gray-600 mb-1">טרם הגישו</p>
                <p className="text-2xl md:text-3xl font-bold text-red-600">{stats.pending}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 md:p-5">
            <div className="flex flex-col items-center text-center gap-2">
              <Filter className="w-8 h-8 md:w-10 md:h-10 text-purple-500" />
              <div>
                <p className="text-xs md:text-sm text-gray-600 mb-1">אחוז הגשה</p>
                <p className="text-2xl md:text-3xl font-bold text-purple-600">
                  {stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0}%
                </p>
              </div>
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
            </div>
          </CardContent>
        </Card>

        {/* Preferences Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              בקשות יום חופש ({filteredUsers.length} חיילים)
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
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900 min-w-[150px]">יום חופש מבוקש</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900 min-w-[200px]">הערות</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900 min-w-[150px]">תאריך הגשה</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => {
                    const userSubmission = submissions[user.id];
                    const dayOffRequest = userSubmission?.dayOffRequest;
                    const submissionDate = userSubmission?.updatedAt;
                    const hasSubmission = dayOffRequest !== null && dayOffRequest !== undefined;

                    const userNotes = soldierNotes[user.id];

                    const dayNames = {
                      sunday: 'ראשון',
                      monday: 'שני',
                      tuesday: 'שלישי',
                      wednesday: 'רביעי',
                      thursday: 'חמישי',
                      friday: 'שישי',
                      saturday: 'שבת'
                    };

                    return (
                      <tr key={user.id} className={!hasSubmission ? 'bg-red-50' : ''}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky right-0 bg-white">
                          <div className="flex items-center gap-2">
                            <span>{user.hebrew_name || user.full_name}</span>
                            {!hasSubmission && (
                              <Badge variant="outline" className="bg-red-100 text-red-800 text-xs">
                                לא הגיש
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{user.personal_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{user.unit?.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {hasSubmission ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200">
                              יום {dayNames[dayOffRequest]}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px]">
                          {userNotes ? (
                            <div className="text-xs italic text-gray-700 truncate" title={userNotes}>
                              {userNotes}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {submissionDate ? (
                            <span className="text-xs">
                              {format(submissionDate, 'dd/MM HH:mm')}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
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