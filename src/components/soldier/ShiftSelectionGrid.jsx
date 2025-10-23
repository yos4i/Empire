import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Clock, Sun, Sunset } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { DAYS } from "../../config/shifts";
import { shiftDefinitionsService } from "../../services/shiftDefinitions";

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];

const SHIFTS_CONFIG = {
  sunday: [
    { type: "בוקר_07_1330", label: "בוקר 07:00-13:30", icon: Sun },
    { type: "בוקר_07_1430", label: "בוקר 07:00-14:30", icon: Sun },
    { type: "בוקר_07_1530", label: "בוקר 07:00-15:30", icon: Sun },
    { type: "ערב_1530_1930", label: "ערב 15:30-19:30", icon: Sunset }
  ],
  monday: [
    { type: "בוקר_07_1330", label: "בוקר 07:00-13:30", icon: Sun },
    { type: "בוקר_07_1430", label: "בוקר 07:00-14:30", icon: Sun },
    { type: "בוקר_07_1530", label: "בוקר 07:00-15:30", icon: Sun },
    { type: "ערב_1530_1930", label: "ערב 15:30-19:30", icon: Sunset }
  ],
  tuesday: [
    { type: "בוקר_07_1330", label: "בוקר 07:00-13:30", icon: Sun },
    { type: "בוקר_07_1430", label: "בוקר 07:00-14:30", icon: Sun },
    { type: "בוקר_07_1530", label: "בוקר 07:00-15:30", icon: Sun },
    { type: "ערב_1530_1930", label: "ערב 15:30-19:30", icon: Sunset }
  ],
  wednesday: [
    { type: "בוקר_07_1330", label: "בוקר 07:00-13:30", icon: Sun },
    { type: "בוקר_07_1430", label: "בוקר 07:00-14:30", icon: Sun },
    { type: "בוקר_07_1530", label: "בוקר 07:00-15:30", icon: Sun },
    { type: "ערב_1530_1930", label: "ערב 15:30-19:30", icon: Sunset }
  ],
  thursday: [
    { type: "בוקר_07_1330", label: "בוקר 07:00-13:30", icon: Sun },
    { type: "בוקר_07_1430", label: "בוקר 07:00-14:30", icon: Sun },
    { type: "בוקר_07_1530", label: "בוקר 07:00-15:30", icon: Sun },
    { type: "ערב_1530_1930", label: "ערב 15:30-19:30", icon: Sunset }
  ],
  friday: [
    { type: "בוקר_07_1215", label: "שישי 07:00-12:15", icon: Sun }
  ]
};

