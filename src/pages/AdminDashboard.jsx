import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Users, Shield, ShieldOff, ArrowLeftRight, CalendarRange, CalendarCheck, ClipboardList, ChevronLeft,
  CheckCircle2, AlertTriangle, Clock,
} from "lucide-react";
import { AdminPage } from "../components/admin/AdminShell";
import { PageHeader } from "../components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/spinner";
import { EmptyState } from "../components/ui/empty-state";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody,
} from "../components/ui/dialog";
import ExchangeRequestsDialog from "../components/admin/ExchangeRequestsDialog";
import SubmissionWindowsCard from "../components/admin/SubmissionWindowsCard";
import { hasSubmitted, loadActiveSoldiers, loadSubmittedIds, loadSwapRequests } from "../components/admin/adminData";
import { findSubmissionWeek, submissionWeekStart } from "../components/soldier/dayOff";
import { WeeklySchedule } from "../entities/WeeklySchedule";
import { toWeekStartISO } from "../utils/weekKey";
import { formatWeekRange } from "../utils/days";
import { cn } from "../lib/utils";
import { SWAP_REQUESTS_ENABLED } from "../config/app";

function Kpi({ icon: Icon, label, value, tone = "primary", onClick, to }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    swap: "bg-swap-soft text-swap",
  };
  const body = (
    <Card className={cn("flex h-full items-center gap-3 p-4", (onClick || to) && "transition-colors hover:bg-accent/50")}>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold tabular-nums leading-none">{value ?? "–"}</div>
        <div className="mt-1 truncate text-sm text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
  if (to) return <Link to={to} className="block">{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="block w-full text-right">{body}</button>;
  return body;
}

function TodoItem({ tone, icon: Icon, title, subtitle, to, onClick }) {
  const tones = {
    danger: "text-danger bg-danger-soft",
    warning: "text-warning bg-warning-soft",
    swap: "text-swap bg-swap-soft",
    info: "text-info bg-info-soft",
  };
  const inner = (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-accent/60">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        {subtitle && <div className="truncate text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return <button type="button" onClick={onClick} className="block w-full text-right">{inner}</button>;
}

function StandbyReasonsDialog({ open, onClose, soldiers }) {
  const off = soldiers
    .filter((s) => !s.on_standby)
    .sort((a, b) => new Date(b.standby_updated_at || 0) - new Date(a.standby_updated_at || 0));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-danger" /> לא בכוננות
          </DialogTitle>
          <DialogDescription>{off.length} חיילים</DialogDescription>
        </DialogHeader>
        <DialogBody className="pb-5">
          {off.length === 0 ? (
            <EmptyState icon={Shield} title="כל החיילים בכוננות" />
          ) : (
            <ul className="divide-y divide-border/70">
              {off.map((s) => (
                <li key={s.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{s.hebrew_name}</span>
                    {s.standby_updated_at && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(s.standby_updated_at), "dd/MM HH:mm")}
                      </span>
                    )}
                  </div>
                  <p className={cn("mt-0.5 text-sm", s.standby_reason ? "text-slate-700" : "italic text-muted-foreground")}>
                    {s.standby_reason || "לא צוינה סיבה"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const [soldiers, setSoldiers] = useState(null);
  const [swapRequests, setSwapRequests] = useState([]);
  const [week, setWeek] = useState(null); // { start, open, submittedIds, published }
  const [showSwaps, setShowSwaps] = useState(false);
  const [showStandby, setShowStandby] = useState(false);

  const loadSwaps = useCallback(async () => {
    if (!SWAP_REQUESTS_ENABLED) return;
    setSwapRequests(await loadSwapRequests().catch(() => []));
  }, []);

  const loadWeek = useCallback(async () => {
    const { offset, open } = await findSubmissionWeek();
    const start = submissionWeekStart(offset);
    const weekStr = toWeekStartISO(start);
    const [submittedIds, published] = await Promise.all([
      loadSubmittedIds(weekStr),
      WeeklySchedule.getWeek(weekStr).catch(() => null),
    ]);
    setWeek({ start, open, submittedIds, published: !!published });
  }, []);

  useEffect(() => {
    loadActiveSoldiers().then(setSoldiers).catch(() => setSoldiers([]));
    loadSwaps();
    loadWeek().catch((e) => console.error("AdminDashboard: week status failed", e));
  }, [loadSwaps, loadWeek]);

  const loading = !soldiers || !week;
  const standbyOn = soldiers?.filter((s) => s.on_standby).length;
  const standbyOff = soldiers ? soldiers.length - standbyOn : null;
  const submitted = soldiers && week ? soldiers.filter((s) => hasSubmitted(s, week.submittedIds)).length : null;
  const notSubmitted = soldiers && submitted !== null ? soldiers.length - submitted : null;
  const noMission = soldiers?.filter((s) => !s.mission).length;
  const weekLabel = week ? formatWeekRange(week.start) : "";

  const todos = [];
  if (!loading) {
    if (swapRequests.length > 0) {
      todos.push({
        key: "swaps", tone: "swap", icon: ArrowLeftRight,
        title: `${swapRequests.length} בקשות החלפה ממתינות`, subtitle: "אישור או דחייה",
        onClick: () => setShowSwaps(true),
      });
    }
    if (week.open && notSubmitted > 0) {
      todos.push({
        key: "submit", tone: "warning", icon: ClipboardList,
        title: `${notSubmitted} חיילים לא בחרו יום חופש`, subtitle: `לשבוע ${weekLabel}`,
        to: "/admin/soldiers?filter=not_submitted",
      });
    }
    if (!week.open) {
      todos.push({
        key: "closed", tone: "info", icon: CalendarRange,
        title: "אין שבוע פתוח להגשה", subtitle: "אפשר לפתוח בכרטיס 'חלונות הגשה'",
        onClick: () => document.getElementById("submission-windows")?.scrollIntoView({ behavior: "smooth" }),
      });
    }
    if (!week.published) {
      todos.push({
        key: "publish", tone: "danger", icon: CalendarRange,
        title: `הסידור לשבוע ${weekLabel} לא פורסם`, subtitle: "מעבר לסידור השבועי",
        to: "/schedule-management",
      });
    }
    if (noMission > 0) {
      todos.push({
        key: "mission", tone: "warning", icon: AlertTriangle,
        title: `${noMission} חיילים ללא משימה`, subtitle: "הם לא רואים את הסידור",
        to: "/admin/soldiers?filter=no_mission",
      });
    }
  }

  return (
    <AdminPage>
      <PageHeader
        title="סקירה"
        subtitle={new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
      />

      <div className={cn("grid grid-cols-2 gap-3", SWAP_REQUESTS_ENABLED ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <Kpi icon={Users} label="חיילים פעילים" value={soldiers?.length} to="/admin/soldiers" />
        <Kpi
          icon={ShieldOff}
          label={`לא בכוננות · ${standbyOn ?? "–"} בכוננות`}
          value={standbyOff}
          tone={standbyOff ? "danger" : "success"}
          onClick={() => setShowStandby(true)}
        />
        <Kpi
          icon={ClipboardList}
          label={week ? `הגישו לשבוע ${formatWeekRange(week.start).split(" – ")[0]}` : "הגישו"}
          value={submitted !== null && soldiers ? `${submitted}/${soldiers.length}` : null}
          tone={notSubmitted ? "warning" : "success"}
          to="/admin/soldiers?filter=not_submitted"
        />
        {SWAP_REQUESTS_ENABLED && (
          <Kpi
            icon={ArrowLeftRight}
            label="בקשות החלפה"
            value={swapRequests.length}
            tone={swapRequests.length ? "swap" : "success"}
            onClick={() => setShowSwaps(true)}
          />
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">דורש טיפול</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : todos.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="הכל מטופל" description="אין משימות פתוחות כרגע." className="py-6" />
            ) : (
              <div className="-mx-2">
                {todos.map(({ key, ...t }) => <TodoItem key={key} {...t} />)}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/schedule-management">
              <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:bg-accent/50">
                <CalendarRange className="h-6 w-6 text-primary" />
                <span className="font-bold">סידור שבועי</span>
                <span className="text-xs text-muted-foreground">שיבוץ ופרסום לחיילים</span>
              </Card>
            </Link>
            <Link to="/daily-auto-schedule">
              <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:bg-accent/50">
                <CalendarCheck className="h-6 w-6 text-primary" />
                <span className="font-bold">סידור יומי</span>
                <span className="text-xs text-muted-foreground">שיבוץ אוטומטי לעמדות</span>
              </Card>
            </Link>
          </div>
          <div id="submission-windows">
            <SubmissionWindowsCard onChange={() => loadWeek().catch(() => {})} />
          </div>
        </div>
      </div>

      <ExchangeRequestsDialog
        isOpen={showSwaps}
        onClose={() => setShowSwaps(false)}
        exchangeRequests={swapRequests}
        soldiers={soldiers || []}
        onRefresh={loadSwaps}
      />
      <StandbyReasonsDialog open={showStandby} onClose={() => setShowStandby(false)} soldiers={soldiers || []} />
    </AdminPage>
  );
}
