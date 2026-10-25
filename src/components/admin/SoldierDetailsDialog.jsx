import React, { useState, useEffect } from 'react';
import { Trash2, Pencil, Check, X, Shield, Package, KeyRound } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Spinner } from '../ui/spinner';
import { toast } from '../ui/toaster';
import { useConfirm } from '../ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { User as UserEntity } from '../../entities/User';
import { cn } from '../../lib/utils';

const MISSIONS = [{ value: 'קריית_חינוך', label: 'קריית חינוך' }];

const show = (value) => (value && value !== 'לא מולא' ? String(value).replace(/_/g, ' ') : null);

function Field({ label, value }) {
  const v = show(value);
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('font-semibold', !v && 'font-normal text-muted-foreground')}>{v || 'לא מולא'}</div>
    </div>
  );
}

/** Side drawer with a soldier's details; mission is editable, soldier can be deleted. */
export default function SoldierDetailsDialog({ isOpen, onClose, soldier, onDelete, onUpdated }) {
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMission, setEditedMission] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (soldier) {
      setEditedMission(soldier.mission || '');
      setIsEditing(false);
    }
  }, [soldier]);

  if (!soldier) return null;

  const handleSaveMission = async () => {
    setSaving(true);
    try {
      await UserEntity.update(soldier.id, {
        mission: editedMission,
        unit: editedMission, // keep legacy field in sync
        updated_at: new Date().toISOString(),
      });
      toast.success('המשימה עודכנה');
      setIsEditing(false);
      onUpdated?.({ ...soldier, mission: editedMission, unit: editedMission });
    } catch (error) {
      toast.error('שגיאה בעדכון המשימה: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `למחוק את ${soldier.hebrew_name}?`,
      description: 'החייל יוסר מהמערכת ולא יוכל להתחבר. הפעולה לא ניתנת לביטול.',
      confirmText: 'מחיקה',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete(soldier);
      toast.success('החייל נמחק');
      onClose();
    } catch (error) {
      toast.error('שגיאה במחיקת החייל: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const eq = soldier.equipment || {};
  const magazines = Number(eq.magazines ?? soldier.magazines ?? 0) || 0;
  const equipment = [
    { label: 'ווסט', on: !!eq.vest },
    { label: 'קסדה', on: !!eq.helmet },
    { label: 'נשק', on: !!eq.weapon },
    { label: magazines ? `${magazines} מחסניות` : 'מחסניות', on: magazines > 0 },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent side="right">
        <DialogHeader className="pt-5">
          <DialogTitle className="text-xl">{soldier.hebrew_name || soldier.full_name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span>מ.א {show(soldier.personal_number) || '—'}</span>
            {soldier.on_standby ? (
              <Badge variant="success">בכוננות</Badge>
            ) : (
              <Badge variant="destructive">לא בכוננות</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {!soldier.on_standby && soldier.standby_reason && (
            <div className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm">
              <span className="font-semibold text-danger">סיבת אי-כוננות: </span>
              {soldier.standby_reason}
            </div>
          )}

          <section className="grid grid-cols-2 gap-2">
            <Field label="דרגה" value={soldier.rank} />
            <Field label="מספר נשק" value={soldier.weapon_number} />
            <Field label="יחידת אם" value={soldier.mother_unit} />
            <Field label="מגורים" value={soldier.home_location} />
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold">משימה</h3>
            {isEditing ? (
              <div className="flex gap-2">
                <Select value={editedMission} onValueChange={setEditedMission}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="בחירת משימה" />
                  </SelectTrigger>
                  <SelectContent>
                    {MISSIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="success" onClick={handleSaveMission} disabled={saving} aria-label="שמירה">
                  {saving ? <Spinner className="text-white" /> : <Check className="h-5 w-5" />}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => { setIsEditing(false); setEditedMission(soldier.mission || ''); }}
                  aria-label="ביטול"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                <span className={cn('font-semibold', !soldier.mission && 'font-normal text-warning')}>
                  {show(soldier.mission) || 'לא הוגדרה — החייל לא יראה סידור'}
                </span>
                <Button size="xs" variant="ghost" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" /> עריכה
                </Button>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
              <Package className="h-4 w-4 text-muted-foreground" /> ציוד חתום
            </h3>
            <div className="flex flex-wrap gap-2">
              {equipment.map(({ label, on }) => (
                <span
                  key={label}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
                    on ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground line-through decoration-1'
                  )}
                >
                  {on ? <Check className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5 opacity-50" />}
                  {label}
                </span>
              ))}
            </div>
          </section>

          <section className="space-y-1.5 text-sm">
            <h3 className="mb-2 flex items-center gap-1.5 font-bold">
              <KeyRound className="h-4 w-4 text-muted-foreground" /> חשבון
            </h3>
            <div className="flex justify-between">
              <span className="text-muted-foreground">שם משתמש</span>
              <span className="font-medium" dir="ltr">{soldier.username || '—'}</span>
            </div>
            {soldier.created_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">נוצר</span>
                <span>{new Date(soldier.created_at).toLocaleDateString('he-IL')}</span>
              </div>
            )}
            {soldier.updated_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">עודכן</span>
                <span>{new Date(soldier.updated_at).toLocaleDateString('he-IL')}</span>
              </div>
            )}
          </section>
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose}>סגירה</Button>
          <Button
            variant="ghost"
            className="text-danger hover:bg-danger-soft hover:text-danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Spinner /> : <><Trash2 className="h-4 w-4" /> מחיקת חייל</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
