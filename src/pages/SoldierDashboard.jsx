import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Calendar, ClipboardList, LogOut, User, Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import WeeklyScheduleView from "../components/soldier/WeeklyScheduleView";
import { User as UserEntity } from "../entities/User";

export default function SoldierDashboard() {
  const { user, signOut } = useAuth();
  const { soldierId } = useParams();
  const navigate = useNavigate();
  const [userMission, setUserMission] = useState(user?.mission);
  const [onStandby, setOnStandby] = useState(false);
  const [updatingStandby, setUpdatingStandby] = useState(false);
  const [hebrewName, setHebrewName] = useState(user?.hebrew_name || user?.displayName);

  // Security check: Ensure the soldier can only access their own dashboard
  useEffect(() => {
    if (user && soldierId && user.uid !== soldierId) {
      console.warn('SoldierDashboard: Access denied - soldier trying to access another soldier\'s dashboard');
      navigate(`/soldier/${user.uid}`, { replace: true });
      return;
    }
  }, [user, soldierId, navigate]);

  // Debug: Log user data to verify mission field and fetch from Firestore if missing
  useEffect(() => {
    if (user) {
      console.log('🔍 SoldierDashboard - User data:', user);
      console.log('🔍 SoldierDashboard - User mission:', user.mission);

      const fetchUserData = async () => {
        try {
          const userData = await UserEntity.me();
          console.log('✅ SoldierDashboard - Fetched user data from Firestore:', userData);

          if (userData.mission) {
            setUserMission(userData.mission);
            console.log('✅ SoldierDashboard - Set mission to:', userData.mission);
          } else if (!user.mission) {
            console.warn('⚠️ SoldierDashboard - User has no mission set in Firestore either. Please set it in Personal Details.');
          }

          // Set Hebrew name
          if (userData.hebrew_name) {
            setHebrewName(userData.hebrew_name);
            console.log('✅ SoldierDashboard - Set Hebrew name to:', userData.hebrew_name);
          }

          // Set standby status
          setOnStandby(userData.on_standby || false);
        } catch (error) {
          console.error('❌ SoldierDashboard - Failed to fetch user data:', error);
        }
      };

      fetchUserData();

      if (user.mission) {
        setUserMission(user.mission);
      }
    }
  }, [user]);

  const toggleStandby = async () => {
    setUpdatingStandby(true);
    try {
      const newStandbyStatus = !onStandby;
      await UserEntity.updateMyUserData({ on_standby: newStandbyStatus });
      setOnStandby(newStandbyStatus);
    } catch (error) {
      console.error('Error updating standby status:', error);
      alert('שגיאה בעדכון מצב כוננות');
    } finally {
      setUpdatingStandby(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };
  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header with Name and Logout */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
          <div className="relative flex items-center justify-center mb-4 min-h-[40px]">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 px-4">
              {hebrewName || 'חייל'}
            </h1>
            <Button onClick={handleLogout} variant="outline" size="sm" className="absolute left-0 top-0">
              <LogOut className="w-4 h-4 ml-1" />
              <span className="hidden sm:inline">יציאה</span>
            </Button>
          </div>

          {/* Standby Toggle Button */}
          <div className="flex justify-center">
            <Button
              onClick={toggleStandby}
              disabled={updatingStandby}
              size="lg"
              className={`
                flex items-center gap-2 min-w-[200px] transition-all duration-300
                ${onStandby
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'}
              `}
            >
              <Shield className="w-5 h-5" />
              {updatingStandby ? 'מעדכן...' : onStandby ? 'כוננות - פעיל' : 'כוננות - לא פעיל'}
            </Button>
          </div>
        </div>

        {/* Full Week Schedule */}
        <div className="mb-6">
          <WeeklyScheduleView soldierMission={userMission} />
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <ClipboardList className="w-5 h-5 text-green-600" />
                הגשת משמרות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3 text-center">בחר את המשמרות שאתה רוצה לעבוד לשבוע הבא</p>
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
              <CardTitle className="flex items-center justify-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                המשמרות שלי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3 text-center">צפה במשמרות שהוקצו לך ואשר אותן</p>
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
              <CardTitle className="flex items-center justify-center gap-2">
                <User className="w-5 h-5 text-purple-600" />
                פרטים אישיים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3 text-center">עדכן את הפרטים והציוד האישי שלך</p>
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



