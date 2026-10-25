import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, UserPlus, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { AdminPage } from '../components/admin/AdminShell';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/spinner';
import { EmptyState } from '../components/ui/empty-state';
import { Segmented } from '../components/ui/segmented';
import AddSoldierDialog from '../components/admin/AddSoldierDialog';
import SoldierDetailsDialog from '../components/admin/SoldierDetailsDialog';
import { hasSubmitted, loadActiveSoldiers, loadSubmittedIds } from '../components/admin/adminData';
import { findSubmissionWeek, submissionWeekStart } from '../components/soldier/dayOff';
import { ShiftAssignment } from '../entities/ShiftAssignment';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultWeekStart, toWeekStartISO } from '../utils/weekKey';
import { formatShortDate, toISODate } from '../utils/days';
import { addDays } from 'date-fns';
import { cn } from '../lib/utils';

const FILTERS = [
  { value: 'all', label: 'כולם' },
  { value: 'standby_off', label: 'לא בכוננות' },
  { value: 'not_submitted', label: 'לא הגישו' },
  { value: 'no_mission', label: 'בלי משימה' },
];

const COLUMNS = [
  { key: 'name', label: 'שם' },
  { key: 'personal_number', label: 'מ.א', className: 'hidden md:table-cell' },
  { key: 'standby', label: 'כוננות' },
  { key: 'submitted', label: 'יום חופש' },
  { key: 'shifts', label: 'משמרות השבוע', className: 'hidden sm:table-cell' },
];

export default function SoldiersPage() {
  const { addSoldier, deleteSoldier } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [soldiers, setSoldiers] = useState(null);
  const [submittedIds, setSubmittedIds] = useState(new Set());
  const [submissionWeek, setSubmissionWeek] = useState(null);
  const [shiftCounts, setShiftCounts] = useState({});
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 1 });
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const filter = searchParams.get('filter') || 'all';

  const load = useCallback(async () => {
    const weekStart = getDefaultWeekStart();
    const weekStr = toWeekStartISO(weekStart);
    const weekEnd = toISODate(addDays(weekStart, 6));
    const [list, { offset }, assignments] = await Promise.all([
      loadActiveSoldiers(),
      findSubmissionWeek(),
      ShiftAssignment.filter({ start_date: weekStr, end_date: weekEnd }).catch(() => []),
    ]);
    const subWeek = submissionWeekStart(offset);
    setSubmissionWeek(subWeek);
    setSubmittedIds(await loadSubmittedIds(toWeekStartISO(subWeek)));
    const counts = {};
    assignments.forEach((a) => { counts[a.soldier_id] = (counts[a.soldier_id] || 0) + 1; });
    setShiftCounts(counts);
    setSoldiers(list);
  }, []);

  useEffect(() => {
    load().catch((e) => {
      console.error('SoldiersPage: load failed', e);
      setSoldiers([]);
    });
  }, [load]);

  const shiftsOf = useCallback((s) => (shiftCounts[s.uid] || 0) + (s.uid !== s.id ? shiftCounts[s.id] || 0 : 0), [shiftCounts]);

  const rows = useMemo(() => {
    if (!soldiers) return [];
    const q = search.trim().toLowerCase();
    return soldiers
      .filter((s) => {
        if (q && !`${s.hebrew_name} ${s.personal_number} ${s.username || ''}`.toLowerCase().includes(q)) return false;
        if (filter === 'standby_off') return !s.on_standby;
        if (filter === 'not_submitted') return !hasSubmitted(s, submittedIds);
        if (filter === 'no_mission') return !s.mission;
        return true;
      })
      .sort((a, b) => {
        const val = (s) => {
          switch (sort.key) {
            case 'personal_number': return s.personal_number || '';
            case 'standby': return s.on_standby ? 1 : 0;
            case 'submitted': return hasSubmitted(s, submittedIds) ? 1 : 0;
            case 'shifts': return shiftsOf(s);
            default: return s.hebrew_name || '';
          }
        };
        const x = val(a);
        const y = val(b);
        const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'he');
        return cmp * sort.dir;
      });
  }, [soldiers, search, filter, sort, submittedIds, shiftsOf]);

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));

  const handleAdd = async (data) => {
    await addSoldier(data);
    await load();
  };

  const handleDelete = async (soldier) => {
    await deleteSoldier(soldier);
    await load();
  };

  return (
    <AdminPage>
      <PageHeader
        title="חיילים"
        subtitle={soldiers ? `${soldiers.length} חיילים פעילים` : ' '}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <UserPlus className="h-4 w-4" /> הוספת חייל
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש לפי שם או מ.א" className="pr-9" />
        </div>
        <Segmented
          options={FILTERS}
          value={filter}
          onChange={(v) => setSearchParams(v === 'all' ? {} : { filter: v }, { replace: true })}
          className="no-scrollbar max-w-full overflow-x-auto"
        />
      </div>

      <Card className="overflow-hidden p-0">
        {!soldiers ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="אין חיילים מתאימים" description="נסה/י חיפוש או סינון אחר." />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} className={cn('px-4 py-2.5 text-right font-semibold', c.className)}>
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                      {c.key === 'submitted' && submissionWeek ? `${c.label} (${formatShortDate(submissionWeek)})` : c.label}
                      {sort.key === c.key && (sort.dir === 1 ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((s) => {
                const submitted = hasSubmitted(s, submittedIds);
                const shifts = shiftsOf(s);
                return (
                  <tr key={s.id} onClick={() => setSelected(s)} className="cursor-pointer transition-colors hover:bg-accent/60">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold">{s.hebrew_name}</div>
                      {!s.mission && <div className="text-xs text-warning">ללא משימה</div>}
                    </td>
                    <td className="hidden px-4 py-2.5 tabular-nums text-muted-foreground md:table-cell">
                      {s.personal_number !== 'לא מולא' ? s.personal_number : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.on_standby ? <Badge variant="success">בכוננות</Badge> : <Badge variant="destructive">לא</Badge>}
                    </td>
                    <td className="px-4 py-2.5">
                      {submitted ? <Badge variant="success">הגיש</Badge> : <Badge variant="warning">לא הגיש</Badge>}
                    </td>
                    <td className="hidden px-4 py-2.5 tabular-nums sm:table-cell">{shifts || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <AddSoldierDialog isOpen={showAdd} onClose={() => setShowAdd(false)} onAddSoldier={handleAdd} />
      <SoldierDetailsDialog
        isOpen={!!selected}
        soldier={selected}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
        onUpdated={(updated) => {
          setSelected(updated);
          setSoldiers((list) => list.map((s) => (s.id === updated.id ? updated : s)));
        }}
      />
    </AdminPage>
  );
}
