import React, { useState } from 'react';
import { ArrowLeftRight, Check, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { EmptyState } from '../ui/empty-state';
import { toast } from '../ui/toaster';
import { useConfirm } from '../ui/confirm-dialog';
import { ShiftAssignment } from '../../entities/ShiftAssignment';
import { DAY_NAMES_HE, dayKeyFromDate, formatShortDate } from '../../utils/days';

const requestedAt = (value) => {
  if (!value) return null;
  const date = new Date(value.seconds ? value.seconds * 1000 : value);
  return Number.isNaN(date.getTime()) ? null : format(date, 'dd/MM HH:mm');
};

export default function ExchangeRequestsDialog({ isOpen, onClose, exchangeRequests, soldiers, onRefresh }) {
  const [actionLoading, setActionLoading] = useState({});
  const confirm = useConfirm();

  const run = async (requestId, kind, update, successMessage) => {
    try {
      setActionLoading((prev) => ({ ...prev, [requestId]: kind }));
      await ShiftAssignment.update(requestId, update);
      toast.success(successMessage);
      await onRefresh();
    } catch (error) {
      console.error('ExchangeRequestsDialog: update failed', error);
      toast.error('הפעולה נכשלה: ' + error.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: null }));
    }
  };

  const handleApprove = (requestId) =>
    run(requestId, 'approving', { status: 'assigned', swap_approved: true, swap_approved_at: new Date() }, 'הבקשה אושרה');

  const handleReject = async (requestId) => {
    const ok = await confirm({ title: 'לדחות את בקשת ההחלפה?', confirmText: 'דחייה', destructive: true });
    if (!ok) return;
    run(requestId, 'rejecting', { status: 'assigned', swap_rejected: true, swap_rejected_at: new Date() }, 'הבקשה נדחתה');
  };

  const getSoldierName = (soldierId) => {
    const soldier = soldiers.find((s) => s.id === soldierId || s.uid === soldierId);
    return soldier?.hebrew_name || soldier?.displayName || soldier?.full_name || 'לא ידוע';
  };

  const sorted = [...exchangeRequests].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-swap" />
            בקשות החלפה
          </DialogTitle>
          <DialogDescription>{exchangeRequests.length} ממתינות לטיפול</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 pb-5">
          {sorted.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title="אין בקשות ממתינות" description="כל הבקשות טופלו." />
          ) : (
            sorted.map((request) => {
              const loading = actionLoading[request.id];
              const sentAt = requestedAt(request.swap_requested_at);
              return (
                <div key={request.id} className="rounded-2xl border border-swap/25 bg-swap-soft/50 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-base font-bold">{getSoldierName(request.soldier_id)}</span>
                    {sentAt && <span className="text-xs text-muted-foreground">נשלח {sentAt}</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {request.date
                      ? `יום ${DAY_NAMES_HE[dayKeyFromDate(request.date)]} ${formatShortDate(request.date)}`
                      : 'תאריך לא ידוע'}
                    {' · '}
                    {(request.shift_name || request.shift_type || 'משמרת').replace(/_/g, ' ')}
                    {request.start_time && request.end_time && (
                      <span dir="ltr"> · {request.start_time}–{request.end_time}</span>
                    )}
                  </p>
                  {request.swap_reason && (
                    <p className="mt-2 whitespace-pre-wrap rounded-xl bg-card px-3 py-2 text-sm">{request.swap_reason}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button variant="success" size="sm" className="flex-1" disabled={!!loading} onClick={() => handleApprove(request.id)}>
                      {loading === 'approving' ? <Spinner className="text-white" /> : <><Check className="h-4 w-4" /> אישור</>}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-danger hover:bg-danger-soft hover:text-danger"
                      disabled={!!loading}
                      onClick={() => handleReject(request.id)}
                    >
                      {loading === 'rejecting' ? <Spinner /> : <><XCircle className="h-4 w-4" /> דחייה</>}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