export default function ShiftSelectionGrid({ shifts, onToggleShift, isSubmissionOpen = true, weeklySchedule, soldierMission, longShiftDays = {}, weekStart }) {
  // Use the weekStart prop if provided, otherwise fall back to current week (for backwards compatibility)
  const nextWeekStart = weekStart || startOfWeek(new Date(), { weekStartsOn: 0 });
  const [dynamicShiftsConfig, setDynamicShiftsConfig] = useState(SHIFTS_CONFIG);
  const [loading, setLoading] = useState(true);

  // Load dynamic shift definitions and apply custom hours from weekly schedule
  useEffect(() => {
    let unsubscribe;

    const loadShiftDefinitions = async () => {
      try {
        console.log('🎯 ShiftSelectionGrid: soldierMission prop =', soldierMission);
        // Subscribe to real-time shift definition updates
        unsubscribe = shiftDefinitionsService.subscribeToShiftDefinitions((updatedShifts) => {
          console.log('ShiftSelectionGrid: Received shift definitions update');
          console.log('🎯 Available shifts:', Object.keys(updatedShifts.SHIFT_NAMES || {}));

          // Convert shift definitions to SHIFTS_CONFIG format
          const newConfig = {};

          DAYS.forEach((dayKey) => {
            newConfig[dayKey] = [];

            // Get all shifts from the updated definitions
            Object.entries(updatedShifts.SHIFT_NAMES || {}).forEach(([shiftKey, displayName]) => {
              const shiftData = updatedShifts.rawShifts?.[shiftKey];
              if (!shiftData) return;

              // Filter by soldier's mission
              // If soldier has "קריית_חינוך" mission, only show קריית_חינוך shifts
              // If soldier has "גבולות" mission, only show גבולות shifts
              console.log('🔍 ShiftSelectionGrid: Checking shift:', shiftKey, 'soldierMission:', soldierMission);
              if (soldierMission) {
                if (soldierMission === 'קריית_חינוך' && !shiftKey.includes('קריית_חינוך')) {
                  console.log('❌ ShiftSelectionGrid: Skipping', shiftKey, '(not קריית_חינוך)');
                  return; // Skip non-kiryat shifts
                }
                if (soldierMission === 'גבולות' && !shiftKey.includes('גבולות')) {
                  console.log('❌ ShiftSelectionGrid: Skipping', shiftKey, '(not גבולות)');
                  return; // Skip non-borders shifts
                }
              }

              // Check if this shift is cancelled in the weekly schedule for this day
              if (weeklySchedule?.schedule?.[dayKey]?.[shiftKey]?.cancelled) {
                console.log('❌ ShiftSelectionGrid: Skipping', shiftKey, 'on', dayKey, '(shift cancelled by admin)');
                return; // Skip cancelled shifts
              }

              console.log('✅ ShiftSelectionGrid: Including shift:', shiftKey);

              // Extract just the shift type part (without mission prefix)
              const shiftTypePart = shiftKey.replace(`${shiftData.mission}_`, '');

              // Determine icon based on shift type
              const isEvening = shiftData.type === 'ערב' || shiftTypePart.includes('ערב');
              const icon = isEvening ? Sunset : Sun;

              // Check if weekly schedule has custom hours for this specific day/shift
              let startTime = shiftData.startTime;
              let endTime = shiftData.endTime;

              if (weeklySchedule?.schedule?.[dayKey]?.[shiftKey]) {
                const dayShift = weeklySchedule.schedule[dayKey][shiftKey];
                console.log(`🔍 ShiftSelectionGrid: Checking ${dayKey} ${shiftKey}:`, dayShift);
                if (dayShift.customStartTime && dayShift.customEndTime) {
                  startTime = dayShift.customStartTime;
                  endTime = dayShift.customEndTime;
                  console.log(`✅ ShiftSelectionGrid: Using custom hours for ${dayKey} ${shiftKey}: ${startTime}-${endTime}`);
                } else {
                  console.log(`ℹ️ ShiftSelectionGrid: No custom hours for ${dayKey} ${shiftKey}, using default: ${startTime}-${endTime}`);
                }
              } else {
                console.log(`⚠️ ShiftSelectionGrid: No schedule data for ${dayKey} ${shiftKey}`);
              }

              // Create label from start and end times
              // Remove "חינוך_" prefix from shift type for cleaner display
              const displayShiftType = shiftData.shiftType.replace('חינוך_', '');
              const label = `${displayShiftType} ${startTime}-${endTime}`;

              newConfig[dayKey].push({
                type: shiftTypePart,
                label: label,
                icon: icon,
                isLong: shiftData.isLong || false,
                fullKey: shiftKey
              });

              // Add "long shift" option for morning shifts
              // Skip long shifts for גבולות soldiers
              if (shiftData.type === 'בוקר' && !shiftData.isLong && soldierMission !== 'גבולות') {
                newConfig[dayKey].push({
                  type: shiftTypePart + '_ארוך',
                  label: `${displayShiftType} ארוך 07:00-15:30`,
                  icon: icon,
                  isLong: true,
                  fullKey: shiftKey + '_ארוך',
                  isVirtual: true, // Mark as virtual - not a real shift type
                  baseShiftKey: shiftKey
                });
              }
            });
          });

          console.log('🎯 Final filtered shifts config:', newConfig);
          setDynamicShiftsConfig(newConfig);
          setLoading(false);
        });
      } catch (error) {
        console.error('ShiftSelectionGrid: Error loading shift definitions:', error);
        // Fall back to static config
        setDynamicShiftsConfig(SHIFTS_CONFIG);
        setLoading(false);
      }
    };

    loadShiftDefinitions();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [weeklySchedule, soldierMission]);

  const canSubmit = isSubmissionOpen;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {DAYS_HE.map((dayName, index) => {
        const dayKey = DAYS[index];
        const dayShifts = shifts[dayKey] || [];
        const dayShiftsConfig = dynamicShiftsConfig[dayKey] || [];
        const currentDate = addDays(nextWeekStart, index);
        return (
          <Card key={dayKey} className="overflow-hidden">
            <CardHeader className="bg-gray-50 py-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span>{dayName}</span>
                </div>
                <div className="text-sm font-normal text-gray-600">{format(currentDate, 'd/M/yyyy')}</div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid gap-2">
                {dayShiftsConfig.map((shift) => {
                  // Check if this is selected - for virtual long shifts, check both the base shift and long preference
                  const isLongShiftType = shift.isVirtual && shift.type.includes('_ארוך');
                  const baseType = isLongShiftType ? shift.type.replace('_ארוך', '') : shift.type;
                  const isBaseSelected = dayShifts.includes(baseType);
                  const hasLongPref = longShiftDays[dayKey];
                  const isSelected = isLongShiftType ? (isBaseSelected && hasLongPref) : isBaseSelected;

                  const Icon = shift.icon;
                  const isEvening = shift.type === "ערב_1530_1930" || shift.type.includes("ערב");

                  return (
                    <div key={shift.type} onClick={() => canSubmit && onToggleShift(dayKey, shift.type)} className={`flex items-center justify-between p-3 rounded-lg border-2 ${canSubmit ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} transition-all duration-200 hover:shadow-md ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                        <div>
                          <span className={`font-medium ${isSelected ? "text-blue-900" : "text-gray-900"}`}>{shift.label}</span>
                          {isEvening && (
                            <Badge variant="outline" className="mr-2 text-xs bg-purple-50 text-purple-700 border-purple-200">ערב</Badge>
                          )}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {dayShifts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-sm text-gray-600">נבחרו {dayShifts.length} משמרות</div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}


