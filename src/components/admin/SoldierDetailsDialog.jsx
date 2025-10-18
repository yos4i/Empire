import React, { useState, useEffect } from 'react';
import { X, User, Shield, MapPin, Award, Car, Package, Calendar, Trash2, Edit, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { User as UserEntity } from '../../entities/User';

export default function SoldierDetailsDialog({ isOpen, onClose, soldier, onDelete }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMission, setEditedMission] = useState('');
  const [saving, setSaving] = useState(false);

  // Initialize editedMission when soldier changes
  useEffect(() => {
    if (soldier) {
      setEditedMission(soldier.mission || '');
      setIsEditing(false);
    }
  }, [soldier]);

  if (!isOpen || !soldier) return null;

  const handleSaveMission = async () => {
    setSaving(true);
    try {
      // Update soldier's mission in Firestore
      await UserEntity.update(soldier.id, {
        mission: editedMission,
        unit: editedMission, // Also update unit field for backward compatibility
        updated_at: new Date().toISOString()
      });
      alert('המשימה עודכנה בהצלחה!');
      setIsEditing(false);

      // Reload the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Error updating mission:', error);
      alert('שגיאה בעדכון המשימה: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setDeleting(true);
    try {
      await onDelete(soldier);
      onClose();
    } catch (error) {
      console.error('Error deleting soldier:', error);
      alert('שגיאה במחיקת החייל: ' + error.message);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" dir="rtl">
      <Card className="w-full max-w-2xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <User className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-semibold text-gray-900">פרטי חייל</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="p-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {soldier.hebrew_name || soldier.full_name || 'לא מולא'}
                </h3>
                <p className="text-gray-600">
                  מספר אישי: {soldier.personal_number || 'לא מולא'}
                </p>
              </div>
              <Badge
                className={`text-sm px-3 py-1 ${
                  soldier.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {soldier.is_active ? 'פעיל' : 'לא פעיל'}
              </Badge>
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-purple-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">דרגה</p>
                  <p className="font-semibold text-gray-900">
                    {soldier.rank || 'לא מולא'}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">יחידה</p>
                  <p className="font-semibold text-gray-900">
                    {soldier.unit ? soldier.unit.replace('_', ' ') : 'לא מולא'}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-green-600 mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">משימה (ניתן לעריכה)</p>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Select value={editedMission} onValueChange={setEditedMission}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="בחר משימה" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="קריית_חינוך">קריית חינוך</SelectItem>
                          <SelectItem value="גבולות">גבולות</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={handleSaveMission}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedMission(soldier.mission || '');
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-900">
                        {soldier.mission ? soldier.mission.replace('_', ' ') : 'לא מולא'}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditing(true)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-orange-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">מספר נשק</p>
                  <p className="font-semibold text-gray-900">
                    {soldier.weapon_number || 'לא מולא'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Driver Status */}
          {soldier.is_driver !== undefined && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Car className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">סטטוס נהג</p>
                  <Badge className={soldier.is_driver ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {soldier.is_driver ? 'נהג/ת' : 'לא נהג/ת'}
                  </Badge>
                </div>
              </div>
            </Card>
          )}

          {/* Equipment Section */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-900">ציוד חתום</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${soldier.equipment?.vest ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-sm text-gray-700">ווסט</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${soldier.equipment?.helmet ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-sm text-gray-700">קסדה</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${soldier.equipment?.radio ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-sm text-gray-700">קשר</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${soldier.equipment?.weapon ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-sm text-gray-700">נשק</span>
              </div>
            </div>
            {soldier.equipment && Object.values(soldier.equipment).every(v => !v) && (
              <p className="text-sm text-gray-500 mt-2">לא דווח על ציוד</p>
            )}
          </Card>

          {/* Account Information */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-gray-900">מידע חשבון</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">שם משתמש:</span>
                <span className="font-medium text-gray-900">{soldier.username || 'לא זמין'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">UID:</span>
                <span className="font-mono text-xs text-gray-700">{soldier.uid || soldier.id}</span>
              </div>
              {soldier.created_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">תאריך יצירה:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(soldier.created_at).toLocaleDateString('he-IL')}
                  </span>
                </div>
              )}
              {soldier.updated_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">עדכון אחרון:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(soldier.updated_at).toLocaleDateString('he-IL')}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Shift Statistics */}
          {soldier.weekly_shifts && Object.keys(soldier.weekly_shifts).length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-gray-900">סטטיסטיקת משמרות</h4>
              </div>
              <div className="text-sm text-gray-600">
                <p>סה"כ משמרות שבועיות: {Object.keys(soldier.weekly_shifts).length}</p>
              </div>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t p-4 flex justify-between items-center">
          <Button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex items-center gap-2 ${
              showDeleteConfirm
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'מוחק...' : showDeleteConfirm ? 'לחץ שוב לאישור מחיקה' : 'מחק חייל'}
          </Button>
          <div className="flex gap-2">
            {showDeleteConfirm && (
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="outline"
              >
                ביטול
              </Button>
            )}
            <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700">
              סגור
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
