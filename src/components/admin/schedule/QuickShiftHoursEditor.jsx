import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { SHIFT_TYPES_HE } from '../../../config/shifts';
import { DAY_NAMES_HE } from '../../../utils/days';

/** Edit one cell's hours. Changes stay in the local draft until "publish". */
export default function QuickShiftHoursEditor({ isOpen, onClose, day, shiftKey, shiftName, shift, onSave }) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    // Prefer the cell's saved custom hours, then the times in the shift name.
    if (shift?.customStartTime && shift?.customEndTime) {
      setStartTime(shift.customStartTime);
      setEndTime(shift.customEndTime);
      return;
    }
    const m = (shiftName || '').match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
    setStartTime(m ? m[1] : '07:00');
    setEndTime(m ? m[2] : '15:00');
  }, [isOpen, shift, shiftName]);

  const handleSave = () => {
    if (!startTime || !endTime) return setError('יש למלא שעת התחלה וסיום');
    if (startTime >= endTime) return setError('שעת הסיום חייבת להיות אחרי שעת ההתחלה');
    onSave(day, shiftKey, startTime, endTime);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> שעות משמרת
          </DialogTitle>
          <DialogDescription>
            יום {DAY_NAMES_HE[day]} · {(SHIFT_TYPES_HE[shiftKey]?.name || shiftKey || '').replace(/_/g, ' ')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3" dir="ltr">
            <div className="space-y-1.5 text-right">
              <Label htmlFor="shift-end">סיום</Label>
              <Input id="shift-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="space-y-1.5 text-right">
              <Label htmlFor="shift-start">התחלה</Label>
              <Input id="shift-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <p className="text-xs text-muted-foreground">השינוי נשמר בטיוטה ויגיע לחיילים רק אחרי "פרסום".</p>
        </DialogBody>
        <DialogFooter>
          <Button onClick={handleSave}>שמירה</Button>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
