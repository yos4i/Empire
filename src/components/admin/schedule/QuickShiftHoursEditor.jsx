import React, { useState } from 'react';
import { X, Clock, Save } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

export default function QuickShiftHoursEditor({ isOpen, onClose, day, shiftKey, shiftName, onSave }) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen && shiftName) {
      // Extract current times from shift name (e.g., "ק.חינוך בוקר (07:00-14:30)")
      const timeMatch = shiftName.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
      if (timeMatch) {
        setStartTime(timeMatch[1]);
        setEndTime(timeMatch[2]);
      } else {
        setStartTime('07:00');
        setEndTime('15:00');
      }
    }
  }, [isOpen, shiftName]);

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
      await onSave(day, shiftKey, startTime, endTime);
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

        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-900 font-medium">{shiftName}</p>
          {day && <p className="text-xs text-blue-700 mt-1">יום: {day}</p>}
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

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-yellow-800">
            שינוי שעות המשמרת ישתקף מיד אצל כל החיילים והמנהלים
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
