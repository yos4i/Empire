import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User as UserIcon, Shield, Save, LogOut, Info, Minus, Plus } from "lucide-react";
import { User } from "../entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { PageLoader, Spinner } from "../components/ui/spinner";
import { toast } from "../components/ui/toaster";
import { useConfirm } from "../components/ui/confirm-dialog";
import { useAuth } from "../contexts/AuthContext";
import { useSoldier } from "../components/soldier/SoldierContext";

const MAX_MAGAZINES = 7;

const toForm = (user) => ({
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
  equipment: {
    vest: user.equipment?.vest || false,
    helmet: user.equipment?.helmet || false,
    weapon: user.equipment?.weapon || false,
    // Saved under equipment.magazines; older docs only have the top-level field.
    magazines: Number(user.equipment?.magazines ?? user.magazines ?? 0) || 0,
  },
});

const FIELDS = [
  { key: "hebrew_name", label: "שם מלא", placeholder: "שם מלא בעברית", autoComplete: "name" },
  { key: "personal_number", label: "מספר אישי", placeholder: "7 ספרות", inputMode: "numeric" },
  { key: "weapon_number", label: "מספר נשק", placeholder: "מספר נשק", inputMode: "numeric" },
  { key: "home_location", label: "מקום מגורים", placeholder: "עיר / יישוב" },
  { key: "mother_unit", label: "יחידת אם", placeholder: "יחידת אם" },
  { key: "rifleman", label: "רובאי", placeholder: "רובאי" },
];

const EQUIPMENT = [
  { key: "vest", label: "ווסט" },
  { key: "helmet", label: "קסדה" },
  { key: "weapon", label: "נשק" },
];

export default function MyStatusPage() {
  const { signOut } = useAuth();
  const { refresh: refreshProfile } = useSoldier();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    User.me()
      .then((user) => setFormData(toForm(user)))
      .catch((error) => {
        console.error("MyStatusPage: failed to load user", error);
        toast.error("שגיאה בטעינת הפרטים");
      });
  }, []);

  const setField = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));
  const setEquipment = (key, value) =>
    setFormData((prev) => ({ ...prev, equipment: { ...prev.equipment, [key]: value } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Keep the legacy top-level `magazines` in sync with equipment.magazines.
      await User.updateMyUserData({ ...formData, magazines: formData.equipment.magazines });
      toast.success("הפרטים נשמרו");
      refreshProfile();
    } catch (error) {
      toast.error(error.message || "שגיאה בשמירת הפרטים");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (!(await confirm({ title: "להתנתק?", confirmText: "התנתקות" }))) return;
    await signOut();
    navigate("/login", { replace: true });
  };

  if (!formData) return <PageLoader />;

  const isNewUser = !formData.hebrew_name || !formData.personal_number;
  const magazines = formData.equipment.magazines;

  return (
    <div className="space-y-4">
      {isNewUser && (
        <div className="flex gap-3 rounded-2xl bg-info-soft p-4 text-sm text-blue-900">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" />
          <p>
            <strong>ברוך/ה הבא/ה!</strong> מלא/י את הפרטים והציוד שלך ולחץ/י "שמירה".
          </p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="h-5 w-5 text-primary" />
            פרטים אישיים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {FIELDS.map(({ key, label, ...inputProps }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                value={formData[key]}
                onChange={(e) => setField(key, e.target.value)}
                {...inputProps}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-primary" />
            ציוד חתום
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {EQUIPMENT.map(({ key, label }) => (
            <label
              key={key}
              htmlFor={`eq-${key}`}
              className="flex h-12 cursor-pointer items-center gap-3 rounded-xl px-2 active:bg-accent"
            >
              <Checkbox
                id={`eq-${key}`}
                checked={formData.equipment[key]}
                onCheckedChange={(checked) => setEquipment(key, Boolean(checked))}
              />
              <span className="font-medium">{label}</span>
            </label>
          ))}
          <div className="flex h-12 items-center gap-3 px-2">
            <Checkbox
              id="eq-magazines"
              checked={magazines > 0}
              onCheckedChange={(checked) => setEquipment("magazines", checked ? 1 : 0)}
            />
            <label htmlFor="eq-magazines" className="flex-1 cursor-pointer font-medium">מחסניות</label>
            {magazines > 0 && (
              <div className="flex items-center gap-1" dir="ltr">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setEquipment("magazines", Math.max(1, magazines - 1))}
                  disabled={magazines <= 1}
                  aria-label="פחות"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center text-lg font-bold tabular-nums">{magazines}</span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setEquipment("magazines", Math.min(MAX_MAGAZINES, magazines + 1))}
                  disabled={magazines >= MAX_MAGAZINES}
                  aria-label="יותר"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Button variant="ghost" className="w-full text-danger hover:bg-danger-soft hover:text-danger" onClick={handleLogout}>
        <LogOut className="h-4 w-4" />
        התנתקות
      </Button>

      {/* Sticky save above the bottom nav */}
      <div className="h-16" aria-hidden />
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border/60 bg-background/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto max-w-2xl">
          <Button size="lg" className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="text-primary-foreground" /> : <><Save className="h-5 w-5" /> שמירה</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
