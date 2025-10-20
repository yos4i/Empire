import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShiftSubmission } from "../entities/ShiftSubmission";
import { WeeklySchedule } from "../entities/WeeklySchedule";
import { SubmissionWindow } from "../entities/SubmissionWindow";
import { ClipboardList, AlertTriangle, Home, Lock } from "lucide-react";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import ShiftSelectionGrid from "../components/soldier/ShiftSelectionGrid";
import SubmissionRules from "../components/soldier/SubmissionRules";
import { startOfWeek, addDays, format } from "date-fns";
import { toWeekStartISO } from '../utils/weekKey';
import { DAYS } from "../config/shifts";
import { useAuth } from "../contexts/AuthContext";
import { ShiftSubmissionService } from '../services/shiftSubmission';
import { User } from '../entities/User';


export default function ShiftSubmissionPage() {
  const { soldierId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [shifts, setShifts] = useState(
    DAYS.reduce((acc, day) => ({ ...acc, [day]: [] }), {})
  );
  const [longShiftDays, setLongShiftDays] = useState({}); // Track which days have long shift preference
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeklySchedule, setWeeklySchedule] = useState(null);
  const [soldierMission, setSoldierMission] = useState(null);
  const [isWeekOpen, setIsWeekOpen] = useState(false);
  const [checkingWeekStatus, setCheckingWeekStatus] = useState(true);

  // Security check: Ensure the soldier can only access their own route
  useEffect(() => {
    if (user && soldierId && user.uid !== soldierId) {
      console.warn('ShiftSubmissionPage: Access denied - soldier trying to access another soldier\'s route');
      navigate(`/soldier/${user.uid}`, { replace: true });
      return;
    }
  }, [user, soldierId, navigate]);

  const nextWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const nextWeekStartStr = toWeekStartISO(nextWeekStart);

  const loadData = useCallback(async () => {
    setLoading(true);
    setCheckingWeekStatus(true);
    try {
      // Check if week is open for submissions
      const weekOpen = await SubmissionWindow.isWeekOpen(nextWeekStartStr);
      setIsWeekOpen(weekOpen);
      console.log('📅 ShiftSubmissionPage: Week', nextWeekStartStr, 'is', weekOpen ? 'OPEN' : 'CLOSED', 'for submissions');
      setCheckingWeekStatus(false);

      // Use authenticated user instead of User.me()
      if (!user) {
        console.error("No authenticated user found");
        return;
      }

      // Check if mission is in user object, if not fetch from Firestore
      let mission = user.mission;
      if (!mission) {
        console.log('🔍 ShiftSubmissionPage: Mission not in user object, fetching from Firestore...');
        try {
          const userDoc = await User.me();
          if (userDoc?.mission) {
            mission = userDoc.mission;
            console.log('✅ ShiftSubmissionPage: Fetched mission from Firestore:', mission);

            // Update localStorage with mission
            const updatedUser = { ...user, mission };
            localStorage.setItem('authUser', JSON.stringify(updatedUser));
          } else {
            console.warn('⚠️ ShiftSubmissionPage: No mission found in Firestore for this user');
          }
        } catch (err) {
          console.error('❌ ShiftSubmissionPage: Error fetching mission from Firestore:', err);
        }
      }
      setSoldierMission(mission);
      console.log('🎯 ShiftSubmissionPage: Final mission value:', mission);

      // Load the weekly schedule to get custom shift hours
      const schedules = await WeeklySchedule.filter({ week_start: nextWeekStartStr });
      if (schedules.length > 0) {
        setWeeklySchedule(schedules[0]);
        console.log('📅 ShiftSubmissionPage: Loaded weekly schedule:', schedules[0]);
        console.log('📅 ShiftSubmissionPage: Schedule data:', schedules[0].schedule);
      } else {
        console.log('⚠️ ShiftSubmissionPage: No weekly schedule found for', nextWeekStartStr);
      }

      const submissions = await ShiftSubmission.filter({
        user_id: user.uid, // Use Firebase UID
        week_start: nextWeekStartStr,
      });

      if (submissions.length > 0) {
        setExistingSubmission(submissions[0]);
        setShifts(submissions[0].shifts);
        setLongShiftDays(submissions[0].longShiftDays || {});
      }
    } catch (e) {
      console.error("Error loading data", e);
    }
    setLoading(false);
  }, [nextWeekStartStr, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const validateShifts = useCallback(() => {
    // No validation - allow any number of shifts
    setErrors([]);
  }, []);

  useEffect(() => {
    validateShifts();
  }, [validateShifts]);

  const toggleShift = (day, shiftType) => {
    // Check if this is a "long shift" virtual type
    const isLongShiftType = shiftType.includes('_ארוך');

    if (isLongShiftType) {
      // This is a long shift preference - toggle it
      const baseShiftType = shiftType.replace('_ארוך', '');
      setShifts((prev) => {
        const dayShifts = prev[day] || [];
        const hasBaseShift = dayShifts.includes(baseShiftType);

        if (hasBaseShift) {
          // Already have the base shift - just toggle long preference
          setLongShiftDays(prevLong => ({
            ...prevLong,
            [day]: !prevLong[day]
          }));
          return prev;
        } else {
          // Add base shift and mark as long
          setLongShiftDays(prevLong => ({
            ...prevLong,
            [day]: true
          }));
          return { ...prev, [day]: [...dayShifts, baseShiftType] };
        }
      });
    } else {
      // Regular shift toggle
      setShifts((prev) => {
        const dayShifts = prev[day] || [];
        const isSelected = dayShifts.includes(shiftType);
        const newDayShifts = isSelected
          ? dayShifts.filter((s) => s !== shiftType)
          : [...dayShifts, shiftType];

        // If deselecting, also clear long shift preference
        if (isSelected) {
          setLongShiftDays(prevLong => {
            const newLong = { ...prevLong };
            delete newLong[day];
            return newLong;
          });
        }

        return { ...prev, [day]: newDayShifts };
      });
    }
  };


const handleSubmit = async () => {
  // Check if week is open
  if (!isWeekOpen) {
    alert('השבוע סגור להגשת העדפות. אנא פנה למנהל.');
    return;
  }

  setSaving(true);
  try {
    // Save using BOTH methods for compatibility

    // Method 1: New way using ShiftSubmissionService (for admin to see)
    await ShiftSubmissionService.submitPreferences(
      user.uid,
      user.displayName || user.username || user.hebrew_name,
      nextWeekStartStr,
      shifts,
      longShiftDays // Pass long shift preferences
    );

    // Method 2: Old way using ShiftSubmission entity (for backward compatibility)
    const submissionData = {
      uid: user.uid,
      user_id: user.uid,
      soldier_id: user.uid,
      userName: user.displayName || user.username || user.hebrew_name,
      week_start: nextWeekStartStr,
      shifts: shifts,
      days: shifts,
      longShiftDays: longShiftDays // Store which days have long shift preference
    };

    if (existingSubmission) {
      await ShiftSubmission.update(existingSubmission.id, submissionData);
    } else {
      await ShiftSubmission.create(submissionData);
    }
    
    alert('Preferences submitted successfully!');
    navigate(`/soldier/${user.uid}`);
  } catch (error) {
    console.error('Error submitting preferences:', error);
    alert('Error submitting preferences: ' + error.message);
  } finally {
    setSaving(false);
  }
};


  if (loading) {
    return (
      <div className="p-6 text-center">טוען הגשות...</div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 md:mb-8">
          <div className="relative flex items-center justify-center mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(`/soldier/${user?.uid}`)}
              className="absolute left-0"
            >
              <Home className="w-5 h-5" />
            </Button>

            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">העדפות משמרות</h1>
              <p className="text-sm md:text-base text-gray-600">שבוע {format(nextWeekStart, 'dd/MM/yyyy')} - {format(addDays(nextWeekStart, 6), 'dd/MM/yyyy')}</p>
            </div>
          </div>

          {/* Week Status Banner */}
          {checkingWeekStatus ? (
            <div className="text-center py-2 text-sm text-gray-600">בודק סטטוס שבוע...</div>
          ) : !isWeekOpen ? (
            <Alert className="bg-red-50 border-red-200">
              <Lock className="h-5 w-5 text-red-600" />
              <AlertTitle className="text-red-900 font-semibold">השבוע סגור להגשת העדפות</AlertTitle>
              <AlertDescription className="text-red-800">
                <p>מנהל המערכת סגר את השבוע הזה להגשת העדפות.</p>
                <p className="mt-2">לא ניתן לשלוח או לערוך העדפות משמרות לשבוע זה.</p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-green-50 border-green-200">
              <ClipboardList className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-green-900 font-semibold">✓ השבוע פתוח להגשת העדפות</AlertTitle>
              <AlertDescription className="text-green-800">
                <p>אתה יכול לבחור ולשלוח את העדפות המשמרות שלך לשבוע זה.</p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {console.log('🎯 ShiftSubmissionPage: Passing soldierMission to grid:', soldierMission, 'Full user:', user)}

            {/* Show message if soldier doesn't have a mission assigned */}
            {!soldierMission ? (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <AlertTitle className="text-yellow-900 font-semibold">לא ניתן להגיש העדפות כרגע</AlertTitle>
                <AlertDescription className="text-yellow-800">
                  <p className="mb-2">המשימה שלך טרם הוגדרה על ידי המנהל.</p>
                  <p>נא לפנות למנהל המערכת כדי שיקצה אותך למשימה (גבולות או קריית חינוך).</p>
                  <p className="mt-3 text-sm">לאחר שהמשימה תוגדר, תוכל לבחור את העדפות המשמרות שלך.</p>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <ShiftSelectionGrid
                  shifts={shifts}
                  onToggleShift={toggleShift}
                  isSubmissionOpen={isWeekOpen}
                  weeklySchedule={weeklySchedule}
                  soldierMission={soldierMission}
                  longShiftDays={longShiftDays}
                />

                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    onClick={handleSubmit}
                    disabled={saving || !isWeekOpen}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "שולח..." : !isWeekOpen ? "השבוע סגור להגשות" : existingSubmission ? "עדכן העדפות" : "שלח העדפות"}
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="space-y-6">
            <SubmissionRules />
            
            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>שגיאות בהגשה</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



