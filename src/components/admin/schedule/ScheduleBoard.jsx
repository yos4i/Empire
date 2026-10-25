import React from 'react';
import { Clock, Clock3, X, ArrowLeftRight, MessageSquare, AlertTriangle, Sun, Ban, RotateCcw, ExternalLink } from 'lucide-react';
import { addDays } from 'date-fns';
import { DAYS, SHIFT_NAMES, SHIFT_TYPES_HE } from '../../../config/shifts';
import { getLongShiftEndTime } from '../../../utils/weekKey';
import { DAY_NAMES_HE, formatShortDate, toISODate } from '../../../utils/days';
import { cn } from '../../../lib/utils';

const MAX_SHIFTS = 6;

const coverage = (shift) => {
  const assigned = shift.soldiers?.length || 0;
  const required = shift.required || 0;
  if (shift.cancelled) return { tone: 'muted', assigned, required };
  if (assigned === 0) return { tone: 'danger', assigned, required };
  if (assigned < required) return { tone: 'warning', assigned, required };
  if (assigned === required) return { tone: 'success', assigned, required };
  return { tone: 'info', assigned, required };
};

const TONE = {
  danger: { badge: 'bg-danger-soft text-danger', bar: 'bg-danger' },
  warning: { badge: 'bg-warning-soft text-amber-800', bar: 'bg-warning' },
  success: { badge: 'bg-success-soft text-success', bar: 'bg-success' },
  info: { badge: 'bg-info-soft text-info', bar: 'bg-info' },
  muted: { badge: 'bg-muted text-muted-foreground', bar: 'bg-slate-300' },
};

const shiftLabel = (shiftKey) => (SHIFT_TYPES_HE[shiftKey]?.name || shiftKey).replace('ק.חינוך ', '').replace(/_/g, ' ');

const shiftTime = (shift, shiftKey, shiftNames) => {
  if (shift.customStartTime && shift.customEndTime) return `${shift.customStartTime}–${shift.customEndTime}`;
  const m = (shiftNames[shiftKey] || SHIFT_NAMES[shiftKey] || '').match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
  return m ? `${m[1]}–${m[2]}` : '';
};

/**
 * Weekly board: rows = shift types, columns = days.
 * Clicking a cell while a soldier is selected toggles them in that shift.
 */
