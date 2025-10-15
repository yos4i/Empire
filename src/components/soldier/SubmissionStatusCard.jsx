import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { ClipboardList } from 'lucide-react';

export default function SubmissionStatusCard({ submission }) {
  const getSubmissionStatus = () => {
    if (!submission || !submission.shifts) return { status: "לא הוגש", color: "red", count: 0 };
    const totalShifts = Object.values(submission.shifts).flat().length;
    if (totalShifts > 0) return { status: "הוגש", color: "green", count: totalShifts };
    return { status: "לא הוגש", color: "red", count: 0 };
  };

  const { status, color, count } = getSubmissionStatus();
  const progress = count > 0 ? 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          סטטוס הגשה לשבוע הבא
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">סטטוס:</span>
          <Badge variant="outline" className={`${color === "green" ? "bg-green-100 text-green-800" : ""} ${color === "yellow" ? "bg-yellow-100 text-yellow-800" : ""} ${color === "red" ? "bg-red-100 text-red-800" : ""}`}>
            {status}
          </Badge>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
          <div className={`h-2.5 rounded-full ${color === "green" ? "bg-green-500" : color === "yellow" ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${progress}%` }}></div>
        </div>
        <p className="text-xs text-gray-600 text-center">{count > 0 ? `נבחרו ${count} משמרות` : 'לא נבחרו משמרות'}</p>
      </CardContent>
    </Card>
  );
}



