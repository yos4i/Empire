import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Search, Users, Sun } from 'lucide-react';
import { db } from '../config/firebase';
import { AdminPage } from '../components/admin/AdminShell';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/spinner';
import { EmptyState } from '../components/ui/empty-state';
import { Segmented } from '../components/ui/segmented';
import WeekNavigator from '../components/shared/WeekNavigator';
import { deriveDayOff } from '../components/soldier/dayOff';
import { User } from '../entities/User';
import { ShiftSubmission } from '../entities/ShiftSubmission';
import { DAYS } from '../config/shifts';
import { getDefaultWeekStart } from '../utils/weekKey';
import { DAY_LETTERS_HE, DAY_NAMES_HE } from '../utils/days';
import { cn } from '../lib/utils';

export default function ShiftPreferencesPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [soldierNotes, setSoldierNotes] = useState({}); // Store soldier notes by user ID
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(() => getDefaultWeekStart());
  const [filter, setFilter] = useState('all');

  const selectedWeekStr = format(selectedWeek, 'yyyy-MM-dd');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load users
      const allUsers = await User.list();
      const usersMap = allUsers.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});
      setUsers(usersMap);

      // Load submissions from shift_preferences collection (same as Schedule Management)
      const submissionsMap = {};
      const notesMap = {};

      try {
        const q = query(collection(db, 'shift_preferences'), where('weekStart', '==', selectedWeekStr));
        const snapshot = await getDocs(q);


        snapshot.docs.forEach(doc => {
          const data = doc.data();

          // Map the userId from the document to the user
          if (data.userId && data.days) {
            // Find the user by matching uid or id
            const user = allUsers.find(u => u.uid === data.userId || u.id === data.userId);
            if (user) {
              submissionsMap[user.id] = data.days;
              // Store notes if available
              if (data.notes) {
                notesMap[user.id] = data.notes;
              }
            }
          }
        });
      } catch (error) {
        console.error('Error loading from shift_preferences:', error);
      }

      // Fallback: check user weekly_shifts data
      allUsers.forEach(user => {
        if (!submissionsMap[user.id] && user.weekly_shifts && user.weekly_shifts[selectedWeekStr]) {
          const userShifts = user.weekly_shifts[selectedWeekStr].shifts;
          if (userShifts) {
            submissionsMap[user.id] = userShifts;
          }
        }
      });

      // Final fallback: check shift_submissions collection
      const allSubmissions = await ShiftSubmission.filter({ week_start: selectedWeekStr });
      allSubmissions.forEach(sub => {
        if (!submissionsMap[sub.user_id]) {
          submissionsMap[sub.user_id] = sub.shifts;
        }
      });

      setSubmissions(submissionsMap);
      setSoldierNotes(notesMap);
    } catch (error) {
      console.error("Error loading shift preferences data:", error);
    }
    setLoading(false);
  }, [selectedWeekStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeUsers = Object.values(users).filter((user) => user.role !== 'admin' && user.is_active);
  const hasSubmission = (user) =>
    !!submissions[user.id] && Object.values(submissions[user.id]).some((dayShifts) => dayShifts.length > 0);
  const submittedCount = activeUsers.filter(hasSubmission).length;

  const filteredUsers = activeUsers
    .filter((user) => {
      const q = searchTerm.trim().toLowerCase();
      if (q && !(`${user.hebrew_name || user.full_name || ''} ${user.personal_number || ''}`).toLowerCase().includes(q)) return false;
      if (filter === 'pending') return !hasSubmission(user);
      if (filter === 'notes') return !!soldierNotes[user.id];
      return true;
    })
    .sort((a, b) => (a.hebrew_name || a.full_name || '').localeCompare(b.hebrew_name || b.full_name || '', 'he'));

  // Day-off model: the one selectable day left empty is the requested day off.
  const dayOffOf = (user) => (hasSubmission(user) ? deriveDayOff({ days: submissions[user.id] }) : null);

  const dayOffCounts = DAYS.reduce((acc, day) => {
    acc[day] = activeUsers.filter((u) => dayOffOf(u) === day).length;
    return acc;
  }, {});

  const pct = activeUsers.length ? Math.round((submittedCount / activeUsers.length) * 100) : 0;

  return (
    <AdminPage>
      <PageHeader
        title="העדפות"
        subtitle="ימי החופש שהחיילים ביקשו"
        actions={
          <WeekNavigator
            compact
            className="w-64"
            weekStart={selectedWeek}
            onPrev={() => setSelectedWeek((w) => addDays(w, -7))}
            onNext={() => setSelectedWeek((w) => addDays(w, 7))}
            onToday={() => setSelectedWeek(getDefaultWeekStart())}
            isToday={selectedWeekStr === format(getDefaultWeekStart(), 'yyyy-MM-dd')}
          />
        }
      />

      {/* Summary strip */}
      <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-extrabold tabular-nums">
            {submittedCount}/{activeUsers.length}
          </div>
          <div className="text-sm text-muted-foreground">הגישו</div>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full', pct === 100 ? 'bg-success' : 'bg-warning')} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">חופש לפי יום:</span>
          {DAYS.map((day) => (
            <span key={day} className="rounded-lg bg-muted px-2 py-0.5 tabular-nums">
              {DAY_LETTERS_HE[day]} <strong>{dayOffCounts[day]}</strong>
            </span>
          ))}
        </div>
      </Card>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם או מ.א"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9"
          />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'כולם' },
            { value: 'pending', label: `לא הגישו (${activeUsers.length - submittedCount})` },
            { value: 'notes', label: 'עם הערות' },
          ]}
        />
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState icon={Users} title="אין חיילים מתאימים" description="נסה/י חיפוש או סינון אחר." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="sticky right-0 bg-muted/95 px-4 py-2.5 text-right font-semibold">חייל</th>
                  {DAYS.map((day, index) => (
                    <th key={day} className="px-2 py-2.5 text-center font-semibold">
                      {DAY_NAMES_HE[day]}
                      <span className="mr-1 font-normal tabular-nums">{format(addDays(selectedWeek, index), 'd/M')}</span>
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-semibold">הערות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filteredUsers.map((user) => {
                  const submitted = hasSubmission(user);
                  const dayOff = dayOffOf(user);
                  const notes = soldierNotes[user.id];
                  return (
                    <tr
                      key={user.id}
                      onClick={() => navigate(`/schedule-management?week=${selectedWeekStr}&soldier=${user.id}`)}
                      className="group cursor-pointer hover:bg-accent/60"
                      title="פתיחה בסידור השבועי"
                    >
                      <td className="sticky right-0 bg-card px-4 py-2.5 group-hover:bg-accent">
                        <div className="font-semibold">{user.hebrew_name || user.full_name}</div>
                        {!submitted && <div className="text-xs text-warning">לא הגיש/ה</div>}
                      </td>
                      {DAYS.map((day) => (
                        <td key={day} className="px-2 py-2.5 text-center">
                          {!submitted ? (
                            <span className="text-muted-foreground/50">·</span>
                          ) : dayOff === day ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-amber-800">
                              <Sun className="h-3 w-3" /> חופש
                            </span>
                          ) : (
                            <span className="inline-block h-2 w-2 rounded-full bg-success/60" aria-label="זמין" />
                          )}
                        </td>
                      ))}
                      <td className="max-w-[260px] px-4 py-2.5 text-xs text-slate-700">
                        {notes ? <span className="line-clamp-2" title={notes}>{notes}</span> : <span className="text-muted-foreground/50">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
