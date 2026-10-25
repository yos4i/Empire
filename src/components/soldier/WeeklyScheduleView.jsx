import React, { useEffect, useMemo, useState } from 'react';
import { addDays, addWeeks } from 'date-fns';
import { CalendarX2, Clock3, AlertTriangle, Ban } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/spinner';
import { EmptyState } from '../ui/empty-state';
import WeekNavigator from '../shared/WeekNavigator';
import { WeeklySchedule } from '../../entities/WeeklySchedule';
import { User as UserEntity } from '../../entities/User';
import { ShiftAssignment } from '../../entities/ShiftAssignment';
import { toWeekStartISO, getDefaultWeekStart, getLongShiftEndTime } from '../../utils/weekKey';
import { DAYS, SHIFT_NAMES, SHIFT_TYPES_HE, PINNED_SCHEDULE_NAMES } from '../../config/shifts';
import { DAY_LETTERS_HE, DAY_NAMES_HE, toISODate, toLocalDate } from '../../utils/days';
import { cn } from '../../lib/utils';

const shiftLabel = (shiftKey) =>
  (SHIFT_TYPES_HE[shiftKey]?.name || shiftKey).replace('ק.חינוך ', '').replace(/_/g, ' ');

const shiftTime = (shift, shiftKey) => {
  if (shift.customStartTime && shift.customEndTime) return `${shift.customStartTime}–${shift.customEndTime}`;
  const m = (SHIFT_NAMES[shiftKey] || '').match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
  return m ? `${m[1]}–${m[2]}` : '';
};

const coverageVariant = (assigned, required) => {
  if (assigned === 0) return 'destructive';
  if (assigned < required) return 'warning';
  if (assigned === required) return 'success';
  return 'info';
};

/**
 * Team schedule for soldiers: pick a day, see who is on each shift.
 * The viewing soldier is highlighted and listed first.
 */
