import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Calendar, ClipboardList, LogOut, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import WeeklyScheduleView from "../components/soldier/WeeklyScheduleView";

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

  // Debug: Log user data to verify mission field
  useEffect(() => {
    if (user) {
      console.log('🔍 SoldierDashboard - User data:', user);
      console.log('🔍 SoldierDashboard - User mission:', user.mission);
    }
  }, [user]);

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
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{user?.displayName}</h1>
              </div>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 ml-1" />
              יציאה
            </Button>
          </div>
        </div>

        {/* Full Week Schedule */}
        <div className="mb-6">
          <WeeklyScheduleView soldierMission={user?.mission} />
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6">
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
                <Calendar className="w-5 h-5 text-blue-600" />
                המשמרות שלי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3">צפה במשמרות שהוקצו לך ואשר אותן</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/soldier/${user?.uid}/assignments`)}
                className="w-full"
              >
                צפה במשמרות
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-purple-600" />
                פרטים אישיים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3">עדכן את הפרטים והציוד האישי שלך</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/soldier/${user?.uid}/status`)}
                className="w-full"
              >
                עדכן פרטים
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}



