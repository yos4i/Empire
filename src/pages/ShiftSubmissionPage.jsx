import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShiftSubmission } from "../entities/ShiftSubmission";
import { ClipboardList, AlertTriangle, Calendar, Home } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import ShiftSelectionGrid from "../components/soldier/ShiftSelectionGrid";
import SubmissionRules from "../components/soldier/SubmissionRules";
import { startOfWeek, addDays } from "date-fns";
import { toWeekStartISO } from '../utils/weekKey';
import { DAYS } from "../config/shifts";
import { useAuth } from "../contexts/AuthContext";

export default function ShiftSubmissionPage() {
  const { soldierId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [shifts, setShifts] = useState(
    DAYS.reduce((acc, day) => ({ ...acc, [day]: [] }), {})
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

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
      
      const currentUserData = {
        id: user.uid, // Use Firebase UID for consistency
        hebrew_name: user.displayName,
        full_name: user.displayName,
        ...user
      };
      setCurrentUser(currentUserData);

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
    console.log('ShiftSubmissionPage: Starting submission...');
    console.log('ShiftSubmissionPage: Current user:', currentUser);
    console.log('ShiftSubmissionPage: Shifts to submit:', shifts);
    console.log('ShiftSubmissionPage: Week start:', nextWeekStartStr);
    
    setSaving(true);
    try {
      const submissionData = {
        uid: user.uid, // Canonical for joins
        user_id: user.uid, // Keep for backward compatibility 
        user_name: user.displayName,
        week_start: nextWeekStartStr, // Filter key, ISO string
        updated_at: new Date(), // Will be converted to serverTimestamp in entity
        shifts: shifts // New canonical shape
      };
      
      console.log('ShiftSubmissionPage: Submission data:', submissionData);
      
      if (existingSubmission) {
        console.log('ShiftSubmissionPage: Updating existing submission:', existingSubmission.id);
        await ShiftSubmission.update(existingSubmission.id, {
          uid: user.uid,
          user_id: user.uid,
          user_name: user.displayName,
          week_start: nextWeekStartStr,
          updated_at: new Date(),
          shifts
        });
      } else {
        console.log('ShiftSubmissionPage: Creating new submission...');
        const result = await ShiftSubmission.create(submissionData);
        console.log('ShiftSubmissionPage: Create result:', result);
      }
      alert("העדפות המשמרות נשלחו בהצלחה!");
      loadData();
    } catch (e) {
      console.error("ShiftSubmissionPage: Error submitting shifts:", e);
      console.error("ShiftSubmissionPage: Error details:", e.message, e.stack);
      alert(`שגיאה בשליחת ההגשה: ${e.message}`);
    }
    setSaving(false);
  };
  
  const totalShifts = Object.values(shifts).flat().length;
  const progress = totalShifts > 0 ? 100 : 0;

  if (loading) {
    return (
      <div className="p-6 text-center">טוען הגשות...</div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">העדפות משמרות</h1>
                <p className="text-gray-600">בחר את המשמרות שאתה מעוניין לעבוד בהן לשבוע הבא</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate(`/soldier/${user?.uid}`)}
              className="flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              חזרה לדשבורד
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">התקדמות ההגשה</h3>
              <Badge 
                variant="default"
                className="bg-green-100 text-green-800"
              >
                {totalShifts} משמרות נבחרו
              </Badge>
            </div>
            <Progress value={progress} className="mb-2" />
            <div className="flex justify-between text-sm text-gray-600">
              <span>בחר את המשמרות המועדפות עליך</span>
              <span>✓ מוכן להגשה</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ShiftSelectionGrid 
              shifts={shifts}
              onToggleShift={toggleShift}
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

            {existingSubmission && (
              <Alert>
                <Calendar className="h-4 w-4" />
                <AlertTitle>העדפות קיימות</AlertTitle>
                <AlertDescription>
                  העדפות משמרות קיימות נמצאו. לחיצה על "עדכן העדפות" תחליף את ההעדפות הקודמות.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


