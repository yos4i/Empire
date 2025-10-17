import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { User, Clock, AlertTriangle, X, Users as UsersIcon } from 'lucide-react';
import { DAYS, SHIFT_NAMES, SHIFT_TYPES_HE } from '../../../config/shifts';

const DAYS_HE = {
  sunday: 'ראשון',
  monday: 'שני', 
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי'
};

export default function ScheduleBoard({ schedule, users, submissions, soldierShiftCounts, isPublished, isEditMode, onCancelShift, onShiftClick, onDragEnd, isMobile, onShiftSlotClick, selectedSoldierId }) {
  
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

  const renderSoldierCard = (soldierId, shiftKey, day, index) => {
    const soldier = users[soldierId];
    if (!soldier) return null;

    const soldierShiftCount = soldierShiftCounts[soldierId] || 0;
    const isOverworked = soldierShiftCount > 6;

    return (
      <div
        key={`${soldierId}-${day}-${shiftKey}`}
        className={`
          p-2 mb-2 rounded border text-sm transition-all shadow-sm
          ${isOverworked ? 'bg-red-100 border-red-300' : 'bg-white border-gray-200'}
          ${!isPublished ? 'hover:shadow-md' : ''}
        `}
      >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 text-gray-500" />
                <span className="font-medium text-gray-900">{soldier.hebrew_name}</span>
              </div>
              {!isPublished && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-red-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelShift && onCancelShift(day, shiftKey, soldierId);
                  }}
                >
                  <X className="w-3 h-3 text-red-500" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {isOverworked && (
                <AlertTriangle className="w-3 h-3 text-red-500" />
              )}
            </div>
          </div>
    );
  };

  const renderShiftCell = (day, shiftKey, shift) => {
    const shiftInfo = SHIFT_TYPES_HE[shiftKey];
    const assigned = shift.soldiers?.length || 0;
    const required = shift.required || 0;

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
              <div>
                <h4 className="font-semibold text-sm text-gray-900">
                  {shiftInfo?.name || shiftKey}
                </h4>
                <p className="text-xs text-gray-600">
                  {SHIFT_NAMES[shiftKey]?.split('(')[1]?.replace(')', '') || ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
            <div className="space-y-1">
              {shift.soldiers?.map((soldierId, index) => 
                renderSoldierCard(soldierId, shiftKey, day, index)
              )}
            </div>

            {/* Shift Actions - Only show when edit mode is active */}
            {!isPublished && isEditMode && (
              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelShift && onCancelShift(day, shiftKey);
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
            <div className="min-w-[1200px] pb-4">
              {/* Header Row - Days as columns */}
              <div className="grid gap-2 p-4 bg-gray-50 border-b sticky top-0 z-10" style={{ gridTemplateColumns: '200px repeat(6, 1fr)' }}>
                <div className="font-semibold text-center text-gray-700">סוג משמרת</div>
                {DAYS.map(day => (
                  <div key={day} className="font-semibold text-center text-gray-700">
                    {DAYS_HE[day]}
                  </div>
                ))}
              </div>

              {/* Schedule Grid - Each row is a shift type */}
              {Object.keys(SHIFT_NAMES).map(shiftKey => (
                <div key={shiftKey} className="grid gap-2 p-4 border-b" style={{ gridTemplateColumns: '200px repeat(6, 1fr)' }}>
                  {/* Shift Type Header */}
                  <div className="flex items-center justify-center bg-purple-50 rounded-lg p-4">
                    <div className="text-center">
                      <span className="font-medium text-purple-900 block">
                        {SHIFT_TYPES_HE[shiftKey]?.name || shiftKey}
                      </span>
                      <span className="text-xs text-purple-600">
                        {SHIFT_NAMES[shiftKey]?.split('(')[1]?.replace(')', '') || ''}
                      </span>
                    </div>
                  </div>

                  {/* Day Cells for this shift */}
                  {DAYS.map(day => (
                    <div key={`${day}-${shiftKey}`}>
                      {schedule[day]?.[shiftKey] ?
                        renderShiftCell(day, shiftKey, schedule[day][shiftKey]) :
                        <div className="min-h-[200px] bg-gray-100 rounded-lg flex items-center justify-center">
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
            {Object.keys(SHIFT_NAMES).map(shiftKey => (
              <div key={shiftKey} className="border-b last:border-b-0">
                <div className="bg-purple-50 p-3 border-b">
                  <h3 className="font-medium text-purple-900">
                    {SHIFT_TYPES_HE[shiftKey]?.name || shiftKey}
                  </h3>
                  <p className="text-xs text-purple-600">
                    {SHIFT_NAMES[shiftKey]?.split('(')[1]?.replace(')', '') || ''}
                  </p>
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


