import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "../entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { User as UserIcon, Shield, Save, AlertCircle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";
import { useAuth } from "../contexts/AuthContext";

export default function MyStatusPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    hebrew_name: "",
    personal_number: "",
    weapon_number: "",
    unit: "",
    rank: "חייל",
    is_driver: false,
    magazines: 0,
    equipment: { vest: false, helmet: false, weapon: false }
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => { loadUserData(); }, []);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const user = await User.me();
      setFormData({
        hebrew_name: user.hebrew_name || user.full_name || "",
        personal_number: user.personal_number || "",
        weapon_number: user.weapon_number || "",
        unit: user.unit || "",
        rank: user.rank || "חייל",
        is_driver: user.is_driver || false,
        home_location: user.home_location || "",
        mother_unit: user.mother_unit || "",
        rifleman: user.rifleman || "",
        mission: user.mission || "",
        magazines: user.magazines || 0,
        equipment: {
          vest: user.equipment?.vest || false,
          helmet: user.equipment?.helmet || false,
          weapon: user.equipment?.weapon || false
        }
      });
    } catch (error) {
      console.error("שגיאה בטעינת נתוני המשתמש:", error);
    }
    setLoading(false);
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    setMessage("");
    try {
      await User.updateMyUserData(formData);
      setMessage("הפרטים עודכנו בהצלחה!");

      // Reload user data to show the updated values in the form
      await loadUserData();

      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("שגיאה בעדכון הפרטים:", error);
      setMessage("שגיאה בעדכון הפרטים");
    }
    setSaving(false);
  };

  const handleEquipmentChange = (equipmentType, checked) => {
    setFormData(prev => ({ ...prev, equipment: { ...prev.equipment, [equipmentType]: Boolean(checked) } }));
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check if this is a new user with minimal details
  const isNewUser = !formData.hebrew_name || !formData.personal_number || !formData.rank;

  return (
    <div className="p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="relative flex items-center justify-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(`/soldier/${user?.uid}`)}
              className="absolute left-0"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{formData.hebrew_name || 'שלומי ממן'}</h1>
          </div>
        </div>

        {/* Welcome message for new users */}
        {isNewUser && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>ברוך הבא!</strong> זו ההתחברות הראשונה שלך. אנא מלא את כל הפרטים האישיים והציוד שלך למטה ולחץ על "שמור פרטים אישיים" בסוף הדף.
            </AlertDescription>
          </Alert>
        )}

        {message && (
          <Alert className={`${message.includes("שגיאה") ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"} mb-6`}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <UserIcon className="w-5 h-5" />
                פרטים אישיים
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="hebrew_name" className="text-center block">שם מלא</Label>
                <Input id="hebrew_name" value={formData.hebrew_name} onChange={(e) => setFormData(prev => ({...prev, hebrew_name: e.target.value}))} placeholder="הכנס שם מלא בעברית" className="text-center" />
              </div>
              <div>
                <Label htmlFor="personal_number" className="text-center block">מספר אישי</Label>
                <Input id="personal_number" value={formData.personal_number} onChange={(e) => setFormData(prev => ({...prev, personal_number: e.target.value}))} placeholder="הכנס מספר אישי" className="text-center" />
              </div>
              <div>
                <Label htmlFor="weapon_number" className="text-center block">מספר נשק</Label>
                <Input id="weapon_number" value={formData.weapon_number} onChange={(e) => setFormData(prev => ({...prev, weapon_number: e.target.value}))} placeholder="הכנס מספר נשק" className="text-center" />
              </div>
              <div>
                <Label htmlFor="home_location" className="text-center block">מיקום מגורים</Label>
                <Input id="home_location" value={formData.home_location} onChange={(e) => setFormData(prev => ({...prev, home_location: e.target.value}))} placeholder="מיקום מגורים" className="text-center" />
              </div>
              <div>
                <Label htmlFor="mother_unit" className="text-center block">יחידת אם</Label>
                <Input id="mother_unit" value={formData.mother_unit} onChange={(e) => setFormData(prev => ({...prev, mother_unit: e.target.value}))} placeholder="יחידת אם" className="text-center" />
              </div>
              <div>
                <Label htmlFor="rifleman" className="text-center block">רובאי</Label>
                <Input id="rifleman" value={formData.rifleman} onChange={(e) => setFormData(prev => ({...prev, rifleman: e.target.value}))} placeholder="רובאי" className="text-center" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <Shield className="w-5 h-5" />
                ציוד חתום
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {['vest', 'helmet', 'weapon', 'magazines'].map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-center space-x-2"
                  >
                    {key === 'magazines' ? (
                      <>
                        <Checkbox
                          id={key}
                          checked={formData.equipment[key] > 0}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              equipment: {
                                ...prev.equipment,
                                magazines: checked ? 1 : 0, // אם מסומן, ברירת מחדל 1
                              },
                            }))
                          }
                        />
                        <Label htmlFor={key} className="mr-2">
                          מחסניות
                        </Label>
                        {formData.equipment.magazines > 0 && (
                          <Input
                            id="magazines"
                            type="number"
                            min="1"
                            max="7"
                            value={formData.equipment.magazines}
                            onChange={(e) => {
                              const value = Math.min(
                                7,
                                Math.max(1, parseInt(e.target.value) || 0)
                              );
                              setFormData((prev) => ({
                                ...prev,
                                equipment: { ...prev.equipment, magazines: value },
                              }));
                            }}
                            placeholder="1-7"
                            className="w-16 text-center"
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <Checkbox
                          id={key}
                          checked={formData.equipment[key]}
                          onCheckedChange={(checked) =>
                            handleEquipmentChange(key, checked)
                          }
                        />
                        <Label htmlFor={key} className="mr-2">
                          {key === 'vest'
                            ? 'ווסט'
                            : key === 'helmet'
                            ? 'קסדה'
                            : 'נשק'}
                        </Label>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="mt-8 flex justify-end">
          <Button onClick={handleSaveDetails} disabled={saving} size="lg" className="bg-blue-600 hover:bg-blue-700">
            {saving ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>שומר...</>) : (<><Save className="w-4 h-4 mr-2" />שמור פרטים אישיים</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}



