import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, addWeeks } from "date-fns";
import { Clock, Clock3, ArrowLeftRight, Sun, ChevronLeft, CalendarClock, CheckCircle2, Lock } from "lucide-react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/spinner";
import WeekNavigator from "../components/shared/WeekNavigator";
import StandbyCard from "../components/soldier/StandbyCard";
import SwapRequestSheet from "../components/soldier/SwapRequestSheet";
import { useAuth } from "../contexts/AuthContext";
import { useSoldier } from "../components/soldier/SoldierContext";
import { ShiftAssignment } from "../entities/ShiftAssignment";
import { getDefaultWeekStart, getLongShiftEndTime, toWeekStartISO } from "../utils/weekKey";
import {
  DAY_KEYS, DAY_NAMES_HE, dayKeyFromDate, formatShortDate, toISODate, toLocalDate, isSameDay,
} from "../utils/days";
import { shiftTimeRange, shiftTitle, sortAssignments } from "../components/soldier/shiftDisplay";
import {
  deriveDayOff, findSubmissionWeek, loadDayOffSubmission, submissionWeekStart,
} from "../components/soldier/dayOff";
import { cn } from "../lib/utils";
import { SWAP_REQUESTS_ENABLED } from "../config/app";

const WORK_DAYS = DAY_KEYS.slice(0, 6); // Sunday–Friday

const relativeDayLabel = (dateStr) => {
  const date = toLocalDate(dateStr);
  const today = new Date();
  if (isSameDay(date, today)) return 'היום';
  if (isSameDay(date, addDays(today, 1))) return 'מחר';
  return `יום ${DAY_NAMES_HE[dayKeyFromDate(date)]}`;
};

function NextShiftCard({ assignment, loading }) {
  if (loading) return <Skeleton className="h-36" />;

  if (!assignment) {
    return (
      <Card className="flex items-center gap-3 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold">אין משמרות קרובות</p>
          <p className="text-sm text-muted-foreground">כשתשובץ/י, המשמרת הבאה תופיע כאן.</p>
        </div>
      </Card>
    );
  }

  const dayKey = dayKeyFromDate(assignment.date);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-primary to-indigo-800 p-5 text-primary-foreground shadow-lg shadow-primary/25">
      <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
      <p className="text-sm font-medium text-white/75">המשמרת הבאה שלך</p>
      <p className="mt-1 text-2xl font-extrabold">
        {relativeDayLabel(assignment.date)}
        <span className="mr-2 text-base font-medium text-white/75">{formatShortDate(assignment.date)}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
          <Clock className="h-4 w-4" />
          <span dir="ltr">{shiftTimeRange(assignment)}</span>
        </span>
        <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{shiftTitle(assignment)}</span>
        {assignment.isLongShift && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-sm font-bold text-amber-950">
            <Clock3 className="h-4 w-4" />
            ארוכה עד {getLongShiftEndTime(dayKey)}
          </span>
        )}
      </div>
    </div>
  );
}

