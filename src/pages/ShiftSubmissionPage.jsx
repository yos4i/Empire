import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShiftSubmission } from "../entities/ShiftSubmission";
import { SubmissionWindow } from "../entities/SubmissionWindow";
import { ClipboardList, AlertTriangle, Lock, ChevronLeft, ChevronRight, Sun, Check } from "lucide-react";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { addDays, addWeeks, format } from "date-fns";
import { toWeekStartISO, getDefaultWeekStart } from '../utils/weekKey';
import { DAYS } from "../config/shifts";
import { useAuth } from "../contexts/AuthContext";
import { ShiftSubmissionService } from '../services/shiftSubmission';
import { User } from '../entities/User';

const DAYS_HE = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי',
};

// Days offered as a "day off" choice.
const SELECTABLE_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

// The default shift a soldier is assumed available for on every day that is
// NOT their day off. Morning is the standard shift (evening is by command only).
const DEFAULT_SHIFT = 'קריית_חינוך_בוקר';

// Build the days/shifts structure the admin panel + scheduler consume from a
// single chosen day-off: the off day is empty (unavailable), every other day
// gets the default morning shift.
const buildShiftsFromDayOff = (offDay) =>
  DAYS.reduce((acc, day) => {
    acc[day] = day === offDay ? [] : [DEFAULT_SHIFT];
    return acc;
  }, {});

// Recover the chosen day-off from a stored submission. Prefers the explicit
// `dayOff` field; falls back to "the one selectable day with no shifts".
const deriveDayOff = (submission) => {
  if (!submission) return null;
  if (submission.dayOff && SELECTABLE_DAYS.includes(submission.dayOff)) {
    return submission.dayOff;
  }
  const days = submission.days || submission.shifts;
  if (!days) return null;
  const off = SELECTABLE_DAYS.find((d) => (days[d] || []).length === 0);
  return off || null;
};

