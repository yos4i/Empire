import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { User, Clock, AlertTriangle, X, Users as UsersIcon, ArrowLeftRight, Clock3, MessageSquare } from 'lucide-react';
import { DAYS, SHIFT_NAMES, SHIFT_TYPES_HE } from '../../../config/shifts';
import { getLongShiftEndTime } from '../../../utils/weekKey';

const DAYS_HE = {
  sunday: 'ראשון',
  monday: 'שני', 
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי'
};

export default function ScheduleBoard({ schedule, users, submissions, soldierShiftCounts, soldierNotes = {}, isPublished, isEditMode, onCancelShift, onShiftClick, onDragEnd, isMobile, onShiftSlotClick, selectedSoldierId, onEditShiftHours, dynamicShiftNames, missionFilter, shiftAssignments = [], onToggleLongShift }) {
  // Use dynamic shift names from Firestore if available, otherwise fall back to static
  const shiftNames = dynamicShiftNames || SHIFT_NAMES;

  // Filter shifts by mission if missionFilter is provided
  const getFilteredShiftKeys = () => {
    const allShiftKeys = Object.keys(SHIFT_NAMES);

    // If no filter, show all shifts
    if (!missionFilter || missionFilter === "הכל") {
      return allShiftKeys;
    }

    // Filter by mission
    return allShiftKeys.filter(shiftKey => {
      if (missionFilter === 'קריית_חינוך') {
        return shiftKey.includes('קריית_חינוך');
      }
      if (missionFilter === 'גבולות') {
        return shiftKey.includes('גבולות');
      }
      return true;
    });
  };

  const filteredShiftKeys = getFilteredShiftKeys();
  
  const getShiftStatusColor = (shift, shiftKey) => {
    if (shift.cancelled) return 'bg-gray-100 border-gray-300';
    
    const assigned = shift.soldiers?.length || 0;
    const required = shift.required || 0;
    
    if (assigned === 0) return 'bg-red-50 border-red-200';
    if (assigned < required) return 'bg-yellow-50 border-yellow-200';
    if (assigned === required) return 'bg-green-50 border-green-200';
    return 'bg-blue-50 border-blue-200'; // over-assigned
  };

  const getRequirementBadgeColor = (assigned, required) => {
    if (assigned === 0) return 'bg-red-100 text-red-800';
    if (assigned < required) return 'bg-yellow-100 text-yellow-800';
    if (assigned === required) return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  // Helper to get assignment info for a specific soldier/shift/day
  const getAssignmentInfo = (soldierId, shiftKey, day) => {
    // Get the soldier's Auth UID (assignments use Auth UID, not Firestore doc ID)
    const soldier = users[soldierId];
    const soldierUid = soldier?.uid || soldierId;

    const assignment = shiftAssignments.find(assignment =>
      assignment.soldier_id === soldierUid &&
      assignment.shift_type === shiftKey &&
      assignment.day_name === day
    );

    return assignment;
  };

  const renderSoldierCard = (soldierId, shiftKey, day, index) => {
    const soldier = users[soldierId];
    if (!soldier) return null;

    const soldierShiftCount = soldierShiftCounts[soldierId] || 0;
    const isOverworked = soldierShiftCount > 6;

    // Get assignment info to check for swap requests and long shift status
    const assignmentInfo = getAssignmentInfo(soldierId, shiftKey, day);
    const hasSwapRequest = assignmentInfo?.status === 'swap_requested';
    const swapReason = assignmentInfo?.swap_reason;
    const isLongShift = assignmentInfo?.isLongShift || false;

    // Log only when isLongShift is true to reduce noise
    if (isLongShift) {
      console.log('⏰ Rendering soldier card with LONG SHIFT:', {
        soldier: soldier.hebrew_name,
        day,
        shiftKey,
        isLongShift: assignmentInfo.isLongShift
      });
    }

    // Check if soldier has notes
    const soldierNoteText = soldierNotes[soldier.uid] || soldierNotes[soldier.id];
    const hasNotes = !!soldierNoteText;

    return (
      <div
        key={`${soldierId}-${day}-${shiftKey}`}
        className={`
          p-2 mb-2 rounded border text-xs transition-all shadow-sm
          ${hasSwapRequest ? 'bg-orange-50 border-orange-300' : isOverworked ? 'bg-red-100 border-red-300' : isLongShift ? 'bg-amber-50 border-amber-300 border-l-4' : 'bg-white border-gray-200'}
          ${!isPublished ? 'hover:shadow-md' : ''}
        `}
      >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <User className="w-3 h-3 text-gray-500 flex-shrink-0" />
                <span className="font-medium text-gray-900 truncate">{soldier.hebrew_name}</span>
                {hasNotes && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alert(`הערות של ${soldier.hebrew_name}:\n\n${soldierNoteText}`);
                    }}
                    className="hover:bg-blue-100 rounded p-0.5"
                    title="צפה בהערות"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isLongShift && (
                  <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1 py-0 flex items-center gap-0.5">
                    <Clock3 className="w-2.5 h-2.5" />
                    {getLongShiftEndTime(day)}
                  </Badge>
                )}
                {hasSwapRequest && (
                  <Badge className="bg-orange-100 text-orange-800 text-[10px] px-1 py-0 flex items-center gap-0.5">
                    <ArrowLeftRight className="w-2.5 h-2.5" />
                    החלפה
                  </Badge>
                )}
                {onToggleLongShift && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-5 w-5 p-0 ${isLongShift ? 'hover:bg-amber-100 text-amber-600' : 'hover:bg-gray-100 text-gray-400'}`}
                    onClick={(e) => {
                      console.log('🕐 Clock button clicked!', {
                        day,
                        shiftKey,
                        soldierId,
                        currentIsLongShift: isLongShift,
                        willToggleTo: !isLongShift
                      });
                      e.stopPropagation();
                      onToggleLongShift(day, shiftKey, soldierId, !isLongShift);
                    }}
                    title={isLongShift ? "בטל משמרת ארוכה" : "סמן כמשמרת ארוכה (עד 15:30)"}
                  >
                    <Clock3 className="w-4 h-4" />
                  </Button>
                )}
                {onCancelShift && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-red-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelShift(day, shiftKey, soldierId);
                    }}
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {isOverworked && (
                <AlertTriangle className="w-3 h-3 text-red-500" />
              )}
            </div>
            {hasSwapRequest && swapReason && (
              <div className="mt-2 p-2 bg-orange-100 rounded text-xs border border-orange-200">
                <div className="font-semibold text-orange-900 mb-1">סיבת בקשת החלפה:</div>
                <div className="text-orange-800">{swapReason}</div>
              </div>
            )}
          </div>
    );
  };

  const renderShiftCell = (day, shiftKey, shift) => {
    const shiftInfo = SHIFT_TYPES_HE[shiftKey];
    const assigned = shift.soldiers?.length || 0;
    const required = shift.required || 0;

    // Remove "חינוך_" prefix from shift name for cleaner display
    const displayShiftName = shiftInfo?.name ? shiftInfo.name.replace('חינוך_', '').replace('ק.חינוך ', '') : shiftKey.replace('חינוך_', '');

    // Check if this specific day/shift has custom hours
    let timeString = '';
    if (shift.customStartTime && shift.customEndTime) {
      // Use custom hours for this specific day/shift
      timeString = `${shift.customStartTime}-${shift.customEndTime}`;
    } else {
      // Extract times from shift name (default hours)
      const shiftDisplayName = shiftNames[shiftKey] || SHIFT_NAMES[shiftKey] || '';
      const timeMatch = shiftDisplayName.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
      timeString = timeMatch ? `${timeMatch[1]}-${timeMatch[2]}` : '';
    }

    return (
      <div
        key={`${day}-${shiftKey}`}
        className={`
          min-h-[200px] p-3 rounded-lg border-2 transition-all
          ${getShiftStatusColor(shift, shiftKey)}
          ${shift.cancelled ? 'opacity-50' : ''}
          ${selectedSoldierId && !shift.cancelled ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}
        `}
        onClick={(e) => {
          // Don't trigger if clicking on buttons or soldier cards with their own handlers
          const target = e.target;
          const isButton = target.closest('button');

          if (isButton) {
            return; // Let button handle its own click
          }

          // Check if click is for soldier assignment
          if (selectedSoldierId && !shift.cancelled) {
            onShiftSlotClick && onShiftSlotClick(day, shiftKey);
          }
        }}
      >
            {/* Shift Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-gray-900">
                  {displayShiftName}
                </h4>
                <p className="text-xs text-gray-600 font-medium">
                  {timeString || 'אין שעות'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isEditMode && onEditShiftHours && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-orange-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditShiftHours(day, shiftKey, shiftNames[shiftKey]);
                    }}
                    title="ערוך שעות משמרת"
                  >
                    <Clock className="w-3 h-3 text-orange-600" />
                  </Button>
                )}
                <Badge
                  className={`text-xs ${getRequirementBadgeColor(assigned, required)}`}
                >
                  {assigned}/{required}
                </Badge>
                {shiftInfo?.isLong && (
                  <Badge variant="outline" className="text-xs">
                    ארוכה
                  </Badge>
                )}
              </div>
            </div>

            {/* Cancelled Shift Notice */}
            {shift.cancelled && (
              <div className="bg-gray-200 text-gray-600 text-center py-2 rounded mb-2 text-sm">
                משמרת מבוטלת
              </div>
            )}

            {/* Assigned Soldiers */}
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {shift.soldiers?.map((soldierId, index) =>
                renderSoldierCard(soldierId, shiftKey, day, index)
              )}
            </div>

            {/* Shift Actions - Only show when edit mode is active */}
            {isEditMode && onCancelShift && (
              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelShift(day, shiftKey);
                  }}
                >
                  {shift.cancelled ? 'בטל ביטול' : 'בטל משמרת'}
                </Button>
              </div>
            )}
      </div>
    );
  };

  if (!schedule || Object.keys(schedule).length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>טוען נתוני סידור...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 h-full">
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5" />
            לוח סידור עבודה
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          {/* Desktop Grid Layout */}
          <div className="hidden md:block h-full">
            <div className="min-w-[1400px] pb-4">
              {/* Header Row - Days as columns */}
              <div className="grid gap-2 p-4 bg-gray-50 border-b sticky top-0 z-10" style={{ gridTemplateColumns: '180px repeat(6, minmax(180px, 1fr))' }}>
                <div className="font-semibold text-center text-gray-700">סוג משמרת</div>
                {DAYS.map(day => (
                  <div key={day} className="font-semibold text-center text-gray-700">
                    {DAYS_HE[day]}
                  </div>
                ))}
              </div>

              {/* Schedule Grid - Each row is a shift type */}
              {filteredShiftKeys.map(shiftKey => (
                <div key={shiftKey} className="grid gap-2 p-4 border-b" style={{ gridTemplateColumns: '180px repeat(6, minmax(180px, 1fr))' }}>
                  {/* Shift Type Header */}
                  <div className="flex items-center justify-center bg-purple-100 border-2 border-purple-300 rounded-lg p-3">
                    <div className="text-center">
                      <span className="font-bold text-sm text-purple-900 block leading-tight">
                        {SHIFT_TYPES_HE[shiftKey]?.name || shiftKey}
                      </span>
                    </div>
                  </div>

                  {/* Day Cells for this shift */}
                  {DAYS.map(day => (
                    <div key={`${day}-${shiftKey}`} className="min-w-0">
                      {schedule[day]?.[shiftKey] ?
                        renderShiftCell(day, shiftKey, schedule[day][shiftKey]) :
                        <div className="min-h-[180px] bg-gray-100 rounded-lg flex items-center justify-center">
                          <span className="text-gray-400 text-sm">לא זמין</span>
                        </div>
                      }
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="md:hidden">
            {filteredShiftKeys.map(shiftKey => (
              <div key={shiftKey} className="border-b last:border-b-0">
                <div className="bg-purple-100 border-b-2 border-purple-300 p-3">
                  <h3 className="font-bold text-lg text-purple-900">
                    {SHIFT_TYPES_HE[shiftKey]?.name || shiftKey}
                  </h3>
                </div>
                <div className="p-3 space-y-3">
                  {DAYS.map(day => 
                    schedule[day]?.[shiftKey] && (
                      <div key={`${day}-${shiftKey}`}>
                        <div className="text-sm font-medium text-gray-700 mb-2">{DAYS_HE[day]}</div>
                        {renderShiftCell(day, shiftKey, schedule[day][shiftKey])}
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}


