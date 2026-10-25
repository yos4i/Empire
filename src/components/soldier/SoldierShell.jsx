import React, { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Home, CalendarDays, Sun, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SoldierProvider, useSoldier } from './SoldierContext';
import { cn } from '../../lib/utils';

const TABS = [
  { to: '', label: 'בית', icon: Home, end: true },
  { to: 'schedule', label: 'סידור', icon: CalendarDays },
  { to: 'shifts', label: 'יום חופש', icon: Sun },
  { to: 'status', label: 'פרופיל', icon: UserRound },
];

const TITLES = {
  '': null, // home renders its own greeting
  schedule: 'סידור הצוות',
  shifts: 'בחירת יום חופש',
  status: 'הפרופיל שלי',
};

function TopBar() {
  const location = useLocation();
  const { profile } = useSoldier();
  const segment = location.pathname.split('/')[3] || '';
  const title = TITLES[segment];
  const onStandby = !!profile?.on_standby;

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-lg" />
          <span className="text-base font-bold">{title || 'אימפריה'}</span>
        </div>
        {profile && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              onStandby ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground'
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', onStandby ? 'bg-success' : 'bg-slate-400')} />
            {onStandby ? 'בכוננות' : 'לא בכוננות'}
          </span>
        )}
      </div>
    </header>
  );
}

function BottomNav({ base }) {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 backdrop-blur-md">
      <div className="mx-auto grid max-w-2xl grid-cols-4">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to ? `${base}/${to}` : base}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                    isActive && 'bg-primary/10'
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function SoldierShell() {
  const { user } = useAuth();
  const { soldierId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // A soldier may only view their own routes.
  useEffect(() => {
    if (user && soldierId && user.uid !== soldierId) {
      const rest = location.pathname.split('/').slice(3).join('/');
      navigate(`/soldier/${user.uid}${rest ? `/${rest}` : ''}`, { replace: true });
    }
  }, [user, soldierId, navigate, location.pathname]);

  const base = `/soldier/${user?.uid || soldierId}`;

  return (
    <SoldierProvider>
      <div className="min-h-screen bg-background">
        <TopBar />
        <main className="mx-auto max-w-2xl px-4 pb-28 pt-4">
          <Outlet />
        </main>
        <BottomNav base={base} />
      </div>
    </SoldierProvider>
  );
}
