import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Clock, Sun, Sunset } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { DAYS } from "../../config/shifts";

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

export default function ShiftSelectionGrid({ shifts, onToggleShift, isSubmissionOpen = true }) {
  const nextWeekStart = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 7);

  const canSubmit = isSubmissionOpen;

  return (
    <div className="space-y-4">
      {DAYS_HE.map((dayName, index) => {
        const dayKey = DAYS[index];
        const dayShifts = shifts[dayKey] || [];
        const dayShiftsConfig = SHIFTS_CONFIG[dayKey] || [];
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
                  const isSelected = dayShifts.includes(shift.type);
                  const Icon = shift.icon;
                  const isEvening = shift.type === "ערב_1530_1930";
                  const isLong = shift.type === "בוקר_07_1530" || isEvening;
                  return (
                    <div key={shift.type} onClick={() => canSubmit && onToggleShift(dayKey, shift.type)} className={`flex items-center justify-between p-3 rounded-lg border-2 ${canSubmit ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} transition-all duration-200 hover:shadow-md ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                        <div>
                          <span className={`font-medium ${isSelected ? "text-blue-900" : "text-gray-900"}`}>{shift.label}</span>
                          {isLong && (
                            <Badge variant="outline" className="mr-2 text-xs bg-purple-50 text-purple-700 border-purple-200">{isEvening ? "דורש אישור" : "משמרת ארוכה"}</Badge>
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


