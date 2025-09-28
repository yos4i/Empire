import React, { useState, useEffect } from "react";
import { User } from "../entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { User as UserIcon, Shield, Save, AlertCircle, Car, Key, EyeOff, Eye } from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";

export default function MyStatusPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    hebrew_name: "",
    personal_number: "",
    weapon_number: "",
    radio_number: "",
    unit: "",
    rank: "חייל",
    is_driver: false,
    equipment: { vest: false, helmet: false, radio: false, weapon: false }
  });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => { loadUserData(); }, []);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);
      setFormData({
        hebrew_name: user.hebrew_name || user.full_name || "",
        personal_number: user.personal_number || "",
        weapon_number: user.weapon_number || "",
        radio_number: user.radio_number || "",
        unit: user.unit || "",
        rank: user.rank || "חייל",
        is_driver: user.is_driver || false,
        equipment: {
          vest: user.equipment?.vest || false,
          helmet: user.equipment?.helmet || false,
          radio: user.equipment?.radio || false,
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
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("שגיאה בעדכון הפרטים:", error);
      setMessage("שגיאה בעדכון הפרטים");
    }
    setSaving(false);
  };

  const handlePasswordChange = async () => {
    setPasswordMessage("");
    if(!passwordData.currentPassword) { setPasswordMessage("יש להזין את הסיסמה הנוכחית."); return; }
    if(passwordData.newPassword.length < 6) { setPasswordMessage("סיסמה חדשה חייבת להיות לפחות 6 תווים."); return; }
    if (passwordData.newPassword !== passwordData.confirmPassword) { setPasswordMessage("הסיסמאות החדשות אינן תואמות."); return; }
    setSaving(true);
    try {
      await User.updateMyUserData({ password_hash: passwordData.newPassword, password_changed_at: new Date().toISOString() });
      setPasswordMessage("הסיסמה שונתה בהצלחה!");
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordMessage(""), 3000);
    } catch (error) {
      console.error("שגיאה בשינוי הסיסמה:", error);
      setPasswordMessage("שגיאה בשינוי הסיסמה.");
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

  return (
    <div className="p-6 bg-gray-50 min-h-screen" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <UserIcon className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">הפרופיל שלי</h1>
          </div>
          <p className="text-gray-600">עדכן את הפרטים והציוד שלך</p>
        </div>

        {message && (
          <Alert className={`${message.includes("שגיאה") ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"} mb-6`}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5" />
                פרטים אישיים
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="hebrew_name">שם מלא (עברית)</Label>
                <Input id="hebrew_name" value={formData.hebrew_name} onChange={(e) => setFormData(prev => ({...prev, hebrew_name: e.target.value}))} placeholder="הכנס שם מלא בעברית" />
              </div>
              <div>
                <Label htmlFor="personal_number">מספר אישי</Label>
                <Input id="personal_number" value={formData.personal_number} onChange={(e) => setFormData(prev => ({...prev, personal_number: e.target.value}))} placeholder="הכנס מספר אישי" />
              </div>
              <div>
                <Label htmlFor="weapon_number">מספר נשק</Label>
                <Input id="weapon_number" value={formData.weapon_number} onChange={(e) => setFormData(prev => ({...prev, weapon_number: e.target.value}))} placeholder="הכנס מספר נשק" />
              </div>
              <div>
                <Label htmlFor="radio_number">מספר קשר</Label>
                <Input id="radio_number" value={formData.radio_number} onChange={(e) => setFormData(prev => ({...prev, radio_number: e.target.value}))} placeholder="הכנס מספר קשר" />
              </div>
              <div>
                <Label htmlFor="unit">יחידה</Label>
                <Select value={formData.unit} onValueChange={(value) => setFormData(prev => ({...prev, unit: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר יחידה" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="קריית_חינוך">קריית חינוך</SelectItem>
                    <SelectItem value="גבולות">גבולות</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rank">דרגה</Label>
                <Select value={formData.rank} onValueChange={(value) => setFormData(prev => ({...prev, rank: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר דרגה" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="חייל">חייל</SelectItem>
                    <SelectItem value="רב_טוראי">רב טוראי</SelectItem>
                    <SelectItem value="סמל">סמל</SelectItem>
                    <SelectItem value="רס_פ">רס״פ</SelectItem>
                    <SelectItem value="מפקד">מפקד</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="is_driver" checked={formData.is_driver} onCheckedChange={(checked) => setFormData(prev => ({...prev, is_driver: Boolean(checked)}))} />
                <Label htmlFor="is_driver" className="flex items-center gap-2 mr-2">
                  <Car className="w-4 h-4"/>
                  אני נהג/ת
                </Label>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  ציוד חתום
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {['vest','helmet','radio','weapon'].map(key => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox id={key} checked={formData.equipment[key]} onCheckedChange={(checked) => handleEquipmentChange(key, checked)} />
                      <Label htmlFor={key} className="mr-2">{key === 'vest' ? 'ווסט' : key === 'helmet' ? 'קסדה' : key === 'radio' ? 'קשר' : 'נשק'}</Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  שינוי סיסמה
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {passwordMessage && (
                  <Alert className={`${passwordMessage.includes("שגיאה") ? "text-red-800 border-red-200 bg-red-50" : "text-green-800 border-green-200 bg-green-50"}`}>
                    <AlertDescription>{passwordMessage}</AlertDescription>
                  </Alert>
                )}
                <div>
                  <Label htmlFor="currentPassword">סיסמה נוכחית</Label>
                  <Input id="currentPassword" type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData(prev => ({...prev, currentPassword: e.target.value}))} placeholder="הכנס סיסמה נוכחית" />
                </div>
                <div>
                  <Label htmlFor="newPassword">סיסמה חדשה</Label>
                  <div className="relative">
                    <Input id="newPassword" type={showPassword ? "text" : "password"} value={passwordData.newPassword} onChange={(e) => setPasswordData(prev => ({...prev, newPassword: e.target.value}))} placeholder="לפחות 6 תווים" />
                    <Button type="button" variant="ghost" size="icon" className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirmPassword">אישור סיסמה חדשה</Label>
                  <Input id="confirmPassword" type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData(prev => ({...prev, confirmPassword: e.target.value}))} placeholder="הכנס שוב את הסיסמה החדשה" />
                </div>
                <Button onClick={handlePasswordChange} disabled={saving} variant="outline">
                  <Key className="w-4 h-4 mr-2"/>
                  שנה סיסמה
                </Button>
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>הערה אבטחה:</strong> שינוי סיסמה יעבור בעתיד לנקודת קצה מאובטחת בשרת.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
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