function DayOffCard({ base }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { offset, open } = await findSubmissionWeek();
        const weekStart = submissionWeekStart(offset);
        const submission = await loadDayOffSubmission(user.uid, toWeekStartISO(weekStart));
        if (!cancelled) setState({ weekStart, open, dayOff: deriveDayOff(submission) });
      } catch {
        if (!cancelled) setState({ error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [user.uid]);

  if (!state) return <Skeleton className="h-[76px]" />;
  if (state.error) return null;

  const { weekStart, open, dayOff } = state;
  const weekLabel = `לשבוע ${formatShortDate(weekStart)}`;

  let icon = <Sun className="h-5 w-5" />;
  let tone = 'bg-warning-soft text-warning';
  let title = `טרם בחרת יום חופש ${weekLabel}`;
  let subtitle = 'לחץ/י כדי לבחור';
  if (dayOff) {
    icon = <CheckCircle2 className="h-5 w-5" />;
    tone = 'bg-success-soft text-success';
    title = `יום חופש: יום ${DAY_NAMES_HE[dayOff]}`;
    subtitle = open ? `${weekLabel} · אפשר לשנות` : weekLabel;
  } else if (!open) {
    icon = <Lock className="h-5 w-5" />;
    tone = 'bg-muted text-muted-foreground';
    title = 'ההגשה סגורה כרגע';
    subtitle = 'המנהל יפתח את ההגשה לשבוע הבא';
  }

  return (
    <Link to={`${base}/shifts`} className="block">
      <Card className="flex items-center gap-3 p-4 transition-colors active:bg-accent">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <ChevronLeft className="h-5 w-5 text-muted-foreground" />
      </Card>
    </Link>
  );
}

function MyWeek({ assignments, loading, onSwap }) {
  const [weekStart, setWeekStart] = useState(() => getDefaultWeekStart());
  const defaultWeek = toWeekStartISO(getDefaultWeekStart());
  const today = toISODate(new Date());

  const byDate = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      (map[a.date] = map[a.date] || []).push(a);
    });
    return map;
  }, [assignments]);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">השבוע שלי</h2>
        <WeekNavigator
          compact
          className="max-w-[260px] flex-1"
          weekStart={weekStart}
          onPrev={() => setWeekStart((w) => addWeeks(w, -1))}
          onNext={() => setWeekStart((w) => addWeeks(w, 1))}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {WORK_DAYS.map((d) => <Skeleton key={d} className="h-14" />)}
        </div>
      ) : (
        <Card className="divide-y divide-border/70 overflow-hidden p-0">
          {WORK_DAYS.map((dayKey, i) => {
            const date = toISODate(addDays(weekStart, i));
            const items = sortAssignments(byDate[date] || []);
            const isToday = date === today;
            const isPast = date < today;
            return (
              <div
                key={dayKey}
                className={cn('flex gap-3 px-4', items.length ? 'py-3' : 'py-2.5', isPast && 'opacity-55')}
              >
                <div className={cn('w-11 shrink-0 text-center', isToday && 'text-primary')}>
                  <div className="text-xs font-semibold">{DAY_NAMES_HE[dayKey]}</div>
                  <div className={cn('text-sm tabular-nums', isToday ? 'font-extrabold' : 'text-muted-foreground')}>
                    {formatShortDate(date)}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {items.length === 0 ? (
                    <p className="pt-1 text-sm text-muted-foreground">חופש</p>
                  ) : (
                    items.map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold" dir="ltr">{shiftTimeRange(a)}</span>
                            {a.isLongShift && <Badge variant="warning">ארוכה</Badge>}
                            {SWAP_REQUESTS_ENABLED && a.status === 'swap_requested' && <Badge variant="swap">ממתין להחלפה</Badge>}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{shiftTitle(a)}</p>
                        </div>
                        {SWAP_REQUESTS_ENABLED && !isPast && a.status !== 'swap_requested' && a.status !== 'completed' && (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="text-swap hover:bg-swap-soft hover:text-swap"
                            onClick={() => onSwap(a)}
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            החלפה
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
      {toWeekStartISO(weekStart) !== defaultWeek && (
        <div className="mt-2 text-center">
          <Button variant="link" size="xs" onClick={() => setWeekStart(getDefaultWeekStart())}>
            חזרה לשבוע הנוכחי
          </Button>
        </div>
      )}
    </section>
  );
}

export default function SoldierDashboard() {
  const { user } = useAuth();
  const { displayName } = useSoldier();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [swapTarget, setSwapTarget] = useState(null);

  // One query returns all of the soldier's assignments (Firestore filters by
  // soldier_id only), so the week list and "next shift" are derived locally.
  const loadAssignments = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const data = await ShiftAssignment.filter({ soldier_id: user.uid });
      setAssignments(data);
    } catch (error) {
      console.error('SoldierDashboard: failed to load assignments', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const nextShift = useMemo(() => {
    const today = toISODate(new Date());
    return sortAssignments(assignments.filter((a) => a.date >= today && a.status !== 'completed'))[0] || null;
  }, [assignments]);

  const firstName = (displayName || '').split(' ')[0];
  const base = `/soldier/${user.uid}`;
  const todayLabel = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">שלום{firstName ? `, ${firstName}` : ''}</h1>
        <p className="text-sm text-muted-foreground">{todayLabel}</p>
      </div>

      <NextShiftCard assignment={nextShift} loading={loading} />
      <DayOffCard base={base} />
      <StandbyCard />
      <MyWeek assignments={assignments} loading={loading} onSwap={setSwapTarget} />

      {SWAP_REQUESTS_ENABLED && <SwapRequestSheet
        assignment={swapTarget}
        onClose={() => setSwapTarget(null)}
        onSent={loadAssignments}
      />}
    </div>
  );
}
