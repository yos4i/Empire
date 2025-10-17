import React, { useState } from 'react';
import { X, Clock, Save } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

const DAYS_HE = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי'
};

export default function ShiftHoursEditorNew({ isOpen, onClose, day, shiftType, currentHours, onSave }) {
  const [startTime, setStartTime] = useState(currentHours?.startTime || '07:00');
  const [endTime, setEndTime] = useState(currentHours?.endTime || '15:00');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen && currentHours) {
      setStartTime(currentHours.startTime);
      setEndTime(currentHours.endTime);
    }
  }, [isOpen, currentHours]);

  const handleSave = async () => {
    if (!startTime || !endTime) {
      alert('יש למלא את כל השדות');
      return;
    }

    if (startTime >= endTime) {
      alert('שעת הסיום חייבת להיות אחרי שעת ההתחלה');
      return;
    }

    setSaving(true);
    try {
      await onSave(day, shiftType.id, startTime, endTime);
      onClose();
    } catch (error) {
      console.error('Error saving shift hours:', error);
      alert('שגיאה בשמירת שעות המשמרת: ' + error.message);
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" dir="rtl">
      <Card className="w-full max-w-md bg-white rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            עריכת שעות משמרת
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="p-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="mb-4 p-4 bg-blue-50 rounded-lg space-y-2">
          <p className="text-sm text-blue-900 font-bold">{shiftType?.name_he}</p>
          <p className="text-xs text-blue-700">יום: {DAYS_HE[day]}</p>
          <p className="text-xs text-gray-600">שינוי השעות ישפיע רק על יום זה</p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <Label htmlFor="startTime">שעת התחלה</Label>
            <Input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 text-lg"
            />
          </div>

          <div>
            <Label htmlFor="endTime">שעת סיום</Label>
            <Input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 text-lg"
            />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-green-800">
            השעות המעודכנות יוצגו מיד לחיילים בעת בחירת העדפות
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
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
