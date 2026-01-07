import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SubmissionWindow } from "../entities/SubmissionWindow";
import { ClipboardList, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { addDays, addWeeks, format } from "date-fns";
import { toWeekStartISO, getDefaultWeekStart } from '../utils/weekKey';
import { useAuth } from "../contexts/AuthContext";
import { ShiftSubmissionService } from '../services/shiftSubmission';


export default function ShiftSubmissionPage() {
  const { soldierId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // New state for day-off request system
  const [selectedDayOff, setSelectedDayOff] = useState(null); // "sunday", "monday", etc. or null
  const [additionalNotes, setAdditionalNotes] = useState(''); // Additional soldier notes
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isWeekOpen, setIsWeekOpen] = useState(false);
  const [checkingWeekStatus, setCheckingWeekStatus] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = next week

  // Security check: Ensure the soldier can only access their own route
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
      // Check if week is open for submissions
      const weekOpen = await SubmissionWindow.isWeekOpen(nextWeekStartStr);
      setIsWeekOpen(weekOpen);
      console.log('📅 ShiftSubmissionPage: Week', nextWeekStartStr, 'is', weekOpen ? 'OPEN' : 'CLOSED', 'for submissions');
      setCheckingWeekStatus(false);

      // Try to load day-off request
      const dayOffData = await ShiftSubmissionService.getDayOffRequest(user.uid, nextWeekStartStr);

      if (dayOffData) {
        console.log('✅ ShiftSubmissionPage: Loaded day-off request:', dayOffData);
        setExistingSubmission(dayOffData);
        setSelectedDayOff(dayOffData.dayOffRequest);

        // Extract additional notes (remove the auto-generated part)
        const notes = dayOffData.notes || '';
        const additionalNotesMatch = notes.match(/הערות נוספות:\n([\s\S]*)/);
        setAdditionalNotes(additionalNotesMatch ? additionalNotesMatch[1] : '');
      } else {
        // No submission found - clear form
        console.log('🔄 ShiftSubmissionPage: No day-off request found for week', nextWeekStartStr);
        setExistingSubmission(null);
        setSelectedDayOff(null);
        setAdditionalNotes('');
      }
    } catch (e) {
      console.error("Error loading data", e);
    }
    setLoading(false);
  }, [nextWeekStartStr, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Removed old validation and toggle functions - no longer needed for day-off system


const handleSubmit = async () => {
  // Check if week is open
  if (!isWeekOpen) {
    alert('השבוע סגור להגשת בקשות. אנא פנה למנהל.');
    return;
  }

  // Validation: must select a day off
  if (!selectedDayOff) {
    alert('יש לבחור יום חופש אחד');
    return;
  }

  setSaving(true);
  try {
    // Submit day-off request
    await ShiftSubmissionService.submitDayOffRequest(
      user.uid,
      user.displayName || user.username || user.hebrew_name,
      nextWeekStartStr,
      selectedDayOff,
      additionalNotes
    );

    alert('בקשת יום חופש נשלחה בהצלחה!');
    navigate(`/soldier/${user.uid}`);
  } catch (error) {
    console.error('Error submitting day-off request:', error);
    alert('שגיאה בשליחת הבקשה: ' + error.message);
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
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen w-full overflow-x-hidden" dir="rtl">
      <div className="max-w-7xl mx-auto w-full">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-center mb-6 w-full">
            <div className="text-center flex-1 w-full">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">העדפות משמרות</h1>
              <div className="flex items-center justify-center gap-3 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekOffset(prev => prev - 1)}
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
                  onClick={() => setWeekOffset(prev => prev + 1)}
                  disabled={weekOffset >= 4}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
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
            {/* Day Off Selection UI */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">בחר יום חופש אחד</CardTitle>
                <p className="text-sm text-gray-600 mt-2">
                  בחר יום אחד בשבוע בו תרצה לקבל חופש
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'sunday', name: 'ראשון' },
                    { key: 'monday', name: 'שני' },
                    { key: 'tuesday', name: 'שלישי' },
                    { key: 'wednesday', name: 'רביעי' },
                    { key: 'thursday', name: 'חמישי' },
                    { key: 'friday', name: 'שישי' },
                    { key: 'saturday', name: 'שבת' }
                  ].map(({ key, name }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedDayOff(key)}
                      disabled={!isWeekOpen}
                      className={`
                        p-4 rounded-lg border-2 transition-all font-medium text-base
                        ${selectedDayOff === key
                          ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }
                        ${!isWeekOpen ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      יום {name}
                    </button>
                  ))}
                </div>

                {selectedDayOff && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-green-800 font-medium">
                      ✓ נבחר: יום {
                        { sunday: 'ראשון', monday: 'שני', tuesday: 'שלישי', wednesday: 'רביעי',
                          thursday: 'חמישי', friday: 'שישי', saturday: 'שבת' }[selectedDayOff]
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Notes Section */}
            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">הערות נוספות (אופציונלי)</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    אפשר להוסיף הערות או בקשות נוספות למנהל
                  </p>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    disabled={!isWeekOpen}
                    placeholder="לדוגמה: תור לרופא, בקשה מיוחדת..."
                    className="w-full min-h-[120px] p-3 border-2 border-gray-200 rounded-lg resize-y focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:bg-gray-100"
                    maxLength={500}
                  />
                  <div className="text-xs text-gray-500 mt-2 text-left">
                    {additionalNotes.length}/500 תווים
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Submit Button */}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                onClick={handleSubmit}
                disabled={saving || !isWeekOpen || !selectedDayOff}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "שולח..." : !isWeekOpen ? "השבוע סגור להגשות" : !selectedDayOff ? "יש לבחור יום חופש" : existingSubmission ? "עדכן בקשה" : "שלח בקשה"}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">הנחיות</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700 space-y-2">
                <p>• בחר יום חופש אחד לשבוע</p>
                <p>• ניתן להוסיף הערות נוספות (אופציונלי)</p>
                <p>• הבקשה תישלח למנהל לאישור</p>
                <p>• ניתן לעדכן את הבקשה עד סגירת השבוע</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}



