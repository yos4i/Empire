import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { formatWeekRange } from '../../utils/days';

/**
 * Shared week switcher.
 * RTL: the right arrow (start) goes back in time, the left arrow goes forward.
 */
export default function WeekNavigator({
  weekStart,
  onPrev,
  onNext,
  onToday,
  canPrev = true,
  canNext = true,
  label,
  todayLabel = 'השבוע',
  isToday = false,
  className,
  compact = false,
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Button
        variant="outline"
        size={compact ? 'icon-sm' : 'icon'}
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="שבוע קודם"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
      <div className="min-w-0 flex-1 text-center">
        {label && <div className="text-[11px] font-medium text-muted-foreground">{label}</div>}
        <div className="truncate text-sm font-bold tabular-nums" dir="rtl">
          {formatWeekRange(weekStart)}
        </div>
      </div>
      <Button
        variant="outline"
        size={compact ? 'icon-sm' : 'icon'}
        onClick={onNext}
        disabled={!canNext}
        aria-label="שבוע הבא"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      {onToday && !isToday && (
        <Button variant="ghost" size={compact ? 'xs' : 'sm'} onClick={onToday} className="text-primary">
          {todayLabel}
        </Button>
      )}
    </div>
  );
}
