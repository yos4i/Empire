import React, { useState, useEffect, useCallback } from "react";
import { addDays } from "date-fns";
import { Lock, Sun, Check, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Skeleton, Spinner } from "../components/ui/spinner";
import { toast } from "../components/ui/toaster";
import WeekNavigator from "../components/shared/WeekNavigator";
import { SubmissionWindow } from "../entities/SubmissionWindow";
import { toWeekStartISO } from '../utils/weekKey';
import { DAY_NAMES_HE, formatShortDate } from '../utils/days';
import { useAuth } from "../contexts/AuthContext";
import { useSoldier } from "../components/soldier/SoldierContext";
import {
  SELECTABLE_DAYS,
  MAX_WEEK_OFFSET,
  deriveDayOff,
  findSubmissionWeek,
  submissionWeekStart,
  loadDayOffSubmission,
  saveDayOff,
} from "../components/soldier/dayOff";
import { cn } from "../lib/utils";

const NOTES_MAX = 500;

export default function ShiftSubmissionPage() {
  const { user } = useAuth();
  const { mission, loading: profileLoading } = useSoldier();

  const [weekOffset, setWeekOffset] = useState(null); // null until we know the open week
  const [dayOff, setDayOff] = useState(null);
  const [notes, setNotes] = useState('');
  const [savedDayOff, setSavedDayOff] = useState(null);
  const [savedNotes, setSavedNotes] = useState('');
  const [isWeekOpen, setIsWeekOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Start on the nearest week the admin opened for submissions.
  useEffect(() => {
    findSubmissionWeek()
      .then(({ offset }) => setWeekOffset(offset))
      .catch(() => setWeekOffset(0));
  }, []);

  const weekStart = submissionWeekStart(weekOffset);
  const weekStartStr = toWeekStartISO(weekStart);

  const loadData = useCallback(async () => {
    if (!user || weekOffset === null) return;
    setLoading(true);
    try {
      const [open, submission] = await Promise.all([
        SubmissionWindow.isWeekOpen(weekStartStr),
        loadDayOffSubmission(user.uid, weekStartStr),
      ]);
      setIsWeekOpen(open);
      const off = deriveDayOff(submission);
      setDayOff(off);
      setSavedDayOff(off);
      setNotes(submission?.notes || '');
      setSavedNotes(submission?.notes || '');
    } catch (e) {
      console.error("ShiftSubmissionPage: error loading data", e);
      toast.error('שגיאה בטעינת ההגשה');
    } finally {
      setLoading(false);
    }
  }, [user, weekOffset, weekStartStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dirty = dayOff !== savedDayOff || notes !== savedNotes;

  const handleSubmit = async () => {
    if (!isWeekOpen || !dayOff) return;
    setSaving(true);
    try {
      await saveDayOff(user, weekStartStr, dayOff, notes);
      setSavedDayOff(dayOff);
      setSavedNotes(notes);
      toast.success(`יום החופש נשמר: יום ${DAY_NAMES_HE[dayOff]}`);
    } catch (error) {
      console.error('ShiftSubmissionPage: error submitting', error);
      toast.error('שגיאה בשליחה: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (weekOffset === null || profileLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-16" />
        <div className="grid grid-cols-2 gap-3">
          {SELECTABLE_DAYS.map((d) => <Skeleton key={d} className="h-20" />)}
        </div>
      </div>
    );
  }

  const disabled = !isWeekOpen || loading;

  return (
    <div className="space-y-4">
      <WeekNavigator
        weekStart={weekStart}
        label="הגשה לשבוע"
        onPrev={() => setWeekOffset((o) => o - 1)}
        onNext={() => setWeekOffset((o) => o + 1)}
        canPrev={weekOffset > 0}
        canNext={weekOffset < MAX_WEEK_OFFSET}
      />

      {!mission ? (
        <Card className="flex gap-3 border-warning/30 bg-warning-soft p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-bold">לא ניתן להגיש כרגע</p>
            <p className="mt-1">המשימה שלך טרם הוגדרה. נא לפנות למנהל כדי שישייך אותך למשימה.</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Status banner */}
          {loading ? (
            <Skeleton className="h-14" />
          ) : !isWeekOpen ? (
            <div className="flex items-center gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              <Lock className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">השבוע סגור להגשה</p>
                <p className="text-danger/80">לא ניתן לשנות את יום החופש לשבוע זה.</p>
              </div>
            </div>
          ) : savedDayOff && !dirty ? (
            <div className="flex items-center gap-3 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">נשלח · יום {DAY_NAMES_HE[savedDayOff]}</p>
                <p className="text-success/80">אפשר לשנות כל עוד השבוע פתוח.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-info-soft px-4 py-3 text-sm text-blue-900">
              <Sun className="h-5 w-5 shrink-0 text-info" />
              <p>
                <span className="font-bold">השבוע פתוח להגשה.</span> בחר/י יום אחד שבו תרצה/י חופש.
              </p>
            </div>
          )}

          {/* Day picker */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SELECTABLE_DAYS.map((day, index) => {
              const selected = dayOff === day;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => setDayOff(selected ? null : day)}
                  aria-pressed={selected}
                  className={cn(
                    'relative flex h-20 flex-col items-start justify-center rounded-2xl border-2 px-4 text-right transition-all active:scale-[.98]',
                    selected
                      ? 'border-warning bg-warning-soft shadow-sm'
                      : 'border-border bg-card hover:border-warning/50',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <span className="text-base font-bold">יום {DAY_NAMES_HE[day]}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatShortDate(addDays(weekStart, index))}
                  </span>
                  {selected && (
                    <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-warning text-white">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="mb-1.5 block text-sm font-semibold">
              הערות למנהל <span className="font-normal text-muted-foreground">(לא חובה)</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
              placeholder="לדוגמה: תור לרופא ביום רביעי בבוקר"
              rows={3}
              disabled={disabled}
              className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <p className="mt-1 text-left text-xs text-muted-foreground tabular-nums">{notes.length}/{NOTES_MAX}</p>
          </div>

          {/* Sticky submit, sits above the bottom nav */}
          {isWeekOpen && (
            <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border/60 bg-background/90 px-4 py-3 backdrop-blur-md">
              <div className="mx-auto max-w-2xl">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={saving || !dayOff || !dirty}
                >
                  {saving ? (
                    <Spinner className="text-primary-foreground" />
                  ) : !dayOff ? (
                    'בחר/י יום חופש'
                  ) : !dirty ? (
                    <>
                      <Check className="h-5 w-5" /> נשמר
                    </>
                  ) : savedDayOff ? (
                    `עדכון ליום ${DAY_NAMES_HE[dayOff]}`
                  ) : (
                    `שליחה · יום ${DAY_NAMES_HE[dayOff]}`
                  )}
                </Button>
              </div>
            </div>
          )}
          {isWeekOpen && <div className="h-16" aria-hidden />}
        </>
      )}
    </div>
  );
}
