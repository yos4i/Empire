import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Home, Calendar, ClipboardList, LogOut, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function SoldierDashboard() {
  const { user, signOut } = useAuth();
  const { soldierId } = useParams();
  const navigate = useNavigate();

  // Security check: Ensure the soldier can only access their own dashboard
  useEffect(() => {
    if (user && soldierId && user.uid !== soldierId) {
      console.warn('SoldierDashboard: Access denied - soldier trying to access another soldier\'s dashboard');
      navigate(`/soldier/${user.uid}`, { replace: true });
      return;
    }
  }, [user, soldierId, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };
  return (
    <div className="p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Home className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">ברוך הבא, {user?.displayName}</h1>
                <p className="text-gray-600">דרגה: {user?.rank} | יחידה: {user?.unit?.replace('_', ' ')}</p>
              </div>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 ml-1" />
              יציאה
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                הסידור השבועי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">הסידור לשבוע הנוכחי עדיין לא פורסם</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-green-600" />
                הגשת משמרות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3">בחר את המשמרות שאתה רוצה לעבוד לשבוע הבא</p>
              <Button 
                size="sm" 
                onClick={() => navigate(`/soldier/${user?.uid}/shifts`)}
                className="w-full"
              >
                הגש משמרות
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5 text-purple-600" />
                פרטים אישיים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">עדכן את הפרטים והציוד האישי שלך</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>מערכת סידור אימפריה</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                ברוכים הבאים למערכת סידור העבודה המתקדמת. כאן תוכלו להגיש העדפות משמרות,
                לצפות בסידור השבועי ולנהל את הפרטים האישיים שלכם.
              </p>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>הערה:</strong> זוהי גרסת דמו של המערכת. כל הנתונים הם לצרכי הדגמה בלבד.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


