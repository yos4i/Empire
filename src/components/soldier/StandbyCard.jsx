import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { Card } from '../ui/card';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Spinner } from '../ui/spinner';
import { toast } from '../ui/toaster';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
} from '../ui/dialog';
import { User as UserEntity } from '../../entities/User';
import { useSoldier } from './SoldierContext';

export default function StandbyCard() {
  const { profile, patchProfile } = useSoldier();
  const [updating, setUpdating] = useState(false);
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState('');

  const onStandby = !!profile?.on_standby;

  const update = async (newStatus, why = '') => {
    setUpdating(true);
    try {
      const data = {
        on_standby: newStatus,
        standby_reason: why || null,
        standby_updated_at: new Date().toISOString(),
      };
      await UserEntity.updateMyUserData(data);
      patchProfile(data);
      setAskReason(false);
      setReason('');
      toast.success(newStatus ? 'עודכן: בכוננות' : 'עודכן: לא בכוננות');
    } catch (error) {
      toast.error('שגיאה בעדכון מצב הכוננות');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggle = (next) => {
    // Turning standby OFF requires a reason; turning it ON is immediate.
    if (next) update(true);
    else setAskReason(true);
  };

  return (
    <>
      <Card className="flex items-center gap-3 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            onStandby ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">כוננות</p>
          <p className="truncate text-sm text-muted-foreground">
            {onStandby ? 'את/ה זמין/ה לקריאה' : profile?.standby_reason || 'לא זמין/ה כרגע'}
          </p>
        </div>
        {updating ? (
          <Spinner />
        ) : (
          <Switch
            checked={onStandby}
            onCheckedChange={handleToggle}
            disabled={!profile}
            aria-label="מצב כוננות"
          />
        )}
      </Card>

      <Dialog open={askReason} onOpenChange={setAskReason}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>יציאה מכוננות</DialogTitle>
            <DialogDescription>הסיבה תוצג למנהל.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Label htmlFor="standby-reason" className="mb-2 block">סיבה</Label>
            <Textarea
              id="standby-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: חופשה, מחלה, אירוע משפחתי"
              rows={3}
              autoFocus
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => update(false, reason.trim())}
              disabled={updating || !reason.trim()}
            >
              {updating ? <Spinner className="text-white" /> : 'אישור יציאה מכוננות'}
            </Button>
            <Button variant="outline" onClick={() => setAskReason(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