export default function WeeklyScheduleView({ soldierMission, myIds = [] }) {
  const [weekStart, setWeekStart] = useState(() => getDefaultWeekStart());
  const [schedule, setSchedule] = useState(null);
  const [users, setUsers] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const weekStartStr = toWeekStartISO(weekStart);
  const todayIndex = DAYS.indexOf(DAYS[new Date().getDay()]);
  const [selectedDay, setSelectedDay] = useState(() => (todayIndex >= 0 ? DAYS[todayIndex] : DAYS[0]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const weekEnd = toISODate(addDays(toLocalDate(weekStartStr), 6));
        const [weekly, allUsers, shiftAssignments] = await Promise.all([
          WeeklySchedule.getWeek(weekStartStr),
          UserEntity.list(),
          ShiftAssignment.filter({ start_date: weekStartStr, end_date: weekEnd }),
        ]);
        if (cancelled) return;
        setSchedule(weekly?.schedule || null);
        setUsers(Object.fromEntries(allUsers.map((u) => [u.id, u])));
        setAssignments(shiftAssignments);
      } catch (e) {
        console.error('WeeklyScheduleView: failed to load', e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [weekStartStr]);

  // Lookup: `${soldierUid}|${shiftKey}|${date}` → isLongShift
  const longShiftSet = useMemo(() => {
    const set = new Set();
    assignments.forEach((a) => {
      if (a.isLongShift) set.add(`${a.soldier_id}|${a.shift_type}|${a.date}`);
    });
    return set;
  }, [assignments]);

  const isMe = (soldierId) => {
    const u = users[soldierId];
    return myIds.includes(soldierId) || (u && myIds.includes(u.uid));
  };

  const isLong = (soldierId, shiftKey, dateStr) => {
    const u = users[soldierId];
    return (
      longShiftSet.has(`${soldierId}|${shiftKey}|${dateStr}`) ||
      (u?.uid && longShiftSet.has(`${u.uid}|${shiftKey}|${dateStr}`))
    );
  };

  // Which days I'm on (for a dot on the day chips)
  const myDays = useMemo(() => {
    const set = new Set();
    if (!schedule) return set;
    DAYS.forEach((day) => {
      Object.values(schedule[day] || {}).forEach((shift) => {
        if (shift?.soldiers?.some(isMe)) set.add(day);
      });
    });
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, users, myIds.join('|')]);

  const nav = (
    <WeekNavigator
      weekStart={weekStart}
      onPrev={() => setWeekStart((w) => addWeeks(w, -1))}
      onNext={() => setWeekStart((w) => addWeeks(w, 1))}
      onToday={() => setWeekStart(getDefaultWeekStart())}
      isToday={weekStartStr === toWeekStartISO(getDefaultWeekStart())}
    />
  );

  if (!soldierMission) {
    return (
      <div className="space-y-4">
        {nav}
        <Card className="flex gap-3 border-warning/30 bg-warning-soft p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-bold">אין אפשרות לצפות בסידור כרגע</p>
            <p className="mt-1">המשימה שלך טרם הוגדרה. נא לפנות למנהל כדי שישייך אותך למשימה.</p>
          </div>
        </Card>
      </div>
    );
  }

  const dayIndex = DAYS.indexOf(selectedDay);
  const dateStr = toISODate(addDays(weekStart, dayIndex));
  const todayStr = toISODate(new Date());
  const dayShifts = schedule
    ? Object.keys(SHIFT_NAMES).filter((k) => schedule[selectedDay]?.[k])
    : [];

  const sortSoldiers = (ids, shiftKey) =>
    [...ids]
      .filter((id) => users[id])
      .sort((a, b) => {
        const rank = (id) => {
          if (isMe(id)) return 0;
          const name = users[id].hebrew_name || users[id].displayName || '';
          if (PINNED_SCHEDULE_NAMES.includes(name)) return 1;
          return isLong(id, shiftKey, dateStr) ? 3 : 2;
        };
        return rank(a) - rank(b);
      });

  return (
    <div className="space-y-4">
      {nav}

      {/* Day chips */}
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {DAYS.map((day, i) => {
          const d = addDays(weekStart, i);
          const ds = toISODate(d);
          const active = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              aria-pressed={active}
              className={cn(
                'relative flex h-16 min-w-[48px] flex-1 flex-col items-center justify-center rounded-2xl border text-sm transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'border-border bg-card',
                !active && ds === todayStr && 'border-primary/50 text-primary'
              )}
            >
              <span className="font-bold">{DAY_LETTERS_HE[day]}</span>
              <span className={cn('tabular-nums', active ? 'text-white/80' : 'text-muted-foreground')}>
                {d.getDate()}/{d.getMonth() + 1}
              </span>
              {myDays.has(day) && (
                <span
                  className={cn('absolute bottom-1.5 h-1.5 w-1.5 rounded-full', active ? 'bg-white' : 'bg-primary')}
                  aria-label="את/ה משובץ/ת"
                />
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-28" />
        </div>
      ) : error ? (
        <Card>
          <EmptyState icon={AlertTriangle} title="שגיאה בטעינת הסידור" description="בדוק/י את החיבור ונסה/י שוב." />
        </Card>
      ) : !schedule ? (
        <Card>
          <EmptyState
            icon={CalendarX2}
            title="הסידור לשבוע זה עוד לא פורסם"
            description="נסה/י שבוע אחר בעזרת החיצים למעלה."
          />
        </Card>
      ) : dayShifts.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarX2} title={`אין משמרות ביום ${DAY_NAMES_HE[selectedDay]}`} />
        </Card>
      ) : (
        dayShifts.map((shiftKey) => {
          const shift = schedule[selectedDay][shiftKey];
          const soldiers = sortSoldiers(shift.soldiers || [], shiftKey);
          const assigned = shift.soldiers?.length || 0;
          const required = shift.required || 0;
          const time = shiftTime(shift, shiftKey);
          return (
            <Card key={shiftKey} className={cn('overflow-hidden p-0', shift.cancelled && 'opacity-60')}>
              <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                <div>
                  <p className="font-bold">{shiftLabel(shiftKey)}</p>
                  {time && <p className="text-sm text-muted-foreground" dir="ltr">{time}</p>}
                </div>
                {shift.cancelled ? (
                  <Badge variant="secondary"><Ban className="h-3 w-3" /> מבוטלת</Badge>
                ) : (
                  <Badge variant={coverageVariant(assigned, required)} className="tabular-nums">
                    {assigned}/{required}
                  </Badge>
                )}
              </div>
              {soldiers.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">אין חיילים משובצים</p>
              ) : (
                <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 p-3">
                  {soldiers.map((id) => {
                    const u = users[id];
                    const me = isMe(id);
                    const long = isLong(id, shiftKey, dateStr);
                    return (
                      <li
                        key={id}
                        className={cn(
                          'flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm',
                          me && 'col-span-2 bg-primary/10 font-bold text-primary'
                        )}
                      >
                        <span className="truncate">{u.hebrew_name || u.displayName}</span>
                        {me && <span className="text-xs font-semibold">(את/ה)</span>}
                        {long && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-warning">
                            <Clock3 className="h-3 w-3" />
                            {getLongShiftEndTime(selectedDay)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