export default function ScheduleBoard({
  schedule,
  weekStart,
  users,
  soldierShiftCounts,
  soldierNotes = {},
  dayOffBySoldier = {},
  onCancelShift,
  onRemoveSoldier,
  onShiftSlotClick,
  selectedSoldierId,
  onEditShiftHours,
  dynamicShiftNames,
  shiftAssignments = [],
  onToggleLongShift,
  onShowNote,
  onOpenDay,
}) {
  const shiftNames = dynamicShiftNames || SHIFT_NAMES;
  const shiftKeys = Object.keys(SHIFT_NAMES);
  const todayStr = toISODate(new Date());

  const isLongShiftFor = (soldierId, shiftKey, day) =>
    !!schedule?.[day]?.[shiftKey]?.longShiftSoldiers?.includes(soldierId);

  const assignmentFor = (soldierId, shiftKey, day) => {
    const uid = users[soldierId]?.uid || soldierId;
    return shiftAssignments.find((a) => a.soldier_id === uid && a.shift_type === shiftKey && a.day_name === day);
  };

  const selectedInDay = (day) =>
    selectedSoldierId
      ? shiftKeys.filter((k) => schedule?.[day]?.[k]?.soldiers?.includes(selectedSoldierId))
      : [];

  const renderChip = (soldierId, shiftKey, day) => {
    const soldier = users[soldierId];
    if (!soldier) return null;
    const assignment = assignmentFor(soldierId, shiftKey, day);
    const swap = assignment?.status === 'swap_requested';
    const isLong = isLongShiftFor(soldierId, shiftKey, day);
    const overworked = (soldierShiftCounts[soldierId] || 0) > MAX_SHIFTS;
    const onDayOff = dayOffBySoldier[soldierId] === day;
    const note = soldierNotes[soldier.uid] || soldierNotes[soldier.id];
    const isSelected = soldierId === selectedSoldierId;
    const isMorning = shiftKey.includes('בוקר');

    const titleParts = [soldier.hebrew_name];
    if (swap) titleParts.push(`בקשת החלפה${assignment.swap_reason ? `: ${assignment.swap_reason}` : ''}`);
    if (onDayOff) titleParts.push('ביקש/ה חופש ביום זה');
    if (overworked) titleParts.push(`${soldierShiftCounts[soldierId]} משמרות השבוע`);
    if (isLong) titleParts.push(`ארוכה עד ${getLongShiftEndTime(day)}`);

    return (
      <div
        key={soldierId}
        title={titleParts.join(' · ')}
        className={cn(
          'group relative flex h-7 max-w-full items-center gap-1 rounded-lg border px-2 text-xs font-medium',
          swap
            ? 'border-swap/40 bg-swap-soft'
            : overworked || onDayOff
            ? 'border-danger/40 bg-danger-soft'
            : isLong
            ? 'border-warning/40 bg-warning-soft'
            : 'border-border bg-card',
          isSelected && 'ring-2 ring-primary ring-offset-1'
        )}
      >
        <span className="truncate">{soldier.hebrew_name}</span>
        <span className="flex shrink-0 items-center gap-0.5">
          {isLong && <Clock3 className="h-3 w-3 text-warning" />}
          {swap && <ArrowLeftRight className="h-3 w-3 text-swap" />}
          {onDayOff && <Sun className="h-3 w-3 text-danger" />}
          {overworked && <AlertTriangle className="h-3 w-3 text-danger" />}
          {note && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onShowNote?.(soldier, note, assignment); }}
              className="rounded text-info hover:bg-info-soft"
              aria-label="הערה"
            >
              <MessageSquare className="h-3 w-3" />
            </button>
          )}
        </span>
        {/* Hover actions (always visible on touch devices) */}
        <span className="absolute inset-y-0 left-0 flex items-center gap-0.5 rounded-l-lg bg-inherit pl-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          {onToggleLongShift && isMorning && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleLongShift(day, shiftKey, soldierId, !isLong); }}
              className={cn('flex h-5 w-5 items-center justify-center rounded', isLong ? 'text-warning hover:bg-warning/15' : 'text-slate-400 hover:bg-slate-100')}
              aria-label={isLong ? 'ביטול משמרת ארוכה' : 'סימון משמרת ארוכה'}
              title={isLong ? 'ביטול משמרת ארוכה' : 'סימון משמרת ארוכה'}
            >
              <Clock3 className="h-3.5 w-3.5" />
            </button>
          )}
          {onRemoveSoldier && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemoveSoldier(day, shiftKey, soldierId); }}
              className="flex h-5 w-5 items-center justify-center rounded text-danger hover:bg-danger/10"
              aria-label="הסרה מהמשמרת"
              title="הסרה מהמשמרת"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </div>
    );
  };

  const renderCell = (day, shiftKey) => {
    const shift = schedule[day]?.[shiftKey];
    if (!shift) {
      return (
        <div className="flex min-h-[72px] items-center justify-center rounded-xl border border-dashed bg-muted/40 text-xs text-muted-foreground">
          אין משמרת
        </div>
      );
    }
    const cov = coverage(shift);
    const time = shiftTime(shift, shiftKey, shiftNames);
    const pct = cov.required ? Math.min(100, (cov.assigned / cov.required) * 100) : 0;
    const hasSelected = selectedSoldierId && shift.soldiers?.includes(selectedSoldierId);
    const selectedDayOff = selectedSoldierId && dayOffBySoldier[selectedSoldierId] === day;
    const otherShiftSameDay = !hasSelected && selectedInDay(day).length > 0;
    const clickable = selectedSoldierId && !shift.cancelled;

    return (
      <div
        onClick={(e) => {
          if (e.target.closest('button')) return;
          if (clickable) onShiftSlotClick?.(day, shiftKey);
        }}
        className={cn(
          'flex h-full flex-col rounded-xl border bg-card transition-shadow',
          shift.cancelled && 'opacity-60',
          clickable && 'cursor-pointer hover:shadow-md hover:ring-2 hover:ring-primary/40',
          hasSelected && 'ring-2 ring-primary',
          clickable && selectedDayOff && 'bg-stripes-danger'
        )}
      >
        <div className="flex items-center gap-1.5 border-b px-2.5 py-1.5">
          <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-muted-foreground" dir="ltr">{time || '—'}</span>
          {onEditShiftHours && !shift.cancelled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEditShiftHours(day, shiftKey, shiftNames[shiftKey], shift); }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="עריכת שעות"
              title="עריכת שעות"
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="flex-1" />
          {shift.cancelled ? (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', TONE.muted.badge)}>מבוטלת</span>
          ) : (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold tabular-nums', TONE[cov.tone].badge)}>
              {cov.assigned}/{cov.required}
            </span>
          )}
          {onCancelShift && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCancelShift(day, shiftKey); }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={shift.cancelled ? 'שחזור משמרת' : 'ביטול משמרת'}
              title={shift.cancelled ? 'שחזור משמרת' : 'ביטול משמרת'}
            >
              {shift.cancelled ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        {!shift.cancelled && (
          <div className="h-1 bg-muted">
            <div className={cn('h-full transition-all', TONE[cov.tone].bar)} style={{ width: `${pct}%` }} />
          </div>
        )}
        {(selectedDayOff || otherShiftSameDay) && clickable && (
          <div className="flex flex-wrap gap-1 px-2 pt-1.5">
            {selectedDayOff && (
              <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-danger">
                <Sun className="h-3 w-3" /> ביקש/ה חופש
              </span>
            )}
            {otherShiftSameDay && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                <AlertTriangle className="h-3 w-3" /> כבר ב{shiftLabel(selectedInDay(day)[0]).replace('קריית חינוך ', '')}
              </span>
            )}
          </div>
        )}
        <div className="flex flex-1 flex-wrap content-start gap-1 p-2">
          {shift.soldiers?.map((id) => renderChip(id, shiftKey, day))}
          {!shift.cancelled && (shift.soldiers?.length || 0) === 0 && (
            <span className="w-full py-3 text-center text-xs text-muted-foreground">
              {selectedSoldierId ? 'לחיצה תוסיף את החייל' : 'ריק'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-auto rounded-2xl border bg-muted/30">
      <div
        className="grid min-w-[1080px] gap-2 p-2"
        style={{ gridTemplateColumns: '92px repeat(6, minmax(160px, 1fr))' }}
      >
        {/* Header row */}
        <div className="sticky right-0 top-0 z-20 bg-transparent" />
        {DAYS.map((day, i) => {
          const date = addDays(weekStart, i);
          const isToday = toISODate(date) === todayStr;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onOpenDay?.(toISODate(date))}
              className={cn(
                'group sticky top-0 z-10 flex items-center justify-center gap-1.5 rounded-xl border bg-card px-2 py-2 text-sm font-bold shadow-sm transition-colors hover:border-primary/50 hover:text-primary',
                isToday && 'border-primary/50 text-primary'
              )}
              title="מעבר לסידור היומי"
            >
              {DAY_NAMES_HE[day]}
              <span className="font-medium tabular-nums text-muted-foreground group-hover:text-primary">{formatShortDate(date)}</span>
              <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          );
        })}

        {shiftKeys.map((shiftKey) => (
          <React.Fragment key={shiftKey}>
            <div className="sticky right-0 z-10 flex items-center justify-center rounded-xl bg-slate-800 px-2 py-3 text-center text-sm font-bold leading-tight text-white">
              {shiftLabel(shiftKey)}
            </div>
            {DAYS.map((day) => (
              <div key={`${day}-${shiftKey}`} className="min-w-0">
                {renderCell(day, shiftKey)}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
