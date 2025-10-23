import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { CheckCircle, AlertTriangle, Eye, Save } from 'lucide-react';
import {
  previewCurrentRequirements,
  updateShiftRequirements
} from '../utils/updateShiftRequirements';

export default function UpdateShiftRequirementsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      await previewCurrentRequirements();
      setResult({ message: 'בדוק את הקונסול לפרטים' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!window.confirm('האם אתה בטוח? פעולה זו תעדכן את דרישות החיילים:\n\n- גבולות בוקר: 6 → 4 חיילים\n\nהמשך?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await updateShiftRequirements();
      if (data.success) {
        setResult({ message: 'דרישות המשמרות עודכנו בהצלחה!' });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">עדכון דרישות משמרות</h1>

      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertTitle className="text-blue-900">מה עושה כלי זה?</AlertTitle>
        <AlertDescription className="text-blue-800">
          <p className="mb-2">
            כלי זה מעדכן את מספר החיילים הנדרש לכל סוג משמרת במסד הנתונים.
          </p>
          <p className="mb-2">
            <strong>שינויים מתוכננים:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>גבולות בוקר: 6 → 4 חיילים (כל הימים)</li>
            <li>קריית חינוך בוקר: נשאר 18 חיילים</li>
            <li>קריית חינוך ערב: נשאר 6 חיילים</li>
          </ul>
        </AlertDescription>
      </Alert>

      <Alert className="mb-6 bg-yellow-50 border-yellow-200">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <AlertTitle className="text-yellow-900">לגבי שישי - 12 חיילים</AlertTitle>
        <AlertDescription className="text-yellow-800">
          <p className="mb-2">
            המערכת כרגע משתמשת בדרישה <strong>גלובלית</strong> לכל משמרת (לא משתנה לפי יום).
          </p>
          <p className="mb-2">
            כדי שבשישי יהיו 12 חיילים בקריית חינוך במקום 18, יש שתי אפשרויות:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>ליצור סוג משמרת נפרד לשישי ("קריית_חינוך_שישי")</li>
            <li>לשנות את הדרישה הגלובלית ל-12 (ואז <strong>כל הימים</strong> יהיו 12)</li>
          </ol>
          <p className="mt-2">
            <strong>המלצה:</strong> השאר את קריית חינוך בוקר על 18, ועדכן ידנית בלוח השבועי לפי צורך.
          </p>
        </AlertDescription>
      </Alert>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>תצוגה מקדימה</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handlePreview}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            <Eye className="w-4 h-4 ml-2" />
            {loading ? 'טוען...' : 'הצג דרישות נוכחיות'}
          </Button>
          <p className="mt-2 text-sm text-gray-600">
            פתח את הקונסול (F12) כדי לראות את הדרישות הנוכחיות
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>עדכן דרישות</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleUpdate}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 ml-2" />
            {loading ? 'מעדכן...' : 'עדכן דרישות משמרות'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-900">הצלחה!</AlertTitle>
          <AlertDescription className="text-green-800">
            {result.message}
            <p className="mt-2 text-sm">
              רענן את דף ניהול הלו"ז כדי לראות את השינויים
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
          <li>לחץ על "הצג דרישות נוכחיות" ובדוק בקונסול (F12)</li>
          <li>לחץ על "עדכן דרישות משמרות"</li>
          <li>אשר את העדכון</li>
          <li>רענן את דף ניהול הלו"ז</li>
        </ol>
        <p className="mt-3 text-sm font-semibold">
          שים לב: השינויים ישפיעו על <strong>כל השבועות</strong> (לא רק השבוע הנוכחי)
        </p>
      </div>
    </div>
  );
}
