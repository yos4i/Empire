import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShiftSubmission } from "../entities/ShiftSubmission";
import { WeeklySchedule } from "../entities/WeeklySchedule";
import { ClipboardList, AlertTriangle, Home } from "lucide-react";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import ShiftSelectionGrid from "../components/soldier/ShiftSelectionGrid";
import SubmissionRules from "../components/soldier/SubmissionRules";
import { startOfWeek, addDays } from "date-fns";
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
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeklySchedule, setWeeklySchedule] = useState(null);
  const [soldierMission, setSoldierMission] = useState(null);

  // Security check: Ensure the soldier can only access their own route
  useEffect(() => {
    if (user && soldierId && user.uid !== soldierId) {
      console.warn('ShiftSubmissionPage: Access denied - soldier trying to access another soldier\'s route');
      navigate(`/soldier/${user.uid}`, { replace: true });
      return;
    }
  }, [user, soldierId, navigate]);

  const nextWeekStart = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7);
  const nextWeekStartStr = toWeekStartISO(nextWeekStart);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
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
    setShifts((prev) => {
      const dayShifts = prev[day] || [];
      const isSelected = dayShifts.includes(shiftType);
      const newDayShifts = isSelected
        ? dayShifts.filter((s) => s !== shiftType)
        : [...dayShifts, shiftType];
      return { ...prev, [day]: newDayShifts };
    });
  };


const handleSubmit = async () => {
  setSaving(true);
  try {
    // Save using BOTH methods for compatibility
    
    // Method 1: New way using ShiftSubmissionService (for admin to see)
    await ShiftSubmissionService.submitPreferences(
      user.uid,
      user.displayName || user.username || user.hebrew_name,
      nextWeekStartStr,
      shifts
    );
    
    // Method 2: Old way using ShiftSubmission entity (for backward compatibility)
    const submissionData = {
      uid: user.uid,
      user_id: user.uid,
      soldier_id: user.uid,
      userName: user.displayName || user.username || user.hebrew_name,
      week_start: nextWeekStartStr,
      shifts: shifts,
      days: shifts
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
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/soldier/${user?.uid}`)}
              className="flex items-center gap-2 shrink-0 order-1 sm:order-none"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">חזרה לדשבורד</span>
              <span className="sm:hidden">חזור</span>
            </Button>

            <div className="flex items-center gap-3 order-2 sm:order-none flex-1">
              <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-gray-900">העדפות משמרות</h1>
                <p className="text-sm sm:text-base text-gray-600">בחר את המשמרות שאתה מעוניין לעבוד בהן לשבוע הבא</p>
              </div>
            </div>
          </div>
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
                  weeklySchedule={weeklySchedule}
                  soldierMission={soldierMission}
                />

                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    onClick={handleSubmit}
                    disabled={saving}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
                  >
                    {saving ? "שולח..." : existingSubmission ? "עדכן העדפות" : "שלח העדפות"}
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



