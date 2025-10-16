import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { AlertCircle, Clock, Calendar, CheckCircle } from "lucide-react";

export default function SubmissionRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          חוקי ההגשה
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
            <div>
              <span className="font-medium">בחירת מינימום 5 משמרות</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
            <div>
              <span className="font-medium">חובת בחירת משמרת בוקר עד 15:30</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 mt-0.5" />
            <div>
              <span className="font-medium">משמרת ערב תאושר רק על ידי מפקד</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-purple-600 mt-0.5" />
            <div>
              <span className="font-medium">הגשת סידור עד יום חמישי בשעה 16:00</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


