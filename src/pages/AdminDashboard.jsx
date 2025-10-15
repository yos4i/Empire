import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Shield, FileText, Search, AlertCircle, LogOut, Plus, Eye } from "lucide-react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import AddSoldierDialog from "../components/admin/AddSoldierDialog";
import { db } from "../config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function AdminDashboard() {
  const { user, signOut, addSoldier } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [soldiers, setSoldiers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUnit, setFilterUnit] = useState("הכל");
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [weekStart, setWeekStart] = useState("2025-10-19"); 


const loadSubmissions = async (weekStartStr) => {
  setLoadingSubmissions(true);
  try {
    // שולפים רק לשבוע הנבחר
    const q = query(
      collection(db, "shift_submissions"),
      where("week_start", "==", weekStartStr)
    );

    const snap = await getDocs(q);
    const rows = snap.docs.map(doc => {
      const d = doc.data();

      // מיפוי אחיד לשמות שה-UI מצפה להם
      return {
        id: doc.id,
        userName: d.userName || d.username || d.displayName || "", // הגנות
        userId: d.user_id || d.uid || d.soldier_id || "",          // 👈 היה אצלך userId
        days: d.days || {},                                        // map של ימים->מערכי סשנים
        shifts: d.shifts || {},                                    // אם אתה משתמש בזה במקום days
        updatedAt: d.updated_at?.toDate ? d.updated_at.toDate() 
                                        : (d.updated_at || new Date()),
        createdAt: d.created_at?.toDate ? d.created_at.toDate() 
                                        : (d.created_at || null),
        weekStart: d.week_start,                                   // "YYYY-MM-DD"
      };
    });

    setSubmissions(rows);
  } finally {
    setLoadingSubmissions(false);
  }
};
useEffect(() => {
  loadSubmissions(weekStart);
}, [weekStart]);

  useEffect(() => { loadSoldiers(); }, []);

  const loadSoldiers = async () => {
    setLoading(true);
    try {
      console.log('AdminDashboard: Loading soldiers...');
      
      // Load only real soldiers from Firestore
      let allSoldiers = [];

      // Load soldiers from Firestore only
      try {
        console.log('AdminDashboard: Loading soldiers from Firestore...');
        const soldiersSnapshot = await getDocs(collection(db, 'users'));
        allSoldiers = soldiersSnapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              hebrew_name: data.displayName,
              full_name: data.displayName,
              personal_number: data.personal_number,
              unit: data.unit,
              role: data.role === 'admin' ? 'admin' : 'user',
              is_active: data.is_active,
              rank: data.rank,
              equipment_status: data.equipment_status || 'מלא',
              constraints: data.constraints || {},
              weekly_shifts: data.weekly_shifts || {}
            };
          })
          .filter(user => user.role === 'user');
        console.log('AdminDashboard: Loaded soldiers from Firestore:', allSoldiers);
      } catch (firestoreError) {
        console.error('AdminDashboard: Error loading from Firestore:', firestoreError);
        allSoldiers = []; // Empty if Firestore fails
      }

      console.log('AdminDashboard: Final soldiers list:', allSoldiers);
      setSoldiers(allSoldiers);
    } catch (error) {
      console.error("AdminDashboard: Error loading soldiers:", error);
      setSoldiers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredSoldiers = soldiers.filter(soldier => {
    if (soldier.role !== 'user' || !soldier.is_active) return false;
    const matchesSearch = (soldier.hebrew_name || soldier.full_name)?.toLowerCase().includes(searchTerm.toLowerCase()) || soldier.personal_number?.includes(searchTerm);
    const matchesUnit = filterUnit === "הכל" || soldier.unit === filterUnit;
    return matchesSearch && matchesUnit;
  });
  
  console.log('AdminDashboard: Current soldiers list:', soldiers);
  console.log('AdminDashboard: Filtered soldiers:', filteredSoldiers);

  const handleAddSoldier = async (soldierData) => {
    try {
      console.log('AdminDashboard: Adding soldier', soldierData);
      const newSoldier = await addSoldier(soldierData);
      console.log('AdminDashboard: Soldier added successfully', newSoldier);
      
      // Reload the entire soldiers list to include the new Firestore entry
      await loadSoldiers();
      
      console.log('AdminDashboard: Reloaded soldiers list after adding new soldier');
    } catch (error) {
      console.error('AdminDashboard: Error adding soldier', error);
      throw error;
    }
  };


  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'מלא': return 'bg-green-100 text-green-800';
      case 'חסר': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">דשבורד מנהל</h1>
                <p className="text-gray-600">ברוך הבא, {user?.displayName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => navigate('/shift-preferences')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Eye className="w-4 h-4 ml-1" />
                צפייה בהעדפות
              </Button>
              <Button 
                onClick={() => navigate('/schedule-management')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <FileText className="w-4 h-4 ml-1" />
                ניהול סידור
              </Button>
              <Button onClick={handleLogout} variant="outline">
                <LogOut className="w-4 h-4 ml-1" />
                יציאה
              </Button>
            </div>
          </div>
          <p className="text-gray-600">ניהול כוח האדם ומעקב סטטוס</p>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">סה״כ חיילים</p>
                <p className="text-2xl font-bold text-gray-900">{soldiers.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">חיילים פעילים</p>
                <p className="text-2xl font-bold text-green-600">{soldiers.filter(s => s.is_active).length}</p>
              </div>
              <Shield className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">ציוד חסר</p>
                <p className="text-2xl font-bold text-red-600">{soldiers.filter(s => s.equipment_status === 'חסר').length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </Card>
          <Card 
            className="p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-green-300 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-150"
            onClick={() => navigate('/shift-preferences')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-green-700">העדפות משמרות</p>
                <p className="text-sm text-green-600">👁️ צפייה בהעדפות החיילים</p>
              </div>
              <Eye className="w-10 h-10 text-green-600" />
            </div>
          </Card>
          <Card 
            className="p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-150"
            onClick={() => navigate('/schedule-management')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-blue-700">ניהול סידור</p>
                <p className="text-sm text-blue-600">📝 יצירת וניהול סידור</p>
              </div>
              <FileText className="w-10 h-10 text-blue-600" />
            </div>
          </Card>
          <Card 
            className="p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-150"
            onClick={() => navigate('/advanced-schedule')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-purple-700">שיבוץ משמרות מתקדם</p>
                <p className="text-sm text-purple-600">🎯 גרור ושחרר + שיבוץ אוטומטי</p>
              </div>
              <Users className="w-10 h-10 text-purple-600" />
            </div>
          </Card>
        </div>

        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <h3 className="text-lg font-semibold">חיילי הכוח ({filteredSoldiers.length})</h3>
            </div>
            <Button 
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              הוסף חייל
            </Button>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="חיפוש לפי שם או מספר אישי..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10" />
            </div>
            <div className="flex gap-2">
              {["הכל", "קריית_חינוך", "גבולות"].map((unit) => (
                <Button key={unit} variant={filterUnit === unit ? "default" : "outline"} size="sm" onClick={() => setFilterUnit(unit)}>
                  {unit.replace("_", " ")}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 h-48 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSoldiers.map((soldier) => (
              <Card key={soldier.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">{soldier.hebrew_name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(soldier.equipment_status)}`}>
                      {soldier.equipment_status || 'לא ידוע'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>מ.א: {soldier.personal_number}</p>
                    <p>דרגה: {soldier.rank || 'לא ידועה'}</p>
                    <p>יחידה: {soldier.unit.replace('_', ' ')}</p>
                  </div>
                  <div className="pt-2 border-t">
                    <Button size="sm" variant="outline" className="w-full">צפה בפרטים</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {filteredSoldiers.length === 0 && !loading && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-500">אין חיילים מתאימים</h3>
            <p className="text-gray-400">נסה לשנות את תנאי החיפוש</p>
          </div>
        )}

        <AddSoldierDialog
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onAddSoldier={handleAddSoldier}
        />
      </div>
    </div>
  );
}



