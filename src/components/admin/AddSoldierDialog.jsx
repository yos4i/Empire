import React, { useState } from 'react';
import { UserPlus, AlertCircle, Info } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Spinner } from '../ui/spinner';
import { toast } from '../ui/toaster';

const EMPTY = { username: '', password: '' };

export default function AddSoldierDialog({ isOpen, onClose, onAddSoldier }) {
  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!formData.username.trim()) next.username = 'שם משתמש נדרש';
    else if (formData.username.length < 3) next.username = 'לפחות 3 תווים';
    if (!formData.password.trim()) next.password = 'סיסמה נדרשת';
    else if (formData.password.length < 6) next.password = 'לפחות 6 תווים';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const close = () => {
    setFormData(EMPTY);
    setErrors({});
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await onAddSoldier(formData);
      toast.success(`החייל "${formData.username}" נוצר`);
      close();
    } catch (error) {
      console.error('AddSoldierDialog: failed to add soldier', error);
      setErrors({ submit: error.message || 'שגיאה ביצירת החייל' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              הוספת חייל
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {errors.submit && (
              <div className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errors.submit}
              </div>
            )}
            <div className="flex gap-2 rounded-xl bg-info-soft px-3 py-2.5 text-sm text-blue-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              החייל ימלא את שאר הפרטים (שם, מספר אישי, ציוד) בעצמו אחרי ההתחברות הראשונה.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-username">שם משתמש</Label>
              <Input
                id="new-username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="לפחות 3 תווים"
                autoComplete="off"
                autoCapitalize="none"
                className={errors.username ? 'border-danger' : ''}
                autoFocus
              />
              {errors.username && <p className="text-sm text-danger">{errors.username}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">סיסמה</Label>
              <Input
                id="new-password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="לפחות 6 תווים"
                autoComplete="new-password"
                className={errors.password ? 'border-danger' : ''}
              />
              {errors.password && <p className="text-sm text-danger">{errors.password}</p>}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? <Spinner className="text-primary-foreground" /> : 'יצירת חייל'}
            </Button>
            <Button type="button" variant="outline" onClick={close} disabled={loading}>ביטול</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
