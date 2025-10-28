import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Shield, FileText, Search, LogOut, Plus, Eye, ArrowLeftRight, Calendar, X, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../contexts/AuthContext";
import AddSoldierDialog from "../components/admin/AddSoldierDialog";
import SoldierDetailsDialog from "../components/admin/SoldierDetailsDialog";
import ExchangeRequestsDialog from "../components/admin/ExchangeRequestsDialog";
import SubmissionWindowsDialog from "../components/admin/SubmissionWindowsDialog";
import { db } from "../config/firebase";
import { collection, getDocs } from "firebase/firestore";
import { ShiftAssignment } from "../entities/ShiftAssignment";
import { format } from "date-fns";

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
  const [showExchangeRequestsDialog, setShowExchangeRequestsDialog] = useState(false);
  const [showSubmissionWindowsDialog, setShowSubmissionWindowsDialog] = useState(false);
  const [showStandbyReasonsDialog, setShowStandbyReasonsDialog] = useState(false);
  const [exchangeRequests, setExchangeRequests] = useState([]);

  useEffect(() => {
    loadSoldiers();
    loadExchangeRequests();
  }, []);

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
              standby_reason: data.standby_reason || null,
              standby_updated_at: data.standby_updated_at || null,
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

  const loadExchangeRequests = async () => {
    try {
      console.log('AdminDashboard: Loading exchange requests...');

      // Get all assignments with swap_requested status
      const allAssignments = await ShiftAssignment.list();
      const swapRequests = allAssignments.filter(a => a.status === 'swap_requested');

      console.log('AdminDashboard: Found exchange requests:', swapRequests);
      setExchangeRequests(swapRequests);
    } catch (error) {
      console.error('AdminDashboard: Error loading exchange requests:', error);
      setExchangeRequests([]);
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


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-6 mb-6">
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
          <Card
            className="p-4 bg-red-50 border-red-200 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => setShowStandbyReasonsDialog(true)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">לא בכוננות</p>
                <p className="text-2xl font-bold text-red-600">{soldiers.filter(s => !s.on_standby).length}</p>
                <p className="text-xs text-gray-500 mt-1">לחץ לצפייה בסיבות</p>
              </div>
              <Shield className="w-8 h-8 text-red-500" />
            </div>
          </Card>
          <Card
            className="p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-150"
            onClick={() => setShowExchangeRequestsDialog(true)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">בקשות החלפה</p>
                <p className="text-2xl font-bold text-orange-600">{exchangeRequests.length}</p>
              </div>
              <ArrowLeftRight className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
          <Card
            className="p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-150"
            onClick={() => setShowSubmissionWindowsDialog(true)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-purple-700">פתח/סגור הגשות</p>
                <p className="text-sm text-purple-600"> ניהול שבועות להגשה</p>
              </div>
              <Calendar className="w-10 h-10 text-purple-600" />
            </div>
          </Card>
          <Card
            className="p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-green-300 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-150"
            onClick={() => navigate('/shift-preferences')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-green-700">העדפות משמרות</p>
                <p className="text-sm text-green-600"> צפייה בהעדפות החיילים</p>
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
                <p className="text-sm text-blue-600"> יצירת וניהול סידור</p>
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

        <ExchangeRequestsDialog
          isOpen={showExchangeRequestsDialog}
          onClose={() => setShowExchangeRequestsDialog(false)}
          exchangeRequests={exchangeRequests}
          soldiers={soldiers}
          onRefresh={loadExchangeRequests}
        />

        <SubmissionWindowsDialog
          isOpen={showSubmissionWindowsDialog}
          onClose={() => setShowSubmissionWindowsDialog(false)}
        />

        {/* Standby Reasons Dialog */}
        {showStandbyReasonsDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowStandbyReasonsDialog(false)}>
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-600" />
                    חיילים לא בכוננות - סיבות
                  </CardTitle>
                  <button
                    onClick={() => setShowStandbyReasonsDialog(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-4">
                {soldiers.filter(s => !s.on_standby).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>כל החיילים בכוננות</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {soldiers
                      .filter(s => !s.on_standby)
                      .sort((a, b) => {
                        // Sort by update time, newest first
                        const aTime = a.standby_updated_at ? new Date(a.standby_updated_at) : new Date(0);
                        const bTime = b.standby_updated_at ? new Date(b.standby_updated_at) : new Date(0);
                        return bTime - aTime;
                      })
                      .map(soldier => (
                        <div key={soldier.id} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-red-600" />
                                <span className="font-semibold text-gray-900">
                                  {soldier.hebrew_name || soldier.displayName || soldier.full_name}
                                </span>
                                <Badge className="bg-red-100 text-red-800 text-xs">לא בכוננות</Badge>
                              </div>
                              {soldier.standby_reason ? (
                                <div className="bg-white p-3 rounded border border-red-200">
                                  <p className="text-sm font-medium text-gray-700 mb-1">סיבה:</p>
                                  <p className="text-sm text-gray-900">{soldier.standby_reason}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 italic">לא צוינה סיבה</p>
                              )}
                              {soldier.standby_updated_at && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    עודכן: {format(new Date(soldier.standby_updated_at), 'dd/MM/yyyy HH:mm')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}



