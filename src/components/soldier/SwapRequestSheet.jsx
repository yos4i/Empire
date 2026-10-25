import React, { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Spinner } from '../ui/spinner';
import { toast } from '../ui/toaster';
import { SoldierApiService } from '../../services/soldierApi';
import { DAY_NAMES_HE, dayKeyFromDate, formatShortDate, toLocalDate } from '../../utils/days';
import { shiftTimeRange, shiftTitle } from './shiftDisplay';

export default function SwapRequestSheet({ assignment, onClose, onSent }) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (assignment) setReason('');
  }, [assignment]);

  const handleSend = async () => {
    if (!reason.trim()) return;
    setSending(true);
    try {
      await SoldierApiService.requestSwap(assignment.id, reason.trim());
      toast.success('בקשת ההחלפה נשלחה למנהל');
      onSent?.();
      onClose();
    } catch (error) {
      toast.error('שליחת הבקשה נכשלה: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const date = assignment ? toLocalDate(assignment.date) : null;

  return (
    <Dialog open={!!assignment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-swap" />
            בקשת החלפה
          </DialogTitle>
          {assignment && (
            <DialogDescription>
              יום {DAY_NAMES_HE[dayKeyFromDate(date)]} {formatShortDate(date)} · {shiftTitle(assignment)} ·{' '}
              <span dir="ltr">{shiftTimeRange(assignment)}</span>
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogBody>
          <Label htmlFor="swap-reason" className="mb-2 block">סיבת הבקשה</Label>
          <Textarea
            id="swap-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="למה צריך החלפה?"
            rows={3}
            autoFocus
          />
          <p className="mt-2 text-xs text-muted-foreground">המנהל יקבל את הבקשה ויחזור אליך.</p>
        </DialogBody>
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending || !reason.trim()} className="bg-swap hover:bg-swap/90">
            {sending ? <Spinner className="text-white" /> : 'שליחת בקשה'}
          </Button>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
