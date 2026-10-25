import React, { useCallback, useEffect, useState } from 'react';
import { addWeeks } from 'date-fns';
import { Lock, Unlock, CalendarRange } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Skeleton, Spinner } from '../ui/spinner';
import { toast } from '../ui/toaster';
import { SubmissionWindow } from '../../entities/SubmissionWindow';
import { toWeekStartISO, getCurrentWeekStart } from '../../utils/weekKey';
import { formatWeekRange, toLocalDate } from '../../utils/days';
import { cn } from '../../lib/utils';

const WEEKS_SHOWN = 4;

/** Open/close day-off submissions for the next few weeks (was a modal). */
export default function SubmissionWindowsCard({ onChange }) {
  const [weeks, setWeeks] = useState(null);
  const [busy, setBusy] = useState({});

  const load = useCallback(async () => {
    const windows = await SubmissionWindow.list();
    const byWeek = Object.fromEntries(windows.map((w) => [w.week_start, w]));
    const base = toLocalDate(getCurrentWeekStart());
    setWeeks(
      Array.from({ length: WEEKS_SHOWN }, (_, i) => {
        const weekStart = toWeekStartISO(addWeeks(base, i));
        return { weekStart, isOpen: byWeek[weekStart]?.is_open === true, isCurrent: i === 0 };
      })
    );
  }, []);

  useEffect(() => {
    load().catch(() => setWeeks([]));
  }, [load]);

  const toggle = async (weekStart) => {
    setBusy((b) => ({ ...b, [weekStart]: true }));
    try {
      const nowOpen = await SubmissionWindow.toggleWeek(weekStart);
      await load();
      onChange?.();
      toast.success(`ההגשה לשבוע ${formatWeekRange(weekStart)} ${nowOpen ? 'נפתחה' : 'נסגרה'}`);
    } catch (error) {
      toast.error('שגיאה בשינוי סטטוס השבוע: ' + error.message);
    } finally {
      setBusy((b) => ({ ...b, [weekStart]: false }));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-5 w-5 text-primary" />
          חלונות הגשה
        </CardTitle>
        <p className="text-sm text-muted-foreground">רק בשבוע פתוח החיילים יכולים לבחור יום חופש.</p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {!weeks
          ? Array.from({ length: WEEKS_SHOWN }, (_, i) => <Skeleton key={i} className="h-12" />)
          : weeks.map(({ weekStart, isOpen, isCurrent }) => (
              <div
                key={weekStart}
                className={cn(
                  'flex h-12 items-center gap-3 rounded-xl border px-3',
                  isOpen ? 'border-success/30 bg-success-soft/60' : 'border-border bg-card'
                )}
              >
                {isOpen ? (
                  <Unlock className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 text-sm font-semibold tabular-nums">{formatWeekRange(weekStart)}</span>
                {isCurrent && <Badge variant="info">השבוע</Badge>}
                <span className={cn('w-12 text-xs font-semibold', isOpen ? 'text-success' : 'text-muted-foreground')}>
                  {isOpen ? 'פתוח' : 'סגור'}
                </span>
                {busy[weekStart] ? (
                  <Spinner />
                ) : (
                  <Switch checked={isOpen} onCheckedChange={() => toggle(weekStart)} aria-label="פתיחה/סגירה" />
                )}
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
