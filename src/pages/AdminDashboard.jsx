import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Shield, FileText, Search, LogOut, Plus, Eye } from "lucide-react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import AddSoldierDialog from "../components/admin/AddSoldierDialog";
import SoldierDetailsDialog from "../components/admin/SoldierDetailsDialog";
import { db } from "../config/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function AdminDashboard() {
  const { signOut, addSoldier, deleteSoldier } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };
  const [soldiers, setSoldiers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUnit, setFilterUnit] = useState("הכל");
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false); 
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
              hebrew_name: data.displayName || data.hebrew_name || data.username || 'חייל חדש',
              full_name: data.displayName || data.hebrew_name || data.username || 'חייל חדש',
              personal_number: data.personal_number || 'לא מולא',
              unit: data.mission || data.unit || 'לא מולא', // Use mission field (new) or unit (old)
              role: data.role === 'admin' ? 'admin' : 'user',
              is_active: data.is_active !== false, // Default to true if not set
              rank: data.rank || 'לא מולא',
              mission: data.mission,
              mother_unit: data.mother_unit,
              equipment_status: data.equipment_status || 'לא מולא',
              constraints: data.constraints || {},
              weekly_shifts: data.weekly_shifts || {},
              uid: data.uid,
              username: data.username,
              weapon_number: data.weapon_number,
              is_driver: data.is_driver,
              equipment: data.equipment,
              on_standby: data.on_standby || false,
              created_at: data.created_at,
              updated_at: data.updated_at
            };
          })
          .filter(user => user.role === 'user' && user.is_active);
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

  const handleViewDetails = (soldier) => {
    setSelectedSoldier(soldier);
    setShowDetailsDialog(true);
  };

  const filteredSoldiers = soldiers.filter(soldier => {
    const matchesSearch = (soldier.hebrew_name || soldier.full_name || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (soldier.personal_number || '')?.includes(searchTerm) ||
                         (soldier.username || '')?.toLowerCase().includes(searchTerm.toLowerCase());
    // Check both mission and unit fields for filtering
    const soldierUnit = soldier.mission || soldier.unit;
    const matchesUnit = filterUnit === "הכל" || soldierUnit === filterUnit || soldierUnit === 'לא מולא' || !soldierUnit;
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

  const handleDeleteSoldier = async (soldier) => {
    try {
      console.log('AdminDashboard: Deleting soldier', soldier);
      await deleteSoldier(soldier);
      console.log('AdminDashboard: Soldier deleted successfully');

      // Reload the soldiers list after deletion
      await loadSoldiers();

      console.log('AdminDashboard: Reloaded soldiers list after deleting soldier');
    } catch (error) {
      console.error('AdminDashboard: Error deleting soldier', error);
      throw error;
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <h1 className="text-3xl font-bold text-gray-900 absolute left-1/2 -translate-x-1/2 top-4">
              דשבורד מנהל
            </h1>

            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 ml-1" />
              יציאה
            </Button>
          </div>
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
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">בכוננות</p>
                <p className="text-2xl font-bold text-green-600">{soldiers.filter(s => s.on_standby).length}</p>
              </div>
              <Shield className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">לא בכוננות</p>
                <p className="text-2xl font-bold text-red-600">{soldiers.filter(s => !s.on_standby).length}</p>
              </div>
              <Shield className="w-8 h-8 text-red-500" />
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
        </div>

        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <h3 className="text-lg font-semibold">חיילי הכוח ({filteredSoldiers.length})</h3>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowAddDialog(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                הוסף חייל
              </Button>
            </div>
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
            {filteredSoldiers.map((soldier) => {
              // Check if soldier has filled basic details
              const hasFilledDetails = soldier.home_location ||
                                       soldier.mission ||
                                       soldier.mother_unit ||
                                       soldier.personal_number !== 'לא מולא' ||
                                       soldier.rifleman;

              return (
                <Card key={soldier.id} className={`p-4 ${soldier.on_standby ? 'border-2 border-green-400' : ''}`}>
                  <div className="space-y-3">
                    {/* Centered soldier name */}
                    <div className="text-center">
                      <h4 className="font-semibold text-lg text-gray-900">{soldier.hebrew_name}</h4>
                    </div>

                    {/* Status badges below name */}
                    <div className="flex justify-center gap-2">
                      {!hasFilledDetails && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          לא מולא
                        </span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${soldier.on_standby ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        <Shield className="w-3 h-3" />
                        {soldier.on_standby ? 'בכוננות' : 'לא בכוננות'}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>מ.א: {soldier.personal_number || 'לא מולא'}</p>
                      <p>דרגה: {soldier.rank || 'לא מולא'}</p>
                      <p>יחידה: {soldier.unit ? soldier.unit.replace('_', ' ') : 'לא מולא'}</p>
                    </div>

                    {/* View details button */}
                    <div className="pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleViewDetails(soldier)}
                      >
                        צפה בפרטים
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
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

        <SoldierDetailsDialog
          isOpen={showDetailsDialog}
          onClose={() => {
            setShowDetailsDialog(false);
            setSelectedSoldier(null);
          }}
          soldier={selectedSoldier}
          onDelete={handleDeleteSoldier}
        />
      </div>
    </div>
  );
}



