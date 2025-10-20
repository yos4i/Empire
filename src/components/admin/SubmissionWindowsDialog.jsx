import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { X, Calendar, Lock, Unlock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks } from 'date-fns';
import { SubmissionWindow } from '../../entities/SubmissionWindow';
import { toWeekStartISO } from '../../utils/weekKey';

export default function SubmissionWindowsDialog({ isOpen, onClose, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [weeks, setWeeks] = useState([]);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadWeeks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentWeekOffset]);

  const loadWeeks = async () => {
    setLoading(true);
    try {
      // Load next 4 weeks starting from current week
      const weeksData = [];
      const baseWeek = addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), currentWeekOffset);

      for (let i = 0; i < 4; i++) {
        const weekStart = addWeeks(baseWeek, i);
        const weekStartStr = toWeekStartISO(weekStart);
        const weekEnd = addDays(weekStart, 6);

        const submissionWindow = await SubmissionWindow.getWeek(weekStartStr);

        weeksData.push({
          weekStart: weekStartStr,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          isOpen: submissionWindow?.is_open || false,
          hasWindow: !!submissionWindow,
          windowId: submissionWindow?.id
        });
      }

      setWeeks(weeksData);
    } catch (error) {
      console.error('Error loading weeks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWeek = async (weekStartStr) => {
    try {
      setActionLoading(prev => ({ ...prev, [weekStartStr]: true }));

      const newStatus = await SubmissionWindow.toggleWeek(weekStartStr);

      // Refresh the weeks list
      await loadWeeks();

      if (onRefresh) {
        onRefresh();
      }

      alert(`השבוע ${newStatus ? 'נפתח' : 'נסגר'} להגשת העדפות בהצלחה!`);
    } catch (error) {
      console.error('Error toggling week:', error);
      alert('שגיאה בשינוי סטטוס השבוע: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [weekStartStr]: false }));
    }
  };

  const navigateWeeks = (direction) => {
    setCurrentWeekOffset(prev => prev + direction);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose} dir="rtl">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="pb-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              ניהול חלונות הגשת העדפות
            </CardTitle>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            פתח או סגור שבועות להגשת העדפות משמרות. חיילים יוכלו להגיש העדפות רק לשבועות פתוחים.
          </p>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto flex-1">
          {/* Week Navigation */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeeks(-4)}
              className="h-9 w-9 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600 font-medium">
              {currentWeekOffset === 0 ? 'השבוע הנוכחי' :
               currentWeekOffset > 0 ? `${currentWeekOffset} שבועות קדימה` :
               `${Math.abs(currentWeekOffset)} שבועות אחורה`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeeks(4)}
              className="h-9 w-9 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {weeks.map(week => {
                const isThisWeek = week.weekStartStr === toWeekStartISO(startOfWeek(new Date(), { weekStartsOn: 0 }));

                return (
                  <Card key={week.weekStart} className={`border-2 ${week.isOpen ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-lg text-gray-900">
                              {format(week.weekStartDate, 'dd/MM/yyyy')} - {format(week.weekEndDate, 'dd/MM/yyyy')}
                            </span>
                            {isThisWeek && (
                              <Badge className="bg-blue-100 text-blue-800 text-xs">
                                השבוע
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {week.hasWindow ? (
                              week.isOpen ? (
                                <span className="text-green-700 font-medium">✓ פתוח להגשת העדפות</span>
                              ) : (
                                <span className="text-red-700 font-medium">✗ סגור להגשת העדפות</span>
                              )
                            ) : (
                              <span className="text-gray-500">טרם הוגדר (סגור כברירת מחדל)</span>
                            )}
                          </div>
                        </div>

                        <Button
                          onClick={() => handleToggleWeek(week.weekStart)}
                          disabled={actionLoading[week.weekStart]}
                          className={`flex items-center gap-2 min-w-[140px] ${
                            week.isOpen
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {actionLoading[week.weekStart] ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              מעדכן...
                            </>
                          ) : week.isOpen ? (
                            <>
                              <Lock className="w-4 h-4" />
                              סגור הגשות
                            </>
                          ) : (
                            <>
                              <Unlock className="w-4 h-4" />
                              פתח הגשות
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">💡 טיפ:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• פתח שבועות מראש כדי לאפשר לחיילים להגיש העדפות בזמן</li>
              <li>• סגור שבועות לאחר שסיימת ליצור את הסידור</li>
              <li>• חיילים לא יוכלו להגיש או לערוך העדפות לשבועות סגורים</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
