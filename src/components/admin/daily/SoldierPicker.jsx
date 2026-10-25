import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../../lib/utils';

/**
 * Searchable soldier picker shown as a small popover under a slot's "+" button.
 * Render it inside a `relative` container; it positions itself below it.
 *
 * Props:
 *   options  — [{ id, name, scheduled, conflict, hours }]
 *              scheduled: rostered for the day; conflict: already booked in an
 *              overlapping slot (shown disabled with a "חופף" label).
 *   onPick   — (id) => void
 *   onClose  — () => void   (click outside / Esc). A trigger button that
 *              toggles the picker should stop mousedown propagation while
 *              open, so the outside-click close doesn't immediately re-open.
 *   className — extra classes for the panel (e.g. positioning overrides)
 */
export default function SoldierPicker({ options, onPick, onClose, className }) {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => (o.name || '').toLowerCase().includes(q));
  }, [options, query]);

  const groups = useMemo(
    () => [
      { key: 'scheduled', label: 'משובצים היום', items: filtered.filter((o) => o.scheduled) },
      { key: 'unscheduled', label: 'לא משובצים', items: filtered.filter((o) => !o.scheduled) },
    ],
    [filtered]
  );

  // Keyboard navigation runs over enabled rows only, in display order.
  const selectable = useMemo(
    () => groups.flatMap((g) => g.items).filter((o) => !o.conflict),
    [groups]
  );

  // Keep the highlighted row valid as the filter changes.
  useEffect(() => {
    if (!selectable.some((o) => o.id === activeId)) {
      setActiveId(selectable[0]?.id ?? null);
    }
  }, [selectable, activeId]);

  // Close on click outside or Esc (wherever focus is).
  useEffect(() => {
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  // Keep the highlighted row in view while arrowing through the list.
  useEffect(() => {
    if (!activeId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-id="${CSS.escape(activeId)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const move = (delta) => {
    if (selectable.length === 0) return;
    const idx = selectable.findIndex((o) => o.id === activeId);
    const next = idx === -1 ? 0 : (idx + delta + selectable.length) % selectable.length;
    setActiveId(selectable[next].id);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeId) onPick(activeId);
    }
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="בחירת חייל"
      className={cn(
        'absolute right-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl',
        className
      )}
      onKeyDown={onKeyDown}
    >
      <div className="relative border-b p-2">
        <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש חייל..."
          aria-label="חיפוש חייל"
          className="h-9 w-full rounded-lg border border-input bg-background pr-8 pl-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">לא נמצאו חיילים</p>
        ) : (
          groups.map(
            (g) =>
              g.items.length > 0 && (
                <div key={g.key} role="group" aria-label={g.label}>
                  <div className="sticky top-0 bg-popover px-3 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">
                    {g.label}
                  </div>
                  {g.items.map((o) => {
                    const active = o.id === activeId;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        aria-disabled={o.conflict || undefined}
                        disabled={o.conflict}
                        data-id={o.id}
                        onMouseEnter={() => !o.conflict && setActiveId(o.id)}
                        onClick={() => onPick(o.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-right text-sm',
                          o.conflict
                            ? 'cursor-not-allowed text-muted-foreground opacity-60'
                            : active
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent'
                        )}
                      >
                        <span className="truncate">{o.name}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {o.conflict && (
                            <span className="rounded-full bg-danger-soft px-1.5 text-[10px] font-semibold text-danger">
                              חופף
                            </span>
                          )}
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {(o.hours || 0).toFixed(1)} ש׳
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )
          )
        )}
      </div>
    </div>
  );
}
