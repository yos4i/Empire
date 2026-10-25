import React, { useMemo, useState } from 'react';
import { Search, MessageSquare, ChevronDown, Sun, CircleSlash } from 'lucide-react';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/spinner';
import { Segmented } from '../ui/segmented';
import { DAY_LETTERS_HE } from '../../utils/days';
import { cn } from '../../lib/utils';

const SORTS = [
  { value: 'load', label: 'פחות משובצים' },
  { value: 'name', label: 'א-ב' },
];

/**
 * Soldier list for the weekly board. Click a row to select the soldier
 * (then click shifts on the board); the chevron opens their note.
 */
export default function PreferencesPanel({
  submissions,
  loading,
  soldierShiftCounts = {},
  dayOffBySoldier = {},
  onSelectSoldier,
  selectedSoldierId,
  className,
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('load');
  const [expanded, setExpanded] = useState(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions
      .filter((s) => !q || s.userName?.toLowerCase().includes(q))
      .map((s) => ({ ...s, submitted: !String(s.id).startsWith('missing_'), count: soldierShiftCounts[s.userId] || 0 }))
      .sort((a, b) =>
        sort === 'load'
          ? a.count - b.count || a.userName.localeCompare(b.userName, 'he')
          : a.userName.localeCompare(b.userName, 'he')
      );
  }, [submissions, search, sort, soldierShiftCounts]);

  const notSubmitted = rows.filter((r) => !r.submitted).length;

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-card', className)}>
      <div className="space-y-2 border-b p-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">חיילים</h2>
          <span className="text-xs text-muted-foreground">
            {rows.length} · {notSubmitted > 0 ? <span className="text-warning">{notSubmitted} לא הגישו</span> : 'כולם הגישו'}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="חיפוש" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pr-9" />
        </div>
        <Segmented options={SORTS} value={sort} onChange={setSort} className="w-full" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <div className="space-y-1.5 p-1.5">
            {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-11" />)}
          </div>
        ) : (
          rows.map((s) => {
            const selected = selectedSoldierId === s.userId;
            const dayOff = dayOffBySoldier[s.userId];
            const isOpen = expanded === s.userId;
            return (
              <div key={s.id} className={cn('rounded-xl', selected && 'bg-primary/10 ring-1 ring-primary/40')}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectSoldier?.(s.userId)}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-right transition-colors',
                      !selected && 'hover:bg-accent'
                    )}
                    aria-pressed={selected}
                  >
                    <span
                      className={cn(
                        'flex h-7 min-w-[28px] items-center justify-center rounded-lg px-1 text-xs font-bold tabular-nums',
                        s.count === 0 ? 'bg-muted text-muted-foreground' : s.count > 6 ? 'bg-danger-soft text-danger' : 'bg-primary/10 text-primary'
                      )}
                      title="משמרות השבוע"
                    >
                      {s.count}
                    </span>
                    <span className={cn('min-w-0 flex-1 truncate text-sm', selected ? 'font-bold text-primary' : 'font-medium')}>
                      {s.userName}
                    </span>
                    {s.submitted ? (
                      dayOff ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-amber-800" title="יום חופש מבוקש">
                          <Sun className="h-3 w-3" /> {DAY_LETTERS_HE[dayOff]}
                        </span>
                      ) : null
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-muted-foreground" title="לא הגיש/ה">
                        <CircleSlash className="h-3 w-3" /> לא הגיש
                      </span>
                    )}
                  </button>
                  {s.notes ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : s.userId)}
                      className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-info hover:bg-info-soft"
                      aria-label="הערה"
                      aria-expanded={isOpen}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                    </button>
                  ) : (
                    <span className="w-8 shrink-0" />
                  )}
                </div>
                {isOpen && s.notes && (
                  <p className="mx-2.5 mb-2 whitespace-pre-wrap rounded-lg bg-info-soft px-2.5 py-1.5 text-xs text-blue-900">{s.notes}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
