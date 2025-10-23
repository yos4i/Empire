import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { AlertTriangle, CheckCircle, Eye, RefreshCw, Trash2 } from 'lucide-react';
import {
  previewFixes,
  fixAllWeekMismatches,
  deleteWrongWeekAssignments,
  fixShiftPreferences,
  fixShiftSubmissions,
  fixShiftAssignments
} from '../utils/fixWeekMismatch';

export default function FixWeekMismatchPage() {
  const [preview, setPreview] = useState(null);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handlePreview = async () => {
    setFixing(true);
    setError(null);
    try {
      const data = await previewFixes();
      setPreview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setFixing(false);
    }
  };

  const handleFixAll = async () => {
    if (!window.confirm('האם אתה בטוח שברצונך לתקן את כל הנתונים? פעולה זו תעדכן את השבוע מ-2025-10-19 ל-2025-10-26')) {
      return;
    }

    setFixing(true);
    setError(null);
    setResult(null);
    try {
      const data = await fixAllWeekMismatches();
      setResult(data);
      setPreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setFixing(false);
    }
  };

  const handleDeleteWrongWeek = async () => {
    if (!window.confirm('⚠️ האם אתה בטוח? פעולה זו תמחק את כל השיבוצים לשבוע 2025-10-19 ולא ניתן יהיה לשחזר אותם!')) {
      return;
    }

    setFixing(true);
    setError(null);
    setResult(null);
    try {
      const data = await deleteWrongWeekAssignments();
      setResult({ deleted: data });
      setPreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setFixing(false);
    }
  };

  const handleFixIndividual = async (type) => {
    setFixing(true);
    setError(null);
    try {
      let data;
      if (type === 'preferences') {
        data = await fixShiftPreferences();
      } else if (type === 'submissions') {
        data = await fixShiftSubmissions();
      } else if (type === 'assignments') {
        data = await fixShiftAssignments();
      }
      setResult({ [type]: data });
    } catch (err) {
      setError(err.message);
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">תיקון באג תאריכי השבוע</h1>

      <Alert className="mb-6 bg-yellow-50 border-yellow-200">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <AlertTitle className="text-yellow-900">תיקון נתונים</AlertTitle>
        <AlertDescription className="text-yellow-800">
          <p className="mb-2">
            עקב באג בממשק, חיילים הגישו העדפות לשבוע הלא נכון.
          </p>
          <p className="mb-2">
            <strong>שבוע שגוי:</strong> 19/10/2025 - 26/10/2025
            <br />
            <strong>שבוע נכון:</strong> 26/10/2025 - 02/11/2025
          </p>
          <p>
            כלי זה יעזור לך לתקן את הנתונים במסד הנתונים.
          </p>
        </AlertDescription>
      </Alert>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>שלב 1: תצוגה מקדימה</CardTitle>
          <CardDescription>
            ראה כמה רשומות יושפעו לפני ביצוע התיקון
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handlePreview}
            disabled={fixing}
            variant="outline"
            className="w-full"
          >
            <Eye className="w-4 h-4 ml-2" />
            {fixing ? 'טוען...' : 'הצג תצוגה מקדימה'}
          </Button>

          {preview && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <h3 className="font-semibold mb-2">תצוגה מקדימה:</h3>
              <ul className="space-y-1 text-sm">
                <li>📋 העדפות (shift_preferences): {preview.preferences} רשומות</li>
                <li>📋 הגשות (shift_submissions): {preview.submissions} רשומות</li>
                <li>📋 שיבוצים (shift_assignments): {preview.assignments} רשומות</li>
                <li className="font-semibold pt-2 border-t border-blue-300">
                  סה"כ: {preview.total} רשומות יעודכנו
                </li>
              </ul>
              <p className="mt-2 text-xs text-blue-700">
                בדוק את הקונסול של הדפדפן לפרטים מלאים (F12 → Console)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>שלב 2: בחר אפשרות תיקון</CardTitle>
          <CardDescription>
            יש לך שתי אפשרויות: תקן את הנתונים או מחק אותם
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h3 className="font-semibold mb-2">אפשרות א': תקן את הנתונים</h3>
            <p className="text-sm text-gray-600 mb-3">
              העבר את כל ההעדפות והשיבוצים לשבוע הנכון (הוסף 7 ימים לכל התאריכים)
            </p>
            <div className="space-y-2">
              <Button
                onClick={handleFixAll}
                disabled={fixing}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                {fixing ? 'מתקן...' : 'תקן הכל (מומלץ)'}
              </Button>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => handleFixIndividual('preferences')}
                  disabled={fixing}
                  variant="outline"
                  size="sm"
                >
                  תקן העדפות בלבד
                </Button>
                <Button
                  onClick={() => handleFixIndividual('submissions')}
                  disabled={fixing}
                  variant="outline"
                  size="sm"
                >
                  תקן הגשות בלבד
                </Button>
                <Button
                  onClick={() => handleFixIndividual('assignments')}
                  disabled={fixing}
                  variant="outline"
                  size="sm"
                >
                  תקן שיבוצים בלבד
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2 text-red-600">אפשרות ב': מחק את הנתונים</h3>
            <p className="text-sm text-gray-600 mb-3">
              מחק את כל השיבוצים לשבוע השגוי. החיילים יצטרכו להגיש העדפות מחדש.
            </p>
            <Button
              onClick={handleDeleteWrongWeek}
              disabled={fixing}
              variant="destructive"
              className="w-full"
            >
              <Trash2 className="w-4 h-4 ml-2" />
              {fixing ? 'מוחק...' : 'מחק שיבוצים לשבוע השגוי'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-900">התיקון הושלם בהצלחה!</AlertTitle>
          <AlertDescription className="text-green-800">
            <pre className="mt-2 text-xs bg-white p-2 rounded">
              {JSON.stringify(result, null, 2)}
            </pre>
            <p className="mt-2 text-sm">
              בדוק את הקונסול לפרטים מלאים
            </p>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-900">שגיאה</AlertTitle>
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded">
        <h3 className="font-semibold mb-2">הוראות שימוש:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>לחץ על "הצג תצוגה מקדימה" כדי לראות כמה רשומות יושפעו</li>
          <li>פתח את הקונסול (F12) כדי לראות פרטים מלאים</li>
          <li>בחר אפשרות תיקון:
            <ul className="list-disc list-inside mr-6 mt-1">
              <li><strong>תקן הכל:</strong> העבר את כל הנתונים לשבוע הנכון (מומלץ)</li>
              <li><strong>מחק:</strong> מחק את השיבוצים והתחל מחדש</li>
            </ul>
          </li>
          <li>לאחר התיקון, רענן את דף ניהול הלו"ז כדי לראות את השינויים</li>
        </ol>
      </div>
    </div>
  );
}
