import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarRange, CalendarCheck, ListChecks, Users, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../ui/confirm-dialog';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { cn } from '../../lib/utils';

export const ADMIN_NAV = [
  { to: '/admin', label: 'סקירה', icon: LayoutDashboard, end: true },
  { to: '/schedule-management', label: 'סידור שבועי', icon: CalendarRange },
  { to: '/daily-auto-schedule', label: 'סידור יומי', icon: CalendarCheck },
  { to: '/shift-preferences', label: 'העדפות', icon: ListChecks },
  { to: '/admin/soldiers', label: 'חיילים', icon: Users },
];

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1">
      {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
              isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-slate-600 hover:bg-accent hover:text-foreground'
            )
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
      <div className="leading-tight">
        <div className="font-extrabold">אימפריה</div>
        <div className="text-xs text-muted-foreground">ניהול סידור</div>
      </div>
    </div>
  );
}

export default function AdminShell() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    if (!(await confirm({ title: 'להתנתק?', confirmText: 'התנתקות' }))) return;
    await signOut();
    navigate('/login', { replace: true });
  };

  const logoutButton = (
    <button
      type="button"
      onClick={handleLogout}
      className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-danger-soft hover:text-danger"
    >
      <LogOut className="h-5 w-5" />
      התנתקות
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar (RTL: right edge) */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-60 flex-col border-l bg-card px-3 py-4 lg:flex">
        <Brand />
        <div className="mt-6 flex-1">
          <NavItems />
        </div>
        {logoutButton}
      </aside>

      {/* Mobile top bar */}
      <header className="pt-safe sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/90 px-3 backdrop-blur-md lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-accent"
          aria-label="תפריט"
        >
          <Menu className="h-6 w-6" />
        </button>
      </header>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent side="right" className="w-72 px-3 py-4 sm:w-72">
          <DialogTitle className="sr-only">תפריט</DialogTitle>
          <Brand />
          <div className="mt-6 flex-1">
            <NavItems onNavigate={() => setMenuOpen(false)} />
          </div>
          {logoutButton}
        </DialogContent>
      </Dialog>

      <main className="lg:pr-60">
        <Outlet />
      </main>
    </div>
  );
}

/** Standard padded page container for admin pages. */
export function AdminPage({ className, children }) {
  return <div className={cn('mx-auto max-w-[1600px] px-4 py-5 lg:px-8 lg:py-6', className)}>{children}</div>;
}
