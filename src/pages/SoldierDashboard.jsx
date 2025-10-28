import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Calendar, ClipboardList, LogOut, User, Shield, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import WeeklyScheduleView from "../components/soldier/WeeklyScheduleView";
import { User as UserEntity } from "../entities/User";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";

export default function SoldierDashboard() {
  const { user, signOut } = useAuth();
  const { soldierId } = useParams();
  const navigate = useNavigate();
  const [userMission, setUserMission] = useState(user?.mission);
  const [onStandby, setOnStandby] = useState(false);
  const [updatingStandby, setUpdatingStandby] = useState(false);
  const [hebrewName, setHebrewName] = useState(user?.hebrew_name || user?.displayName);
  const [showStandbyDialog, setShowStandbyDialog] = useState(false);
  const [standbyReason, setStandbyReason] = useState('');

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

  const handleStandbyClick = () => {
    // If turning OFF standby, show dialog to ask for reason
    if (onStandby) {
      setShowStandbyDialog(true);
    } else {
      // If turning ON standby, just toggle without asking
      toggleStandby(true, '');
    }
  };

  const toggleStandby = async (newStatus, reason = '') => {
    setUpdatingStandby(true);
    try {
      const updateData = {
        on_standby: newStatus,
        standby_reason: reason || null,
        standby_updated_at: new Date().toISOString()
      };

      console.log('🔍 SoldierDashboard - Sending standby update:', updateData);
      console.log('🔍 SoldierDashboard - Reason value:', reason);
      console.log('🔍 SoldierDashboard - Reason truthy?', !!reason);

      await UserEntity.updateMyUserData(updateData);

      console.log('✅ SoldierDashboard - Update completed successfully');

      setOnStandby(newStatus);
      setShowStandbyDialog(false);
      setStandbyReason('');
    } catch (error) {
      console.error('❌ SoldierDashboard - Error updating standby status:', error);
      alert('שגיאה בעדכון מצב כוננות');
    } finally {
      setUpdatingStandby(false);
    }
  };

  const handleConfirmStandbyOff = () => {
    if (!standbyReason.trim()) {
      alert('נא להזין סיבה');
      return;
    }
    toggleStandby(false, standbyReason);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };
  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen w-full overflow-x-hidden" dir="rtl">
      <div className="max-w-6xl mx-auto w-full">
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
              onClick={handleStandbyClick}
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

      {/* Standby Reason Dialog */}
      {showStandbyDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowStandbyDialog(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-600" />
                  ביטול כוננות
                </CardTitle>
                <button
                  onClick={() => setShowStandbyDialog(false)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                אתה עומד לבטל את מצב הכוננות. נא להסביר את הסיבה (למשל: חופשה, מילואים, וכו')
              </p>

              <div className="space-y-2">
                <Label htmlFor="standby-reason" className="text-sm font-semibold">
                  סיבת ביטול הכוננות <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="standby-reason"
                  value={standbyReason}
                  onChange={(e) => setStandbyReason(e.target.value)}
                  placeholder="לדוגמה: אני בחופשה עד תאריך 15/11..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  הסיבה תועבר למנהל ותוצג בדשבורד
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleConfirmStandbyOff}
                  disabled={!standbyReason.trim() || updatingStandby}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {updatingStandby ? 'מעדכן...' : 'אשר ביטול כוננות'}
                </Button>
                <Button
                  onClick={() => setShowStandbyDialog(false)}
                  variant="outline"
                  disabled={updatingStandby}
                >
                  ביטול
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}



