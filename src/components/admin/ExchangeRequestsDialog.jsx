import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { X, ArrowLeftRight, Check, XCircle, Calendar, Clock, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ShiftAssignment } from '../../entities/ShiftAssignment';

export default function ExchangeRequestsDialog({ isOpen, onClose, exchangeRequests, soldiers, onRefresh }) {
  const [actionLoading, setActionLoading] = useState({});

  if (!isOpen) return null;

  const handleApprove = async (requestId) => {
    try {
      setActionLoading(prev => ({ ...prev, [requestId]: 'approving' }));

      // Update status to approved
      await ShiftAssignment.update(requestId, {
        status: 'assigned',
        swap_approved: true,
        swap_approved_at: new Date()
      });

      alert('בקשת ההחלפה אושרה בהצלחה!');
      await onRefresh(); // Refresh the list

    } catch (error) {
      console.error('Error approving exchange request:', error);
      alert('שגיאה באישור בקשת ההחלפה: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: null }));
    }
  };

  const handleReject = async (requestId) => {
    if (!window.confirm('האם אתה בטוח שברצונך לדחות את בקשת ההחלפה?')) {
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [requestId]: 'rejecting' }));

      // Update status back to assigned and clear swap fields
      await ShiftAssignment.update(requestId, {
        status: 'assigned',
        swap_rejected: true,
        swap_rejected_at: new Date()
      });

      alert('בקשת ההחלפה נדחתה');
      await onRefresh(); // Refresh the list

    } catch (error) {
      console.error('Error rejecting exchange request:', error);
      alert('שגיאה בדחיית בקשת ההחלפה: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: null }));
    }
  };

  const getSoldierName = (soldierId) => {
    const soldier = soldiers.find(s => s.id === soldierId || s.uid === soldierId);
    return soldier?.hebrew_name || soldier?.displayName || soldier?.full_name || 'לא ידוע';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose} dir="rtl">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="pb-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <ArrowLeftRight className="w-6 h-6 text-orange-600" />
              בקשות החלפת משמרות ({exchangeRequests.length})
            </CardTitle>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto flex-1">
          {exchangeRequests.length === 0 ? (
            <div className="text-center py-12">
              <ArrowLeftRight className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500 mb-2">אין בקשות החלפה ממתינות</h3>
              <p className="text-gray-400">כל בקשות ההחלפה טופלו או שאין בקשות חדשות</p>
            </div>
          ) : (
            <div className="space-y-4">
              {exchangeRequests.map(request => (
                <Card key={request.id} className="border-2 border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header with soldier name and status */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-5 h-5 text-gray-600" />
                          <div>
                            <span className="font-semibold text-lg text-gray-900">
                              {getSoldierName(request.soldier_id)}
                            </span>
                            <div className="text-xs text-gray-500">
                              מס״ד: {request.soldier_id?.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                          <ArrowLeftRight className="w-3 h-3 ml-1" />
                          ממתין לאישור
                        </Badge>
                      </div>

                      {/* Shift details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <div>
                            <div className="text-xs text-gray-500">תאריך</div>
                            <div className="font-medium">
                              {request.date ? format(new Date(request.date), 'dd/MM/yyyy') : 'לא ידוע'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-purple-600" />
                          <div>
                            <div className="text-xs text-gray-500">משמרת</div>
                            <div className="font-medium">
                              {request.shift_name?.replace(/_/g, ' ') || request.shift_type?.replace(/_/g, ' ') || 'לא ידוע'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-green-600" />
                          <div>
                            <div className="text-xs text-gray-500">שעות</div>
                            <div className="font-medium">
                              {request.start_time && request.end_time
                                ? `${request.start_time} - ${request.end_time}`
                                : 'לא ידוע'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Swap reason */}
                      {request.swap_reason && (
                        <div className="bg-orange-100 p-3 rounded-lg border border-orange-200">
                          <div className="text-sm font-semibold text-orange-900 mb-1">סיבת בקשת ההחלפה:</div>
                          <div className="text-sm text-orange-800 whitespace-pre-wrap">{request.swap_reason}</div>
                        </div>
                      )}

                      {/* Request timestamp */}
                      {request.swap_requested_at && (
                        <div className="text-xs text-gray-500">
                          נשלח ב: {format(new Date(request.swap_requested_at.seconds ? request.swap_requested_at.seconds * 1000 : request.swap_requested_at), 'dd/MM/yyyy HH:mm')}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-2 border-t border-orange-200">
                        <Button
                          onClick={() => handleApprove(request.id)}
                          disabled={actionLoading[request.id]}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {actionLoading[request.id] === 'approving' ? (
                            <>
                              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                              מאשר...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 ml-2" />
                              אשר החלפה
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleReject(request.id)}
                          disabled={actionLoading[request.id]}
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                        >
                          {actionLoading[request.id] === 'rejecting' ? (
                            <>
                              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                              דוחה...
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 ml-2" />
                              דחה בקשה
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
