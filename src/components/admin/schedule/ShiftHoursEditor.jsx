import React, { useState, useEffect } from 'react';
import { X, Clock, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { ShiftDefinition } from '../../../entities/ShiftDefinition';
import { SHIFT_NAMES, SHIFT_REQUIREMENTS, SHIFT_TYPES_HE } from '../../../config/shifts';

export default function ShiftHoursEditor({ isOpen, onClose, onSave }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedShifts, setEditedShifts] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadShifts();
    }
  }, [isOpen]);

  const loadShifts = async () => {
    setLoading(true);
    try {
      // Convert static config to editable format
      const shiftList = Object.keys(SHIFT_NAMES).map(shiftKey => {
        const displayName = SHIFT_NAMES[shiftKey];
        const requirements = SHIFT_REQUIREMENTS[shiftKey] || {};
        const typeInfo = SHIFT_TYPES_HE[shiftKey] || {};

        // Extract times from display name (e.g., "ק.חינוך בוקר (07:00-14:30)")
        const timeMatch = displayName.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
        const startTime = timeMatch ? timeMatch[1] : '07:00';
        const endTime = timeMatch ? timeMatch[2] : '15:00';

        // Extract mission/unit name from key (e.g., "קריית_חינוך_בוקר_07_1430")
        const parts = shiftKey.split('_');
        const mission = parts[0];
        const shiftType = parts[1];

        return {
          id: shiftKey,
          key: shiftKey,
          mission: mission,
          shiftType: shiftType,
          displayName: displayName,
          startTime: startTime,
          endTime: endTime,
          required: requirements.required || 0,
          isLong: typeInfo.isLong || false
        };
      });

      setShifts(shiftList);

      // Initialize edited shifts
      const initialEdited = {};
      shiftList.forEach(shift => {
        initialEdited[shift.key] = { ...shift };
      });
      setEditedShifts(initialEdited);

    } catch (error) {
      console.error('Error loading shifts:', error);
    }
    setLoading(false);
  };

  const handleFieldChange = (shiftKey, field, value) => {
    setEditedShifts(prev => ({
      ...prev,
      [shiftKey]: {
        ...prev[shiftKey],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!window.confirm("האם אתה בטוח שברצונך לשמור את השינויים? זה ישנה את שעות המשמרות לכל החיילים.")) {
      return;
    }

    setSaving(true);
    try {
      // In a real implementation, you would:
      // 1. Save to Firestore shift_definitions collection
      // 2. Update the shifts.js config file or use it as a fallback
      // 3. Trigger a refresh of all components using shift data

      console.log('Saving shift definitions:', editedShifts);

      // For now, we'll just notify the parent component
      if (onSave) {
        await onSave(editedShifts);
      }

      alert('שעות המשמרות עודכנו בהצלחה!');
      onClose();

    } catch (error) {
      console.error('Error saving shifts:', error);
      alert('שגיאה בשמירת שעות המשמרות: ' + error.message);
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" dir="rtl">
      <Card className="w-full max-w-4xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="sticky top-0 bg-white z-10 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-600" />
              עריכת שעות משמרות
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="p-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>הערה:</strong> שינוי שעות המשמרות ישפיע על כל החיילים והמנהלים.
                  המשמרות המעודכנות יוצגו בעת בחירת העדפות ובסידור.
                </p>
              </div>

              {shifts.map((shift) => {
                const edited = editedShifts[shift.key] || shift;

                return (
                  <Card key={shift.key} className="p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <h3 className="font-semibold text-lg mb-2 text-gray-900">
                          {shift.displayName}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                          משימה: {shift.mission} | סוג: {shift.shiftType}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor={`${shift.key}-start`}>שעת התחלה</Label>
                        <Input
                          id={`${shift.key}-start`}
                          type="time"
                          value={edited.startTime}
                          onChange={(e) => handleFieldChange(shift.key, 'startTime', e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor={`${shift.key}-end`}>שעת סיום</Label>
                        <Input
                          id={`${shift.key}-end`}
                          type="time"
                          value={edited.endTime}
                          onChange={(e) => handleFieldChange(shift.key, 'endTime', e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor={`${shift.key}-required`}>חיילים נדרשים</Label>
                        <Input
                          id={`${shift.key}-required`}
                          type="number"
                          min="0"
                          value={edited.required}
                          onChange={(e) => handleFieldChange(shift.key, 'required', parseInt(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>

        <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                שומר...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 ml-2" />
                שמור שינויים
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