export default function ShiftSubmissionPage() {
  const { soldierId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dayOff, setDayOff] = useState(null);
  const [notes, setNotes] = useState('');
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [soldierMission, setSoldierMission] = useState(null);
  const [isWeekOpen, setIsWeekOpen] = useState(false);
  const [checkingWeekStatus, setCheckingWeekStatus] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  // Security check: a soldier can only access their own route.
  useEffect(() => {
    if (user && soldierId && user.uid !== soldierId) {
      console.warn('ShiftSubmissionPage: Access denied - soldier trying to access another soldier\'s route');
      navigate(`/soldier/${user.uid}`, { replace: true });
      return;
    }
  }, [user, soldierId, navigate]);

  const nextWeekStart = addWeeks(getDefaultWeekStart(), weekOffset);
  const nextWeekStartStr = toWeekStartISO(nextWeekStart);

  const loadData = useCallback(async () => {
    setLoading(true);
    setCheckingWeekStatus(true);
    try {
      const weekOpen = await SubmissionWindow.isWeekOpen(nextWeekStartStr);
      setIsWeekOpen(weekOpen);
      setCheckingWeekStatus(false);

      if (!user) {
        console.error("No authenticated user found");
        return;
      }

      // Resolve mission (used to gate submissions).
      let mission = user.mission;
      if (!mission) {
        try {
          const userDoc = await User.me();
          if (userDoc?.mission) {
            mission = userDoc.mission;
            const updatedUser = { ...user, mission };
            localStorage.setItem('authUser', JSON.stringify(updatedUser));
          }
        } catch (err) {
          console.error('ShiftSubmissionPage: Error fetching mission from Firestore:', err);
        }
      }
      setSoldierMission(mission);

      // Load any existing submission — new collection first, then legacy.
      const preferences = await ShiftSubmissionService.getPreferences(user.uid, nextWeekStartStr);
      if (preferences) {
        setExistingSubmission(preferences);
        setDayOff(deriveDayOff(preferences));
        setNotes(preferences.notes || '');
      } else {
        const submissions = await ShiftSubmission.filter({
          user_id: user.uid,
          week_start: nextWeekStartStr,
        });
        if (submissions.length > 0) {
          setExistingSubmission(submissions[0]);
          setDayOff(deriveDayOff(submissions[0]));
          setNotes(submissions[0].notes || '');
        } else {
          setExistingSubmission(null);
          setDayOff(null);
          setNotes('');
        }
      }
    } catch (e) {
      console.error("Error loading data", e);
    }
    setLoading(false);
  }, [nextWeekStartStr, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    if (!isWeekOpen) {
      alert('השבוע סגור להגשת העדפות. אנא פנה למנהל.');
      return;
    }
    if (!dayOff) {
      alert('יש לבחור יום חופש אחד לפני השליחה.');
      return;
    }

    setSaving(true);
    try {
      const shifts = buildShiftsFromDayOff(dayOff);

      // Method 1: new shift_preferences collection (admin view).
      await ShiftSubmissionService.submitPreferences(
        user.uid,
        user.displayName || user.username || user.hebrew_name,
        nextWeekStartStr,
        shifts,
        {}, // no long-shift preferences in the day-off model
        notes
      );

      // Method 2: legacy shift_submissions collection (backward compat).
      const submissionData = {
        uid: user.uid,
        user_id: user.uid,
        soldier_id: user.uid,
        userName: user.displayName || user.username || user.hebrew_name,
        week_start: nextWeekStartStr,
        shifts,
        days: shifts,
        dayOff, // explicit day-off marker for clean round-trip
        notes,
      };

      const existingSubs = await ShiftSubmission.filter({
        user_id: user.uid,
        week_start: nextWeekStartStr,
      });
      if (existingSubs.length > 0) {
        await ShiftSubmission.update(existingSubs[0].id, submissionData);
      } else {
        await ShiftSubmission.create(submissionData);
      }

      alert('העדפות נשלחו בהצלחה!');
      navigate(`/soldier/${user.uid}`);
    } catch (error) {
      console.error('Error submitting preferences:', error);
      alert('שגיאה בשליחת ההעדפות: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">טוען הגשות...</div>;
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen w-full overflow-x-hidden" dir="rtl">
      <div className="max-w-3xl mx-auto w-full">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-center mb-6 w-full">
            <div className="text-center flex-1 w-full">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">בחירת יום חופש</h1>
              <div className="flex items-center justify-center gap-3 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                  disabled={weekOffset <= 0}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <p className="text-sm md:text-base text-gray-600 min-w-[200px]">
                  שבוע {format(nextWeekStart, 'dd/MM/yyyy')} - {format(addDays(nextWeekStart, 6), 'dd/MM/yyyy')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                  disabled={weekOffset >= 4}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Week status banner */}
          {checkingWeekStatus ? (
            <div className="text-center py-2 text-sm text-gray-600">בודק סטטוס שבוע...</div>
          ) : !isWeekOpen ? (
            <Alert className="bg-red-50 border-red-200">
              <Lock className="h-5 w-5 text-red-600" />
              <AlertTitle className="text-red-900 font-semibold">השבוע סגור להגשת העדפות</AlertTitle>
              <AlertDescription className="text-red-800">
                <p>מנהל המערכת סגר את השבוע הזה להגשת העדפות.</p>
                <p className="mt-2">לא ניתן לשלוח או לערוך יום חופש לשבוע זה.</p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-green-50 border-green-200">
              <ClipboardList className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-green-900 font-semibold">✓ השבוע פתוח להגשה</AlertTitle>
              <AlertDescription className="text-green-800">
                <p>בחר יום אחד שבו תרצה להיות בחופש לשבוע זה.</p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {!soldierMission ? (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <AlertTitle className="text-yellow-900 font-semibold">לא ניתן להגיש כרגע</AlertTitle>
            <AlertDescription className="text-yellow-800">
              <p className="mb-2">המשימה שלך טרם הוגדרה על ידי המנהל.</p>
              <p>נא לפנות למנהל המערכת כדי שיקצה אותך למשימה (קריית חינוך).</p>
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sun className="w-5 h-5 text-amber-500" />
                איזה יום תרצה חופש?
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                בחר יום אחד. בשאר הימים אתה נחשב זמין למשמרת.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {SELECTABLE_DAYS.map((day, idx) => {
                const date = addDays(nextWeekStart, idx);
                const selected = dayOff === day;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!isWeekOpen}
                    onClick={() => setDayOff(selected ? null : day)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-150 text-right ${
                      !isWeekOpen
                        ? 'cursor-not-allowed opacity-50 border-gray-200'
                        : selected
                        ? 'border-amber-500 bg-amber-50 shadow-sm'
                        : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/40'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selected ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                        }`}
                      >
                        {selected && <Check className="w-3.5 h-3.5 text-white" />}
                      </span>
                      <span className="font-semibold text-gray-900">יום {DAYS_HE[day]}</span>
                    </span>
                    <span dir="ltr" className="text-sm text-gray-500 tabular-nums">
                      {format(date, 'dd/MM/yyyy')}
                    </span>
                  </button>
                );
              })}

              {/* Notes */}
              <div className="pt-4">
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  הערות למנהל (לא חובה)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!isWeekOpen}
                  placeholder="למשל: בקשה מיוחדת, מגבלה, או כל מידע רלוונטי..."
                  className="w-full min-h-[90px] p-3 border-2 border-gray-200 rounded-lg resize-y focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:bg-gray-100"
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 mt-1 text-left">{notes.length}/500 תווים</div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                {dayOff ? (
                  <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-2 text-center">
                    יום החופש שנבחר: <strong>יום {DAYS_HE[dayOff]}</strong>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 text-center">עדיין לא נבחר יום חופש</p>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={saving || !isWeekOpen || !dayOff}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving
                    ? 'שולח...'
                    : !isWeekOpen
                    ? 'השבוע סגור להגשות'
                    : existingSubmission
                    ? 'עדכן יום חופש'
                    : 'שלח'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
